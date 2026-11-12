import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { civilDay, addDay } from './streak';

// First-party product analytics: events stay in the app's own database (no third party).
// Only event names and tiny non-personal properties are stored — never message, food or note text.
// Users can opt out in Profile; events older than 90 days are deleted.
export const RETENTION_DAYS = 90;
const TZ = 'Asia/Yangon';
const CLIENT_EVENTS = ['screen_view', 'screen_time', 'app_rating', 'workout_quit', 'exercise_opened', 'voice_play', 'theme_changed', 'share_clicked', 'photo_added', 'language_switched'] as const;

const SERVER_ROUTES: Record<string, string> = {
  'fitness:profile': 'profile_saved', 'fitness:preferences': 'language_changed', 'fitness:plans': 'plan_created', 'fitness:sessions': 'workout_started',
  'fitness:sessions/*/sets': 'set_logged', 'fitness:sessions/*/finish': 'workout_completed', 'fitness:measurements': 'body_logged',
  'fitness:coach/chat': 'coach_message', 'fitness:proposals/*/approve': 'plan_approved', 'fitness:coach/memory': 'coach_memory_saved',
  'training:free': 'workout_started', 'training:follow': 'workout_started', 'training:readiness': 'readiness_saved',
  'training:energy/food': 'food_logged', 'training:energy/parse-food': 'food_ai_parsed', 'training:energy/activity': 'activity_logged',
  'training:energy/body': 'body_profile_saved', 'training:parse/sets': 'sets_ai_parsed', 'training:report/narrative': 'weekly_report_ai',
  'training:sessions/*/feedback': 'feedback_given', 'training:sessions/*/action': 'workout_action', 'training:tts/session': 'voice_play', 'training:favorite': 'favorite_toggled', 'training:water': 'water_logged', 'training:energy/photo': 'meal_photo', 'training:prefs': 'prefs_saved', 'training:program': 'program_changed', 'training:plan/swap': 'exercise_swapped',
};
// Map an API write to an event name (ids in paths are replaced by *).
export function eventForRoute(api: 'fitness' | 'training', path: string[]) {
  const shape = path.map((p, i) => (i === 1 && (path[0] === 'sessions' || path[0] === 'proposals') ? '*' : p)).join('/');
  return SERVER_ROUTES[`${api}:${shape}`] ?? null;
}
const props = (route: string[]): Record<string, string> => (route[0] === 'free' || route[0] === 'follow' ? { mode: route[0] } : route[0] === 'sessions' && route.length === 1 ? { mode: 'plan' } : {});
const device = (request?: Request) => (/Mobi|Android|iPhone|iPad/i.test(request?.headers.get('user-agent') ?? '') ? 'mobile' : 'desktop');

const optOut = new Map<string, { value: boolean; at: number }>();
async function isOptedOut(userId: string) {
  const hit = optOut.get(userId); if (hit && Date.now() - hit.at < 60000) return hit.value;
  const p = await prisma.fitnessProfile.findUnique({ where: { userId }, select: { analyticsOptOut: true } });
  const value = !!p?.analyticsOptOut; optOut.set(userId, { value, at: Date.now() }); return value;
}
let lastPrune = 0;
async function prune(now: Date) {
  if (now.getTime() - lastPrune < 6 * 3600000) return; lastPrune = now.getTime();
  await prisma.usageEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86400000) } } });
}
async function insert(userId: string, rows: { name: string; screen?: string | null; props?: Record<string, string | number | boolean> }[], request?: Request, now = new Date()) {
  if (!rows.length || await isOptedOut(userId)) return 0;
  const locale = request?.headers.get('accept-language')?.startsWith('en') ? 'en' : null;
  await prisma.usageEvent.createMany({ data: rows.map(r => ({ userId, name: r.name, screen: r.screen ?? null, device: device(request), locale, props: r.props ?? {}, createdAt: now })) });
  await prune(now);
  return rows.length;
}
// Server-side: called by the API routes after a successful write.
export async function trackRoute(userId: string, api: 'fitness' | 'training', path: string[], request?: Request) {
  const name = eventForRoute(api, path); if (!name) return;
  try { await insert(userId, [{ name, props: props(path) }], request); } catch { /* analytics never breaks the product */ }
}
// One "app_open" per user per 30 minutes (bootstrap is requested on every app start).
const opens = new Map<string, number>();
export async function trackAppOpen(userId: string, request?: Request) {
  const last = opens.get(userId) ?? 0; if (Date.now() - last < 30 * 60000) return; opens.set(userId, Date.now());
  try { await insert(userId, [{ name: 'app_open' }], request); } catch { /* optional */ }
}
const clientBatch = z.object({ events: z.array(z.object({
  name: z.enum(CLIENT_EVENTS), screen: z.string().regex(/^[a-z_-]{1,30}$/).optional(),
  props: z.record(z.string().regex(/^[a-zA-Z_]{1,20}$/), z.union([z.string().max(60), z.number(), z.boolean()])).refine(o => Object.keys(o).length <= 4).optional(),
}).strict()).min(1).max(20) }).strict();
export async function recordClientEvents(userId: string, raw: unknown, request?: Request) {
  const input = clientBatch.parse(raw);
  return { stored: await insert(userId, input.events, request) };
}
export async function setAnalyticsOptOut(userId: string, raw: unknown) {
  const { optOut: value } = z.object({ optOut: z.boolean() }).strict().parse(raw);
  await prisma.fitnessProfile.updateMany({ where: { userId }, data: { analyticsOptOut: value } });
  if (value) await prisma.usageEvent.deleteMany({ where: { userId } });
  optOut.set(userId, { value, at: Date.now() });
  return { optOut: value };
}

