import { expect, test } from 'vitest';
import { bmiBand, bmiOf, buildPlan, cardioSettings, programSplits } from '../src/shared/plan';
import { waterTargetMl } from '../src/server/plan';
import catalog from '../prisma/exercise-catalog.json';
import wger from '../prisma/exercise-media-wger.json';
import media from '../prisma/exercise-media.json';
import original from '../prisma/exercise-media-original.json';
// Library as the server builds it (catalog + guidance + video flags).
import guidance from '../prisma/exercise-guidance.json';
const lib = (catalog as { id: string; primaryMuscles: string[]; secondaryMuscles: string[]; equipment: string[]; difficulty: string; tags: string[]; tracking: string }[]).map(e => ({
  ...e, guidance: (guidance as Record<string, { home: string[]; perSide: boolean }>)[e.id], videoUrl: (original as Record<string,{videoUrl?:string}>)[e.id]?.videoUrl ?? (wger as Record<string,{videoUrl?:string}>)[e.id]?.videoUrl ?? (media as Record<string,{videoUrl?:string}>)[e.id]?.videoUrl ?? null }));

test('BMI bands and cardio volume follow height and weight', () => {
  expect(bmiOf(80, 170)).toBe(27.7); expect(bmiBand(27.7)).toBe('over'); expect(bmiBand(31)).toBe('obese'); expect(bmiOf(null, 170)).toBeNull();
  expect(cardioSettings('obese').work).toBeLessThan(cardioSettings('normal').work + 1);
  expect(programSplits('four_day', 3)).toEqual(['chest', 'back', 'legs', 'full']);
});
test('4-day plan: chest/back/legs/cardio, cardio timed, no jumping for high BMI', () => {
  const days = buildPlan({ program: 'four_day', daysPerWeek: 4, library: lib, location: 'gym', level: 'beginner', bmi: 33 });
  expect(days.slice(0, 4).map(d => d.split)).toEqual(['chest', 'back', 'legs', 'full']);
  const cardio = days[3];
  expect(cardio.items.every(i => i.unit === 'reps')).toBe(true);
  expect(cardio.items.some(i => i.id === 'core-164')).toBe(false); // bench hops (jumping) skipped
  expect(days[0].items.every(i => i.unit === 'reps')).toBe(true);   // gym strength = reps x weight
});
test('home plan: timed follow-along, exercises with video first', () => {
  const days = buildPlan({ program: 'personal', daysPerWeek: 3, library: lib, location: 'home', level: 'beginner', bmi: 23 });
  expect(days.length).toBeGreaterThan(0);
  for (const d of days.slice(0, 3)) {
    expect(d.items.every(i => i.unit === 'seconds')).toBe(true);
    const flags = d.items.map(i => !!lib.find(e => e.id === i.id)?.videoUrl);
    expect(flags.indexOf(false) === -1 || flags.slice(flags.indexOf(false)).every(f => !f)).toBe(true); // video ones come first
  }
});
test('water target ~35 ml/kg, +500 ml on a training day, bounded', () => {
  expect(waterTargetMl(70, false)).toBe(2450); expect(waterTargetMl(70, true)).toBe(2950); expect(waterTargetMl(null, false)).toBe(2100); expect(waterTargetMl(200, true)).toBe(5000);
});
import { buildWeek, nextStep, STEPS, minutesFor } from '../src/shared/plan';
test('week 1 starts very light; the step moves with completion % and feedback', () => {
  const w1 = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location: 'home', step: 0, bmi: 23, week: 1, sessionMinutes: 20 });
  expect(w1).toHaveLength(3);
  // week 1 is light in INTENSITY (short work intervals, long rest), not in length: it still fills the chosen minutes
  const later = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location: 'home', step: 7, bmi: 23, week: 1, sessionMinutes: 20 });
  for (const [i, d] of w1.entries()) {
    if (d.split === 'cardio') continue;
    expect(Math.max(...d.items.map(x => x.target))).toBeLessThanOrEqual(Math.max(...later[i].items.map(x => x.target)));
    expect(Math.min(...d.items.map(x => x.rest))).toBeGreaterThanOrEqual(Math.min(...later[i].items.map(x => x.rest)));
  }
  for (const d of w1) { expect(d.items.length).toBeGreaterThan(0); expect(minutesFor(d.items)).toBeLessThanOrEqual(20); }
  expect(w1.map(d => d.day)).toEqual([1, 2, 3]);
  expect(nextStep(0, [{ pct: 100 }, { pct: 95 }, { pct: 100, difficulty: 'too_easy' }]).change).toBe('up');
  expect(nextStep(3, [{ pct: 40 }, { pct: 55 }, { pct: 50 }]).change).toBe('down');
  expect(nextStep(3, [{ pct: 100, pain: true }]).step).toBe(2);
  expect(nextStep(2, [{ pct: 75 }, { pct: 80 }]).change).toBe('same');
  expect(nextStep(3, [{ pct: 100, difficulty: 'too_easy' }, { pct: 100, difficulty: 'too_easy' }], true).step).toBe(3); // screened users are capped
});
test('sessions fit the time the user chose', () => {
  const short = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location: 'home', step: 7, bmi: 23, week: 2, sessionMinutes: 10 });
  for (const d of short) expect(minutesFor(d.items)).toBeLessThanOrEqual(13);
  const w2 = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location: 'home', step: 0, bmi: 23, week: 2, sessionMinutes: 20 });
  expect(w2.map(d => d.day)).toEqual([4, 5, 6]);
  // regression: 45 min chosen used to give a 6-minute Day 1 (3 moves x 1 set)
  for (const step of [0, 3, 7]) for (const location of ['home', 'gym'] as const) {
    const w = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location, step, bmi: 23, week: 1, sessionMinutes: 45 });
    for (const d of w) { expect(d.items.length).toBeGreaterThan(0); expect(minutesFor(d.items)).toBeLessThanOrEqual(step < 2 ? 25 : 45); expect(d.items.every(i=>i.sets<=4)).toBe(true); }
  }
});
import { adaptAfterSession, placeOf, programSplits as splitsAt } from '../src/shared/plan';
test('after every session: lighter on pain / too hard / low completion, heavier when easy and complete', () => {
  expect(adaptAfterSession(3, { pct: 100, pain: true })).toMatchObject({ change: 'down', reason: 'pain', step: 2 });
  expect(adaptAfterSession(3, { pct: 90, difficulty: 'too_hard' })).toMatchObject({ change: 'down', reason: 'too_hard' });
  expect(adaptAfterSession(3, { pct: 40, difficulty: 'right' })).toMatchObject({ change: 'down', reason: 'low_completion' });
  expect(adaptAfterSession(3, { pct: 95, difficulty: 'too_easy' })).toMatchObject({ change: 'up', step: 4 });
  expect(adaptAfterSession(3, { pct: 80, difficulty: 'right' })).toMatchObject({ change: 'same', reason: 'on_track' });
  expect(adaptAfterSession(0, { pct: 30 })).toMatchObject({ change: 'same', step: 0 }); // never below the first step
  expect(adaptAfterSession(3, { pct: 100, difficulty: 'too_easy' }, true).step).toBe(3);     // screened users capped
});
test('clear home / gym split; home has more cardio; gym days use gym equipment', () => {
  expect(placeOf({ equipment: ['machine'] })).toBe('gym'); expect(placeOf({ equipment: ['body weight'] })).toBe('home'); expect(placeOf({ equipment: ['dumbbell', 'bench'] })).toBe('gym');
  expect(splitsAt('personal', 4, 'home').filter(s => s === 'cardio')).toHaveLength(2);
  expect(splitsAt('personal', 4, 'gym').includes('cardio')).toBe(false);
  const gym = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location: 'gym', step: 4, bmi: 24, week: 1, sessionMinutes: 45 });
  const ids = gym.flatMap(d => d.items.map(i => i.id));
  expect(ids.some(id => placeOf(lib.find(e => e.id === id)!) === 'gym')).toBe(true);
  const home = buildWeek({ program: 'personal', daysPerWeek: 3, library: lib, location: 'home', step: 4, bmi: 24, week: 1, sessionMinutes: 45 });
  expect(home.flatMap(d => d.items).every(i => placeOf(lib.find(e => e.id === i.id)!) === 'home')).toBe(true);
});
