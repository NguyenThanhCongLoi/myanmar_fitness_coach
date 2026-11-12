import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { bodyPreferencesSchema, DEFAULT_BODY_PREFERENCES, focusMuscles, toggleFocus } from '../src/shared/body-preferences';
import { pickSession, type ProgramExercise } from '../src/shared/program';
import { getPlan, getPrefs, savePrefs } from '../src/server/plan';

const prefix = `body-prefs-${Date.now()}`;
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } }); await prisma.$disconnect(); });

test('visual goal values are bounded and reject identity or arbitrary fields', () => {
  expect(bodyPreferencesSchema.safeParse({ ...DEFAULT_BODY_PREFERENCES, userId: 'other' }).success).toBe(false);
  expect(bodyPreferencesSchema.safeParse({ ...DEFAULT_BODY_PREFERENCES, focusAreas: ['full', 'waist'] }).success).toBe(false);
  expect(bodyPreferencesSchema.safeParse({ ...DEFAULT_BODY_PREFERENCES, waistCm: 0 }).success).toBe(false);
  expect(toggleFocus(['full'], 'glutes')).toEqual(['glutes']);
  expect(toggleFocus(['glutes'], 'glutes')).toEqual(['full']);
  expect(focusMuscles({ ...DEFAULT_BODY_PREFERENCES, gluteGoal: 'build' })).toContain('gluteal');
});

test('a focus changes eligible exercise selection without adding harder work', () => {
  const lib: ProgramExercise[] = ['quadriceps', 'gluteal'].map((muscle, i) => ({ id: `choice-${i}`, equipment: ['body weight'], difficulty: 'beginner', primaryMuscles: [muscle], guidance: { home: ['cue'] } }));
  expect(pickSession('lower', lib, 'home', 'beginner', 1)[0].exercise.id).toBe('choice-0');
  expect(pickSession('lower', lib, 'home', 'beginner', 1, ['gluteal'])[0].exercise.id).toBe('choice-1');
  expect(pickSession('lower', lib, 'home', 'beginner', 1, ['gluteal'])[0].dose).toEqual(pickSession('lower', lib, 'home', 'beginner', 1)[0].dose);
});

test('preferences persist only for the authenticated owner; plans respect selected equipment', async () => {
  const a = prefix + '-a', b = prefix + '-b';
  await prisma.user.createMany({ data: [a, b].map(id => ({ id, name: 'Synthetic', email: `${id}@example.test` })) });
  for (const userId of [a, b]) await prisma.fitnessProfile.create({ data: { userId, equipment: ['body weight'], onboarded: true, daysPerWeek: 3 } });
  const bodyPreferences = { ...DEFAULT_BODY_PREFERENCES, focusAreas: ['glutes'] as const, gluteGoal: 'build', waistCm: 80, hipsCm: 95 };
  await savePrefs(a, { bodyPreferences });
  expect((await getPrefs(a)).bodyPreferences).toMatchObject({ focusAreas: ['glutes'], waistCm: 80, hipsCm: 95 });
  expect((await getPrefs(b)).bodyPreferences).toEqual(DEFAULT_BODY_PREFERENCES);
  await expect(savePrefs(a, { userId: b, bodyPreferences })).rejects.toThrow();
  const plan = await getPlan(a, 'home');
  const ids = plan.days.flatMap(d => d.items.map(i => i.id));
  expect(ids.length).toBeGreaterThan(0);
  const exercises = await prisma.exercise.findMany({ where: { id: { in: ids } } });
  expect(exercises.every(e => (e.equipment as string[]).every(q => q === 'body weight'))).toBe(true);
  await savePrefs(a, { bodyPreferences: { ...DEFAULT_BODY_PREFERENCES, protectedAreas: ['knees', 'wrists'] } });
  const protectedPlan = await getPlan(a, 'home');
  const safe = await prisma.exercise.findMany({ where: { id: { in: protectedPlan.days.flatMap(d => d.items.map(i => i.id)) } } });
  expect(safe.every(e => !(e.tags as string[]).some(t => ['knee-loaded','jumping','wrist-loaded'].includes(t)))).toBe(true);
});