// ---------- Admin ----------
export function isAdmin(email?: string | null) {
  const list = (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}
export function requireAdmin(email?: string | null) { if (!isAdmin(email)) throw new ApiError(403, 'FORBIDDEN'); }

export async function analyticsSummary(rawDays: unknown, now = new Date()) {
  const days = z.coerce.number().int().min(7).max(90).catch(30).parse(rawDays);
  const today = civilDay(now, TZ), from = addDay(today, -(days - 1));
  const since = new Date(`${from}T00:00:00+06:30`);
  const [events, users, completed] = await Promise.all([
    prisma.usageEvent.findMany({ where: { createdAt: { gte: since } }, select: { userId: true, name: true, device: true, createdAt: true } }),
    prisma.user.findMany({ select: { id: true, createdAt: true, profile: { select: { locale: true, onboarded: true } } } }),
    prisma.workoutSession.findMany({ where: { status: 'completed' }, select: { userId: true, endedAt: true } }),
  ]);
  const dayOf = (d: Date) => civilDay(d, TZ);
  const series = Array.from({ length: days }, (_, i) => addDay(from, i)).map(day => {
    const ev = events.filter(e => dayOf(e.createdAt) === day);
    return { day, activeUsers: new Set(ev.map(e => e.userId)).size, events: ev.length,
      signups: users.filter(u => dayOf(u.createdAt) === day).length, workouts: completed.filter(c => c.endedAt && dayOf(c.endedAt) === day).length };
  });
  const activeSince = (n: number) => new Set(events.filter(e => e.createdAt.getTime() >= now.getTime() - n * 86400000).map(e => e.userId)).size;
  const byName = new Map<string, { count: number; users: Set<string> }>();
  for (const e of events) { const b = byName.get(e.name) ?? { count: 0, users: new Set() }; b.count++; b.users.add(e.userId); byName.set(e.name, b); }
  const features = [...byName].map(([name, b]) => ({ name, count: b.count, users: b.users.size })).sort((a, b) => b.users - a.users || b.count - a.count);
  const done = new Map<string, number>(); for (const c of completed) done.set(c.userId, (done.get(c.userId) ?? 0) + 1);
  const started = new Set(events.filter(e => e.name === 'workout_started').map(e => e.userId));
  const cohort = users.filter(u => u.createdAt >= since);
  const funnel = [
    { step: 'signed_up', users: cohort.length },
    { step: 'onboarded', users: cohort.filter(u => u.profile?.onboarded).length },
    { step: 'started_workout', users: cohort.filter(u => started.has(u.id) || (done.get(u.id) ?? 0) > 0).length },
    { step: 'completed_1', users: cohort.filter(u => (done.get(u.id) ?? 0) >= 1).length },
    { step: 'completed_3', users: cohort.filter(u => (done.get(u.id) ?? 0) >= 3).length },
  ];
  // Retention: users who signed up at least N days ago and were active on day N or later.
  const retention = [1, 7, 30].map(n => {
    const eligible = users.filter(u => now.getTime() - u.createdAt.getTime() >= n * 86400000 && u.createdAt >= since);
    const back = eligible.filter(u => events.some(e => e.userId === u.id && e.createdAt.getTime() - u.createdAt.getTime() >= n * 86400000)).length;
    return { day: n, eligible: eligible.length, returned: back, rate: eligible.length ? Math.round(back / eligible.length * 100) : null };
  });
  const recent = events.filter(e => e.createdAt.getTime() >= now.getTime() - 30 * 86400000);
  const deviceUsers = (d: string) => new Set(recent.filter(e => e.device === d).map(e => e.userId)).size;
  const locales = users.reduce<Record<string, number>>((m, u) => { const l = u.profile?.locale ?? 'unknown'; m[l] = (m[l] ?? 0) + 1; return m; }, {});
  return {
    days, from, to: today, retentionDays: RETENTION_DAYS,
    totals: { users: users.length, newUsers: cohort.length, activeToday: series.at(-1)?.activeUsers ?? 0, active7: activeSince(7), active30: activeSince(30), workouts: series.reduce((n, d) => n + d.workouts, 0), events: events.length },
    series, features, funnel, retention, devices: { mobile: deviceUsers('mobile'), desktop: deviceUsers('desktop') }, locales,
  };
}
export async function analyticsCsv(rawDays: unknown, now = new Date()) {
  const days = z.coerce.number().int().min(1).max(90).catch(30).parse(rawDays);
  const rows = await prisma.usageEvent.findMany({ where: { createdAt: { gte: new Date(now.getTime() - days * 86400000) } }, orderBy: { createdAt: 'asc' }, take: 50000 });
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return ['time_utc,user_id,event,screen,device,props', ...rows.map(r => [r.createdAt.toISOString(), r.userId, r.name, r.screen, r.device, JSON.stringify(r.props)].map(esc).join(','))].join('\n');
}

// ---------- Product insights for the owner (improvement-oriented; no private content) ----------
const median = (xs: number[]) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b ? Math.round(a / b * 100) : null);
export function maskEmail(email: string) { const [u, d] = email.split('@'); return `${u.slice(0, 2)}***@${d ?? ''}`; }
const FEATURE_EVENTS = ['workout_started', 'workout_completed', 'coach_message', 'food_logged', 'food_ai_parsed', 'readiness_saved', 'voice_play', 'exercise_opened', 'photo_added', 'share_clicked', 'weekly_report_ai', 'body_logged'];

