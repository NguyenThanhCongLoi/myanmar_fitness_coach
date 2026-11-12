import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { e1rm, loadStep, suggestNext, progressionFor } from '../src/server/progression';
import { createTraining } from '../src/server/training';
import { finishSession, logSet } from '../src/server/services';
const prefix = `prog-${Date.now()}`;
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } }); await prisma.$disconnect(); });
const set = (reps: number, weightKg: number, setIndex = 0, rir: number | null = null) => ({ reps, weightKg, setIndex, rir });
test('double progression: add reps, then load at top of range (gated by RIR), hold or reduce after misses', () => {
  expect(e1rm(100, 5)).toBe(116.7); expect(e1rm(50, 20)).toBeNull(); expect(loadStep(['barbell'])).toBe(2.5); expect(loadStep(['dumbbell'])).toBe(2);
  expect(suggestNext([], ['barbell'], [8, 12]).note).toBe('START_LIGHT');
  expect(suggestNext([[set(9, 40), set(9, 40, 1)]], ['barbell'], [8, 12])).toMatchObject({ weightKg: 40, reps: 10, note: 'ADD_REP' });
  expect(suggestNext([[set(12, 40), set(12, 40, 1)]], ['barbell'], [8, 12])).toMatchObject({ weightKg: 42.5, reps: 8, note: 'ADD_LOAD' });
  expect(suggestNext([[set(12, 40, 0, 0)]], ['barbell'], [8, 12]).note).toBe('ADD_REP');
  expect(suggestNext([[set(6, 40)]], ['barbell'], [8, 12])).toMatchObject({ weightKg: 40, note: 'HOLD' });
  expect(suggestNext([[set(6, 40)], [set(7, 40)]], ['barbell'], [8, 12])).toMatchObject({ weightKg: 35, note: 'REDUCE' });
  expect(suggestNext([[set(15, 0)]], ['body weight'], [12, 15]).note).toBe('HARDER_VARIATION');
});
test('logging a heavier set returns a personal record; progression uses previous completed sessions only', async () => {
  const id = prefix + 'a';
  await prisma.user.create({ data: { id, name: 'T', email: id + '@example.test', profile: { create: { equipment: ['body weight', 'dumbbell'], experience: 'beginner', onboarded: true } } } });
  const ex = 'dataset-0294';
  const s1 = await createTraining(id, 'free', { name: 'Session A', exercises: [{ exerciseId: ex, sets: 2, reps: 10, restSeconds: 60, targetKg: 8 }] });
  const first = await logSet(id, s1.id, { exerciseId: ex, setIndex: 0, reps: 10, weight: 8, unit: 'kg', restSeconds: 60, rir: 2 });
  expect(first.pr).toBeNull(); expect(first.rir).toBe(2);
  await logSet(id, s1.id, { exerciseId: ex, setIndex: 1, reps: 10, weight: 8, unit: 'kg', restSeconds: 60, rir: 1 });
  await finishSession(id, s1.id, '');
  const p = await progressionFor(id, [ex]);
  expect(p[ex].suggestion).toMatchObject({ weightKg: 10, reps: 8, note: 'ADD_LOAD' });
  const s2 = await createTraining(id, 'free', { name: 'Session B', exercises: [{ exerciseId: ex, sets: 1, reps: 8, restSeconds: 60, targetKg: 10 }] });
  const pr = await logSet(id, s2.id, { exerciseId: ex, setIndex: 0, reps: 8, weight: 10, unit: 'kg', restSeconds: 60 });
  expect(pr.pr).toMatchObject({ type: 'e1rm' });
  expect((await progressionFor(id, [ex], s2.id))[ex].suggestion?.previous).toHaveLength(2);
});
test('warm-up sets never count as records; superset rests only after the last exercise of the pair', async () => {
  const id = prefix + 'b';
  await prisma.user.create({ data: { id, name: 'T', email: id + '@example.test', profile: { create: { equipment: ['body weight', 'dumbbell'], experience: 'beginner', onboarded: true } } } });
  const ex = 'dataset-0294';
  const other = (await prisma.exercise.findFirst({ where: { id: { not: ex } }, select: { id: true } }))!.id;
  const s = await createTraining(id, 'free', { name: 'Superset day', exercises: [
    { exerciseId: ex, sets: 2, reps: 10, restSeconds: 90, targetKg: 8, supersetGroup: 'A' },
    { exerciseId: other, sets: 2, reps: 10, restSeconds: 90, targetKg: 0, supersetGroup: 'A' }] });
  const warm = await logSet(id, s.id, { exerciseId: ex, setIndex: 0, reps: 10, weight: 30, unit: 'kg', restSeconds: 90, kind: 'warmup' });
  expect(warm.kind).toBe('warmup'); expect(warm.pr).toBeNull();
  // First exercise of the superset: no rest timer; last exercise: normal rest.
  expect((await prisma.workoutSession.findUnique({ where: { id: s.id } }))!.restUntil).toBeNull();
  await logSet(id, s.id, { exerciseId: other, setIndex: 0, reps: 10, weight: 0, unit: 'kg', restSeconds: 90 });
  expect((await prisma.workoutSession.findUnique({ where: { id: s.id } }))!.restUntil).not.toBeNull();
  // A superset group needs at least two exercises.
  await expect(createTraining(id, 'free', { name: 'Bad superset', exercises: [{ exerciseId: ex, sets: 1, reps: 10, restSeconds: 60, targetKg: 0, supersetGroup: 'B' }] })).rejects.toThrow();
});
test('profile accepts every equipment option the form offers (all 7), rejects duplicates', async () => {
  const { profileSchema } = await import('../src/server/validation');
  const base = { locale: 'en', goal: 'general_fitness', experience: 'beginner', daysPerWeek: 3, weightUnit: 'kg', distanceUnit: 'km' };
  expect(profileSchema.safeParse({ ...base, equipment: ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'] }).success).toBe(true);
  expect(profileSchema.safeParse({ ...base, equipment: ['dumbbell', 'dumbbell'] }).success).toBe(false);
});
test('timed session completion % = seconds done / seconds planned', async () => {
  const id = prefix + 'timed';
  await prisma.user.create({ data: { id, name: 'T', email: id + '@example.test', profile: { create: { equipment: ['body weight'], experience: 'beginner', onboarded: true } } } });
  const ex = 'dataset-0294';
  const s = await createTraining(id, 'free', { name: 'Timed day', program: { key: 'personal', day: 1 }, exercises: [{ exerciseId: ex, sets: 2, reps: 30, restSeconds: 20, targetKg: 0, timed: true }] });
  await logSet(id, s.id, { exerciseId: ex, setIndex: 0, reps: 1, weight: 0, unit: 'kg', restSeconds: 20, seconds: 30 });
  await logSet(id, s.id, { exerciseId: ex, setIndex: 1, reps: 1, weight: 0, unit: 'kg', restSeconds: 20, seconds: 15 });
  await finishSession(id, s.id, '');
  const done = await prisma.workoutSession.findUnique({ where: { id: s.id } });
  expect(done?.completionPct).toBe(75); expect(done?.programDay).toBe(1);
});
