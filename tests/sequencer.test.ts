import { expect, test } from 'vitest';
import catalogJson from '../prisma/exercise-catalog.json';
import { sequenceWorkout, SequenceError, preparationSeconds, TRANSITION_SECONDS } from '../src/server/sequencer';
const catalog = catalogJson.map(e => ({ ...e }));
const base = { focus: 'all', difficulty: 'beginner' as const, equipment: ['body weight'], avoid: [], excludedIds: [], reviewedConstraints: true as const };
test.each([5, 10, 15, 20, 30])('%i-minute budget counts every phase and never exceeds the budget', minutes => {
  const routine = sequenceWorkout(catalog, { ...base, seconds: minutes * 60 });
  const sum = routine.phases.reduce((n, p) => n + p.seconds, 0);
  expect(sum).toBe(routine.totalSeconds);
  expect(routine.totalSeconds).toBeLessThanOrEqual(minutes * 60);
  expect(Object.values(routine.summary).reduce((a, b) => a + b, 0)).toBe(sum);
  expect(routine.phases[0].kind).toBe('warmup');
  expect(routine.phases.at(-1)!.kind).toBe('cooldown');
  expect(routine.summary.warmup).toBe(preparationSeconds(minutes * 60).warmup);
  expect(routine.exerciseCount).toBeGreaterThan(0);
  // Unused budget is smaller than one more rest + transition + exercise block.
  expect(minutes * 60 - routine.totalSeconds).toBeLessThan(30 + TRANSITION_SECONDS + 30 + 1);
  const ids = new Set(catalog.map(e => e.id));
  for (const p of routine.phases) if (p.exerciseId) expect(ids.has(p.exerciseId)).toBe(true);
});
test('deterministic: same input gives identical routine', () => {
  const input = { ...base, seconds: 900, focus: 'quadriceps' };
  expect(sequenceWorkout(catalog, input)).toEqual(sequenceWorkout(catalog, input));
});
test('respects equipment, difficulty and avoided movement tags', () => {
  const routine = sequenceWorkout(catalog, { ...base, seconds: 1200, avoid: ['floor', 'knee-loaded'] });
  const byId = new Map(catalog.map(e => [e.id, e]));
  for (const p of routine.phases.filter(p => p.kind === 'exercise')) {
    const e = byId.get(p.exerciseId!)!;
    expect(e.equipment.every(x => x === 'body weight')).toBe(true);
    expect(e.difficulty).toBe('beginner');
    expect(e.tags.some(t => t === 'floor' || t === 'knee-loaded')).toBe(false);
  }
  // Timed and rep-based tracking both supported.
  expect(new Set(sequenceWorkout(catalog, { ...base, seconds: 1800 }).phases.filter(p => p.kind === 'exercise').map(p => p.tracking))).toEqual(new Set(['timed', 'reps']));
});
test('explains instead of exceeding when a plan cannot fit or match', () => {
  const err = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return e as SequenceError; } };
  const short = err(() => sequenceWorkout(catalog, { ...base, seconds: 120 }));
  expect(short?.code).toBe('BUDGET_TOO_SHORT');
  expect(short?.details).toMatchObject({ budgetSeconds: 120, minimumSeconds: 160, warmup: 60, cooldown: 60 });
  expect(err(() => sequenceWorkout(catalog, { ...base, seconds: 160 }))).toBeNull();
  const noMatch = err(() => sequenceWorkout(catalog, { ...base, seconds: 600, focus: 'chest', avoid: ['floor', 'wrist-loaded'] }));
  expect(noMatch?.code).toBe('NO_EXERCISE_MATCH');
  expect(noMatch?.details).toMatchObject({ focus: 'chest' });
  expect(err(() => sequenceWorkout(catalog.filter(e => !e.tags.includes('warmup')), { ...base, seconds: 600 }))?.code).toBe('NO_PREPARATION_MATCH');
  expect(err(() => sequenceWorkout(catalog, { ...base, seconds: 600, reviewedConstraints: false as never }))).toBeTruthy();
});
