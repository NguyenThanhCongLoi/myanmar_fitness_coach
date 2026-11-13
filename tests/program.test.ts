import { expect, test } from 'vitest';
import catalog from '../prisma/exercise-catalog.json';
import guidance from '../prisma/exercise-guidance.json';
import { availableAt, exercisesFor, MUSCLE_GROUPS, nutritionGuidance, patternOf, pickSession, recommendFor, SPLITS, weeklyPlan, weeklySplits } from '../src/shared/program';
const lib = catalog.map(e => ({ ...e, guidance: (guidance as Record<string, { home: string[]; perSide: boolean }>)[e.id] }));
test('every muscle group has exercises, and the gym adds machine/cable options such as lat pulldown', () => {
  for (const muscles of Object.values(MUSCLE_GROUPS)) expect(exercisesFor(muscles, lib).length).toBeGreaterThan(0);
  const backGym = exercisesFor(MUSCLE_GROUPS.back, lib, 'gym').map(e => e.id);
  expect(backGym).toContain('gym-lat-pulldown');
  expect(exercisesFor(MUSCLE_GROUPS.back, lib, 'home').map(e => e.id)).not.toContain('gym-lat-pulldown');
  expect(availableAt(lib.find(e => e.id === 'dataset-0662')!, 'home')).toBe(true);
  expect(availableAt(lib.find(e => e.id === 'curated-barbell-squat')!, 'home')).toBe(false);
});
test('sessions cover the paired muscles with real exercises at or below the user level', () => {
  for (const split of Object.keys(SPLITS) as (keyof typeof SPLITS)[]) for (const place of ['home', 'gym'] as const) {
    const s = pickSession(split, lib, place, 'beginner');
    if((place==='gym'&&split==='core') || (place==='home'&&split==='pull')){expect(s).toHaveLength(0);continue;}
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) { expect(x.exercise.difficulty).toBe('beginner'); expect(availableAt(x.exercise, place)).toBe(true); }
  }
  const pull = pickSession('pull', lib, 'gym', 'intermediate').map(x => x.exercise.id);
  expect(new Set(pull).size).toBe(pull.length);
});
test('weekly plan follows training days; rest days stay rest', () => {
  expect(weeklySplits(3)).toEqual(['push', 'pull', 'legs']);
  const plan = weeklyPlan([0, 2, 4], 3);
  expect(plan.filter(d => d.split).map(d => [d.weekday, d.split])).toEqual([[0, 'push'], [2, 'pull'], [4, 'legs']]);
  expect(plan.filter(d => !d.split)).toHaveLength(4);
});
test('nutrition guidance uses body weight and goal; nothing personal without weight', () => {
  expect(nutritionGuidance(60, 'build_muscle')).toMatchObject({ proteinG: [96, 132], waterL: [1.8, 2.1], energy: 'small_surplus' });
  expect(nutritionGuidance(null, 'general_fitness').proteinG).toBeNull();
});

test('every non-warm-up exercise has a movement pattern and at least one recommendation at the gym', () => {
  for (const e of lib.filter(x => availableAt(x,'gym') && !(x.tags as string[]).some(t => t === 'warmup' || t === 'cooldown'))) {
    expect(patternOf(e), e.id).not.toBe('other');
    const r = recommendFor(e, lib, 'gym', 'advanced');
    expect(r.sameMuscle.length + r.complementary.length, e.id).toBeGreaterThan(0);
    for (const x of [...r.sameMuscle, ...r.complementary]) expect(lib.some(y => y.id === x.id)).toBe(true);
  }
});
test('back exercises recommend another back angle and the opposing push (antagonist balance)', () => {
  const row = lib.find(e => e.id === 'gym-seated-cable-row')!;
  const r = recommendFor(row, lib, 'gym', 'intermediate');
  expect(r.sameMuscle.some(x => x.id === 'gym-lat-pulldown')).toBe(true);
  expect(r.complementary.find(x => x.reason === 'BALANCE_ANTAGONIST')).toBeTruthy();
  expect(patternOf(lib.find(e => e.id === r.complementary.find(x => x.reason === 'BALANCE_ANTAGONIST')!.id)!)).toBe('push-h');
  const home = recommendFor(row, lib, 'home', 'beginner');
  for (const x of [...home.sameMuscle, ...home.complementary]) expect(availableAt(lib.find(e => e.id === x.id)!, 'home')).toBe(true);
});