export async function analyticsInsights(rawDays: unknown, now = new Date()) {
  const base = await analyticsSummary(rawDays, now);
  const since = new Date(`${base.from}T00:00:00+06:30`);
  const [events, monthEvents, sessions, users, feedback, achievements, notes, exercises] = await Promise.all([
    prisma.usageEvent.findMany({ where: { createdAt: { gte: since } }, select: { userId: true, name: true, screen: true, device: true, props: true, createdAt: true } }),
    prisma.usageEvent.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } }, select: { userId: true } }),
    prisma.workoutSession.findMany({ where: { startedAt: { gte: since } }, select: { userId: true, mode: true, status: true, startedAt: true, endedAt: true, totalPausedMs: true,
      sets: { where: { completed: true }, select: { exerciseId: true } }, prescriptions: { select: { exerciseId: true, originalExerciseId: true, skipped: true } } } }),
    prisma.user.findMany({ select: { id: true, email: true, createdAt: true, profile: { select: { locale: true } }, workouts: { where: { status: 'completed' }, select: { endedAt: true }, orderBy: { endedAt: 'asc' } } } }),
    prisma.workoutFeedback.findMany({ where: { createdAt: { gte: since } }, select: { difficulty: true, pain: true } }),
    prisma.achievement.findMany({ where: { createdAt: { gte: since } }, select: { key: true } }),
    prisma.notificationJob.findMany({ where: { createdAt: { gte: since } }, select: { deliveredAt: true, readAt: true } }),
    prisma.exercise.findMany({ select: { id: true, name: true } }),
  ]);
  const activeUsers = new Set(events.map(e => e.userId));
  const dayOf = (d: Date) => civilDay(d, TZ);
  // Engagement / stickiness
  const mau = new Set(monthEvents.map(e => e.userId)).size;
  const avgDau = base.series.reduce((n, d) => n + d.activeUsers, 0) / base.series.length;
  const activeDays = new Map<string, Set<string>>();
  for (const e of events) { const set = activeDays.get(e.userId) ?? new Set<string>(); set.add(dayOf(e.createdAt)); activeDays.set(e.userId, set); }
  const totalActiveDays = [...activeDays.values()].reduce((n, set) => n + set.size, 0);
  const opens = events.filter(e => e.name === 'app_open').length;
  // Satisfaction: latest in-app rating (1-5) per user, plus the area they like most
  const latestRating = new Map<string, number>(); const favorites: Record<string, number> = {};
  for (const e of [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (e.name !== 'app_rating') continue;
    const p = e.props as { score?: number; fav?: string };
    if (Number.isInteger(p.score) && p.score! >= 1 && p.score! <= 5) latestRating.set(e.userId, p.score!);
    if (p.fav && /^[a-z_]{2,20}$/.test(p.fav)) favorites[p.fav] = (favorites[p.fav] ?? 0) + 1;
  }
  const scores = [...latestRating.values()];
  // Time spent per screen (seconds reported when leaving a screen, capped at 30 min per visit)
  const time = new Map<string, { sec: number; visits: number; users: Set<string> }>();
  for (const e of events) {
    if (e.name !== 'screen_time' || !e.screen) continue;
    const sec = Number((e.props as { s?: number }).s); if (!Number.isFinite(sec) || sec < 1) continue;
    const t = time.get(e.screen) ?? { sec: 0, visits: 0, users: new Set<string>() }; t.sec += Math.min(sec, 1800); t.visits++; t.users.add(e.userId); time.set(e.screen, t);
  }
  const totalSec = [...time.values()].reduce((n, t) => n + t.sec, 0);
  const screens = [...time].map(([screen, t]) => ({ screen, minutes: round1(t.sec / 60), share: pct(t.sec, totalSec), avgVisitSec: Math.round(t.sec / t.visits), users: t.users.size })).sort((a, b) => b.minutes - a.minutes);
  // Workouts
  const done = sessions.filter(x => x.status === 'completed');
  const ended = sessions.filter(x => x.status === 'completed' || x.status === 'abandoned');
  const minutes = done.map(x => Math.max(0, ((x.endedAt?.getTime() ?? x.startedAt.getTime()) - x.startedAt.getTime() - (x.totalPausedMs ?? 0)) / 60000));
  const modes = sessions.reduce<Record<string, number>>((m, x) => { m[x.mode] = (m[x.mode] ?? 0) + 1; return m; }, {});
  const exNames = new Map(exercises.map(e => [e.id, e.name.split('—')[0].trim()]));
  const tally = (pairs: [string, string][]) => {
    const m = new Map<string, { n: number; users: Set<string> }>();
    for (const [id, u] of pairs) { const x = m.get(id) ?? { n: 0, users: new Set<string>() }; x.n++; x.users.add(u); m.set(id, x); }
    return [...m].map(([id, x]) => ({ exercise: exNames.get(id) ?? id, count: x.n, users: x.users.size })).sort((a, b) => b.count - a.count).slice(0, 8);
  };
  const topExercises = tally(done.flatMap(x => [...new Set(x.sets.map(st => st.exerciseId))].map(id => [id, x.userId] as [string, string])));
  const skipped = tally(sessions.flatMap(x => x.prescriptions.filter(p => p.skipped).map(p => [p.exerciseId, x.userId] as [string, string])));
  const replaced = tally(sessions.flatMap(x => x.prescriptions.filter(p => p.originalExerciseId !== p.exerciseId).map(p => [p.originalExerciseId, x.userId] as [string, string])));
  const difficulty = feedback.reduce<Record<string, number>>((m, x) => { m[x.difficulty] = (m[x.difficulty] ?? 0) + 1; return m; }, {});
  const firstWorkoutHours = users.filter(u => u.createdAt >= since && u.workouts[0]?.endedAt).map(u => (u.workouts[0].endedAt!.getTime() - u.createdAt.getTime()) / 3600000);
  // Feature adoption = share of active users who used it at least once in the period
  const adoption = FEATURE_EVENTS.map(name => { const n = new Set(events.filter(e => e.name === name).map(e => e.userId)).size; return { name, users: n, share: pct(n, activeUsers.size) }; }).sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  // Weekly signup cohorts (last 6 weeks): share of the cohort active in week 1..4 after signup
  const weekStart = (d: Date) => { const day = dayOf(d); const wd = (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7; return addDay(day, -wd); };
  const recentEvents = await prisma.usageEvent.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 77 * 86400000) } }, select: { userId: true, createdAt: true } });
  const daysByUser = new Map<string, Set<string>>(); for (const e of recentEvents) { const set = daysByUser.get(e.userId) ?? new Set<string>(); set.add(dayOf(e.createdAt)); daysByUser.set(e.userId, set); }
  const cohortMap = new Map<string, string[]>();
  for (const u of users) { const w = weekStart(u.createdAt); if (w < addDay(base.to, -7 * 6)) continue; cohortMap.set(w, [...(cohortMap.get(w) ?? []), u.id]); }
  const cohorts = [...cohortMap].sort((a, b) => a[0].localeCompare(b[0])).map(([week, ids]) => ({ week, size: ids.length, weeks: [1, 2, 3, 4].map(k => {
    const start = addDay(week, 7 * k); if (start > base.to) return null; const end = addDay(start, 7);
    return pct(ids.filter(id => [...(daysByUser.get(id) ?? [])].some(d => d >= start && d < end)).length, ids.length); }) }));
  // People (masked email; no names, no content)
  const lastSeen = new Map<string, Date>(); const lastDevice = new Map<string, string>();
  for (const e of events) { const p = lastSeen.get(e.userId); if (!p || e.createdAt > p) { lastSeen.set(e.userId, e.createdAt); if (e.device) lastDevice.set(e.userId, e.device); } }
  const people = users.map(u => ({ email: maskEmail(u.email), joined: dayOf(u.createdAt), lastActive: lastSeen.get(u.id) ? dayOf(lastSeen.get(u.id)!) : null, activeDays: activeDays.get(u.id)?.size ?? 0,
    workouts: u.workouts.length, rating: latestRating.get(u.id) ?? null, language: u.profile?.locale ?? null, device: lastDevice.get(u.id) ?? null }))
    .sort((a, b) => (b.lastActive ?? '').localeCompare(a.lastActive ?? '') || b.workouts - a.workouts).slice(0, 200);
  return {
    ...base,
    engagement: { mau, avgDau: round1(avgDau), stickiness: pct(avgDau, mau), activeDaysPerUser: activeUsers.size ? round1(totalActiveDays / activeUsers.size) : 0,
      opensPerUser: activeUsers.size ? round1(opens / activeUsers.size) : 0, minutesPerActiveDay: totalActiveDays && totalSec ? round1(totalSec / 60 / totalActiveDays) : null },
    satisfaction: { responses: scores.length, average: scores.length ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : null, distribution: [1, 2, 3, 4, 5].map(k => scores.filter(x => x === k).length), favorites },
    screens,
    workouts: { started: sessions.length, completed: done.length, completionRate: pct(done.length, ended.length), avgMinutes: minutes.length ? round1(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
      perActiveUserWeek: activeUsers.size ? round1(done.length / activeUsers.size / (base.days / 7)) : 0, modes, difficulty, painReports: feedback.filter(x => x.pain).length, feedbackCount: feedback.length,
      medianHoursToFirst: firstWorkoutHours.length ? round1(median(firstWorkoutHours)!) : null, topExercises, skipped, replaced },
    adoption, cohorts,
    habits: { achievements: achievements.reduce<Record<string, number>>((m, x) => { m[x.key] = (m[x.key] ?? 0) + 1; return m; }, {}), notificationsSent: notes.filter(n => n.deliveredAt).length, notificationsRead: notes.filter(n => n.readAt).length },
    growth: base.series.map(d => ({ day: d.day, users: users.filter(u => dayOf(u.createdAt) <= d.day).length })),
    people,
  };
}
