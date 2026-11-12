import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { analyticsSummary, eventForRoute, isAdmin, recordClientEvents, setAnalyticsOptOut, trackRoute } from '../src/server/analytics';
// Synthetic users only.
const prefix = `ana-${Date.now()}`;
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } }); await prisma.$disconnect(); });
async function user(s: string) { const id = prefix + s; await prisma.user.create({ data: { id, name: 'T', email: id + '@example.test', profile: { create: { onboarded: true, equipment: ['body weight'] } } } }); return id; }

test('routes map to event names (ids hidden); unknown routes are ignored', () => {
  expect(eventForRoute('fitness', ['sessions', 'abc', 'sets'])).toBe('set_logged');
  expect(eventForRoute('fitness', ['coach', 'chat'])).toBe('coach_message');
  expect(eventForRoute('training', ['energy', 'food'])).toBe('food_logged');
  expect(eventForRoute('training', ['events'])).toBeNull();
});
test('client events: allow-listed names and tiny props only; opt-out stops tracking and deletes history', async () => {
  const id = await user('a');
  await trackRoute(id, 'training', ['free']);
  expect((await recordClientEvents(id, { events: [{ name: 'screen_view', screen: 'progress' }] })).stored).toBe(1);
  await expect(recordClientEvents(id, { events: [{ name: 'chat_text', props: {} }] })).rejects.toThrow();
  await expect(recordClientEvents(id, { events: [{ name: 'share_clicked', props: { note: 'x'.repeat(200) } }] })).rejects.toThrow();
  const rows = await prisma.usageEvent.findMany({ where: { userId: id } });
  expect(rows.map(r => r.name).sort()).toEqual(['screen_view', 'workout_started']);
  expect(rows.find(r => r.name === 'workout_started')?.props).toEqual({ mode: 'free' });
  await setAnalyticsOptOut(id, { optOut: true });
  expect(await prisma.usageEvent.count({ where: { userId: id } })).toBe(0);
  await trackRoute(id, 'training', ['readiness']);
  expect(await prisma.usageEvent.count({ where: { userId: id } })).toBe(0);
});
test('admin summary counts active users and features; admin list comes from env', async () => {
  const id = await user('b');
  await trackRoute(id, 'fitness', ['coach', 'chat']);
  const s = await analyticsSummary(7);
  expect(s.series).toHaveLength(7);
  expect(s.totals.activeToday).toBeGreaterThanOrEqual(1);
  expect(s.features.some(f => f.name === 'coach_message')).toBe(true);
  process.env.ADMIN_EMAILS = 'Owner@Example.test, other@example.test';
  expect(isAdmin('owner@example.test')).toBe(true); expect(isAdmin('someone@example.test')).toBe(false); expect(isAdmin(null)).toBe(false);
});

test('insights: latest rating per user, screen time with 30-min cap, masked emails, no private content', async () => {
  const { analyticsInsights, maskEmail } = await import('../src/server/analytics');
  const id = await user('c');
  await recordClientEvents(id, { events: [
    { name: 'app_rating', props: { score: 2 } }, { name: 'app_rating', props: { score: 5, fav: 'voice' } }, { name: 'app_rating', props: { score: 9 } },
    { name: 'screen_time', screen: 'train', props: { s: 120 } }, { name: 'screen_time', screen: 'train', props: { s: 99999 } }, { name: 'screen_time', screen: 'home', props: { s: 30 } },
  ] });
  const s = await analyticsInsights(7);
  const train = s.screens.find(x => x.screen === 'train')!;
  expect(train.minutes).toBe(32); // 120 s + capped 1800 s
  expect(s.satisfaction.distribution[4]).toBeGreaterThanOrEqual(1);
  expect(s.satisfaction.favorites.voice).toBeGreaterThanOrEqual(1);
  // All synthetic users share the masked form 'an***@example.test'; the rated one must show its latest valid score.
  expect(maskEmail(prefix + 'c@example.test')).toBe('an***@example.test');
  expect(s.people.some(p => p.email === 'an***@example.test' && p.rating === 5)).toBe(true);
  expect(JSON.stringify(s)).not.toContain(prefix + 'c@example.test');
});
