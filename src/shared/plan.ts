// Day-by-day training programmes (Day 1, Day 2, ...): the next day is simply the first one not yet done,
// so a missed calendar day is never "late". Built only from existing exercises; deterministic.
import { doseFor, type Level } from './dose';
import { pickSession, weeklySplits, availableAt, type ProgramExercise, type Split } from './program';

export const PROGRAMS = ['personal', 'four_day', 'gym_beginner'] as const;
export type ProgramKey = typeof PROGRAMS[number];
export type DaySplit = Split | 'chest' | 'back' | 'cardio' | 'machine_full';
export type PlanItem = { id: string; sets: number; target: number; unit: 'reps' | 'seconds'; rest: number; perSide: boolean; swappedFrom?: string; weightKg?: number; loadNote?: string };
// At home every exercise is followed by time (watch the video, move until the timer ends); in the gym it is reps x weight.
const HOME_WORK: Record<Level, number> = { beginner: 30, intermediate: 40, advanced: 45 };
export type PlanDay = { day: number; week: number; split: DaySplit; items: PlanItem[]; minutes: number };
export type BmiBand = 'under' | 'normal' | 'over' | 'obese';

// Low-impact cardio moves that need no equipment (jumping ones are skipped for higher BMI / screening).
export const CARDIO_IDS = ['curated-march', 'curated-step-up', 'dataset-3470', 'dataset-1460', 'curated-seated-march', 'curated-heel-walk', 'core-164'];
// Beginner machine circuit: one movement per major muscle group, machines guide the path.
export const MACHINE_FULL = ['gym-leg-press', 'gym-machine-chest-press', 'gym-lat-pulldown', 'gym-seated-cable-row', 'gym-machine-shoulder-press', 'gym-lying-leg-curl', 'curated-plank'];

export function bmiOf(weightKg?: number | null, heightCm?: number | null) {
  if (!weightKg || !heightCm) return null;
  return Math.round(weightKg / (heightCm / 100) ** 2 * 10) / 10;
}
export function bmiBand(bmi: number | null): BmiBand | null {
  if (bmi === null) return null;
  return bmi < 18.5 ? 'under' : bmi < 25 ? 'normal' : bmi < 30 ? 'over' : 'obese';
}
// Clear place labels: GYM = needs machine / cable / barbell; HOME = body weight, band, dumbbells, a bench or chair.
export const GYM_EQUIPMENT = ['machine', 'cable', 'barbell'];
export const placeOf = (e: { equipment: string[] }): 'home' | 'gym' => (e.equipment.some(q => GYM_EQUIPMENT.includes(q)) ? 'gym' : 'home');
// At home there is more cardio: alternate strength and cardio days.
const HOME_SPLITS: Record<number, DaySplit[]> = { 1: ['full'], 2: ['full', 'cardio'], 3: ['upper', 'cardio', 'lower'], 4: ['upper', 'cardio', 'lower', 'cardio'], 5: ['push', 'cardio', 'legs', 'pull', 'cardio'], 6: ['push', 'cardio', 'pull', 'legs', 'cardio', 'core'] };
export function programSplits(program: ProgramKey, daysPerWeek: number, location: 'home' | 'gym' = 'gym'): DaySplit[] {
  if (program === 'personal' && location === 'home') return HOME_SPLITS[Math.max(1, Math.min(6, daysPerWeek))];
  if (program === 'four_day') return ['chest', 'back', 'legs', 'cardio'];
  if (program === 'gym_beginner') return ['machine_full', 'machine_full', 'machine_full'];
  return weeklySplits(daysPerWeek);
}
// Cardio volume follows BMI: start gentler and lower-impact with a higher BMI, build up over weeks.
export function cardioSettings(band: BmiBand | null) {
  return band === 'obese' ? { minutes: 20, work: 40, rest: 20 } : band === 'over' ? { minutes: 25, work: 45, rest: 20 } : band === 'under' ? { minutes: 15, work: 40, rest: 20 } : { minutes: 25, work: 45, rest: 15 };
}
const num = (v: string) => Number(String(v).split('–').pop()) || 10;
function strengthItems(split: DaySplit, library: ProgramExercise[], location: 'home' | 'gym', level: Level, priorityMuscles: readonly string[] = []): PlanItem[] {
  if (split === 'machine_full') {
    const ids = location === 'gym' ? MACHINE_FULL : [];
    const chosen = ids.map(id => library.find(e => e.id === id)).filter((e): e is ProgramExercise => !!e);
    if (chosen.length >= 4) return chosen.map(e => toItem(e, doseFor({ tracking: e.tracking, equipment: e.equipment, tags: e.tags }, 'beginner', !!e.guidance?.perSide)));
    split = 'full';
  }
  const base: Split = split === 'chest' ? 'push' : split === 'back' ? 'pull' : (split as Split);
  // At home, follow-along needs a demo: use exercises with video first; fill with others only if too few.
  if (location === 'home') {
    const homeLib = library.filter(e => placeOf(e) === 'home');
    const withVideo = pickSession(base, homeLib.filter(e => e.videoUrl), location, level, 5, priorityMuscles);
    if (withVideo.length >= 3) return withVideo.map(x => toItem(x.exercise, x.dose));
    const more = pickSession(base, homeLib, location, level, 5, priorityMuscles).filter(x => !withVideo.some(v => v.exercise.id === x.exercise.id));
    return [...withVideo, ...more].slice(0, 5).map(x => toItem(x.exercise, x.dose));
  }
  // Gym: use gym equipment (machines, cables, barbells, dumbbells on a bench); fill with others only if too few.
  const gymLib = library.filter(e => placeOf(e) === 'gym' || e.equipment.includes('dumbbell'));
  const gymPick = pickSession(base, gymLib, location, level, 5, priorityMuscles);
  if (gymPick.length >= 3) return gymPick.map(x => toItem(x.exercise, x.dose));
  return pickSession(base, library, location, level, 5, priorityMuscles).map(x => toItem(x.exercise, x.dose));
}
function toItem(e: ProgramExercise, d: { sets: string; target: string; unit: string; restSeconds: string; perSide: boolean }): PlanItem {
  return { id: e.id, sets: Math.min(4, num(d.sets)), target: num(d.target), unit: d.unit === 'reps' ? 'reps' : 'seconds', rest: Math.max(15, num(d.restSeconds)), perSide: d.perSide };
}
function cardioItems(library: ProgramExercise[], location: 'home' | 'gym', band: BmiBand | null, lowImpact: boolean): PlanItem[] {
  const c = cardioSettings(band);
  const moves = CARDIO_IDS.map(id => library.find(e => e.id === id)).filter((e): e is ProgramExercise => !!e && availableAt(e, location) && !(lowImpact && (e.tags ?? []).includes('jumping')))
    .sort((a, b) => Number(!!b.videoUrl) - Number(!!a.videoUrl)).slice(0, 4);
  if (!moves.length) return [];
  const rounds = Math.max(2, Math.round(c.minutes * 60 / (moves.length * (c.work + c.rest))));
  return moves.map(e => ({ id: e.id, sets: rounds, target: c.work, unit: 'seconds', rest: c.rest, perSide: false }));
}
export function minutesFor(items: PlanItem[]) {
  const sec = items.reduce((n, i) => n + i.sets * ((i.unit === 'reps' ? i.target * 3 * (i.perSide ? 2 : 1) : i.target) + i.rest), 0);
  return Math.max(5, Math.round(sec / 60) + 3);
}
export function buildPlan(o: { program: ProgramKey; daysPerWeek: number; library: ProgramExercise[]; location: 'home' | 'gym'; level: Level; bmi: number | null; weeks?: number; lowImpact?: boolean; priorityMuscles?: readonly string[] }): PlanDay[] {
  const splits = programSplits(o.program, o.daysPerWeek, o.location), band = bmiBand(o.bmi);
  const lowImpact = !!o.lowImpact || band === 'obese';
  const lib = lowImpact ? o.library.filter(e => !(e.tags ?? []).includes('jumping')) : o.library;
  const perSplit = new Map<DaySplit, PlanItem[]>();
  for (const s of new Set(splits)) {
    let items = s === 'cardio' ? cardioItems(lib, o.location, band, lowImpact) : strengthItems(s, lib, o.location, o.level, o.priorityMuscles);
    if (o.location === 'home' && s !== 'cardio') items = items.map(i => ({ ...i, unit: 'seconds' as const, target: i.unit === 'seconds' ? i.target : HOME_WORK[o.level], sets: Math.min(3, i.sets), rest: 20 }));
    perSplit.set(s, items);
  }
  const weeks = o.weeks ?? 4, days: PlanDay[] = [];
  for (let w = 0; w < weeks; w++) splits.forEach(split => {
    const items = perSplit.get(split) ?? [];
    if (items.length) days.push({ day: days.length + 1, week: w + 1, split, items, minutes: minutesFor(items) });
  });
  return days;
}

// ---------- Progressive weekly plan ----------
// Week by week from very light: each step sets how many exercises, sets, work/rest seconds and the hardest level allowed.
// After a week is finished, its completion % and feedback move the step up, keep it, or move it down.
export type Step = { exercises: number; sets: number; work: number; rest: number; maxLevel: Level };
export const STEPS: Step[] = [
  { exercises: 3, sets: 1, work: 20, rest: 40, maxLevel: 'beginner' },     // 0 get to know the moves
  { exercises: 4, sets: 1, work: 25, rest: 35, maxLevel: 'beginner' },
  { exercises: 4, sets: 2, work: 25, rest: 30, maxLevel: 'beginner' },
  { exercises: 4, sets: 2, work: 30, rest: 25, maxLevel: 'beginner' },
  { exercises: 5, sets: 2, work: 35, rest: 25, maxLevel: 'intermediate' },
  { exercises: 5, sets: 3, work: 35, rest: 20, maxLevel: 'intermediate' },
  { exercises: 5, sets: 3, work: 40, rest: 20, maxLevel: 'intermediate' },
  { exercises: 6, sets: 3, work: 45, rest: 15, maxLevel: 'advanced' },
  { exercises: 6, sets: 3, work: 45, rest: 15, maxLevel: 'advanced' },
];
export const MAX_STEP = STEPS.length - 1;
export const startStep = (level: Level) => (level === 'advanced' ? 4 : level === 'intermediate' ? 2 : 0);
export type StepStage = 'intro' | 'build' | 'strong' | 'challenge';
export const stageOf = (step: number): StepStage => (step <= 1 ? 'intro' : step <= 3 ? 'build' : step <= 5 ? 'strong' : 'challenge');

// Next week's step from this week's results (completion % per finished day + post-workout feedback).
export function nextStep(step: number, results: { pct: number | null; difficulty?: string | null; pain?: boolean }[], capped = false) {
  const pcts = results.map(r => r.pct ?? 0), avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  const hard = results.filter(r => r.difficulty === 'too_hard').length, easy = results.filter(r => r.difficulty === 'too_easy').length, pain = results.some(r => r.pain);
  let change: 'up' | 'same' | 'down' = 'same';
  if (pain || avg < 60 || hard >= 2) change = 'down';
  else if (avg >= 85 && hard === 0 && (easy > 0 || avg >= 95)) change = 'up';
  const max = capped ? 3 : MAX_STEP;
  const next = Math.max(0, Math.min(max, step + (change === 'up' ? (easy >= 2 ? 2 : 1) : change === 'down' ? -1 : 0)));
  return { step: next, change: next > step ? 'up' as const : next < step ? 'down' as const : 'same' as const, avg: Math.round(avg) };
}

// One week of days at a given step; sessionMinutes caps exercises/sets so the session fits the time the user chose.
export function buildWeek(o: { program: ProgramKey; daysPerWeek: number; library: ProgramExercise[]; location: 'home' | 'gym'; step: number; bmi: number | null; week: number; sessionMinutes: number; lowImpact?: boolean; priorityMuscles?: readonly string[] }): PlanDay[] {
  const deload = o.week % 4 === 0 && o.step > 0; // every 4th week is a lighter recovery week
  const s = STEPS[Math.max(0, Math.min(MAX_STEP, o.step - (deload ? 1 : 0)))];
  const base = buildPlan({ program: o.program, daysPerWeek: o.daysPerWeek, library: o.library, location: o.location, level: s.maxLevel, bmi: o.bmi, weeks: 1, lowImpact: o.lowImpact, priorityMuscles: o.priorityMuscles });
  return base.map((d, i) => {
    const cardioScale = 0.5 + 0.1 * Math.min(5, Math.max(0, o.step - (deload ? 1 : 0)));
    let items = d.split === 'cardio' ? d.items.slice(0, Math.max(2, s.exercises)).map(it => ({ ...it, sets: Math.max(1, Math.round(it.sets * cardioScale)), target: Math.min(it.target, s.work + 10) })) : d.items.slice(0, s.exercises).map(it => o.location === 'home' || it.unit === 'seconds'
      ? { ...it, unit: 'seconds' as const, sets: s.sets, target: s.work, rest: s.rest }
      : { ...it, sets: s.sets, rest: Math.max(45, it.rest) });
    while (minutesFor(items) > o.sessionMinutes + 3 && items.some(it => it.sets > 1)) items = items.map(it => ({ ...it, sets: Math.max(1, it.sets - 1) }));
    while (minutesFor(items) > o.sessionMinutes + 3 && items.length > 2) items = items.slice(0, -1);
    return { ...d, day: (o.week - 1) * base.length + i + 1, week: o.week, items, minutes: minutesFor(items) };
  });
}

// After every session: heavier, same or lighter, with the reason shown to the user.
export type Adapt = { change: 'up' | 'same' | 'down'; reason: 'pain' | 'too_hard' | 'low_completion' | 'too_easy' | 'strong' | 'on_track'; step: number };
export function adaptAfterSession(step: number, r: { pct: number | null; difficulty?: string | null; pain?: boolean }, capped = false): Adapt {
  const pct = r.pct ?? 100, max = capped ? 3 : MAX_STEP;
  if (r.pain) return { change: step > 0 ? 'down' : 'same', reason: 'pain', step: Math.max(0, step - 1) };
  if (r.difficulty === 'too_hard') return { change: step > 0 ? 'down' : 'same', reason: 'too_hard', step: Math.max(0, step - 1) };
  if (pct < 50) return { change: step > 0 ? 'down' : 'same', reason: 'low_completion', step: Math.max(0, step - 1) };
  if (r.difficulty === 'too_easy' && pct >= 90) return { change: step < max ? 'up' : 'same', reason: 'too_easy', step: Math.min(max, step + 1) };
  return { change: 'same', reason: 'on_track', step };
}

// ---------- Muscle balance: warn when a week leans too much on arms/abs or skips a big muscle group ----------
export type MuscleGroup = 'arms' | 'core' | 'legs' | 'chest' | 'back' | 'shoulders';
export const MUSCLE_GROUP: Record<string, MuscleGroup> = {
  biceps: 'arms', triceps: 'arms', forearm: 'arms', abs: 'core', obliques: 'core', quadriceps: 'legs', gluteal: 'legs', hamstring: 'legs', calves: 'legs',
  chest: 'chest', 'upper-back': 'back', 'lower-back': 'back', 'back-deltoids': 'shoulders', 'front-deltoids': 'shoulders',
};
export type BalanceCode = 'BALANCE_TOO_MUCH_ARMS' | 'BALANCE_TOO_MUCH_CORE' | 'BALANCE_NO_LEGS' | 'BALANCE_NO_BACK' | 'BALANCE_NO_CHEST';
export type BalanceIssue = { code: BalanceCode; values?: Record<string, number> };
export const groupOf = (e: { primaryMuscles?: string[] }) => (e.primaryMuscles ?? []).map(m => MUSCLE_GROUP[m]).find(Boolean) ?? null;
/** Sets per muscle group (a set is split between an exercise's primary groups). Below 8 sets there is not enough data to judge. */
export function muscleBalance(work: { id: string; sets: number }[], lib: { id: string; primaryMuscles: string[] }[]) {
  const vol: Record<MuscleGroup, number> = { arms: 0, core: 0, legs: 0, chest: 0, back: 0, shoulders: 0 };
  const byId = new Map(lib.map(e => [e.id, e]));
  for (const w of work) {
    const groups = [...new Set((byId.get(w.id)?.primaryMuscles ?? []).map(m => MUSCLE_GROUP[m]).filter(Boolean))] as MuscleGroup[];
    for (const g of groups) vol[g] += w.sets / groups.length;
  }
  const total = Object.values(vol).reduce((a, b) => a + b, 0);
  const issues: BalanceIssue[] = [];
  if (total >= 8) {
    const pct = (g: MuscleGroup) => Math.round(vol[g] / total * 100);
    if (pct('arms') >= 35) issues.push({ code: 'BALANCE_TOO_MUCH_ARMS', values: { pct: pct('arms') } });
    if (pct('core') >= 35) issues.push({ code: 'BALANCE_TOO_MUCH_CORE', values: { pct: pct('core') } });
    if (vol.legs === 0) issues.push({ code: 'BALANCE_NO_LEGS' });
    if (vol.back === 0) issues.push({ code: 'BALANCE_NO_BACK' });
    if (vol.chest === 0 && total >= 12) issues.push({ code: 'BALANCE_NO_CHEST' });
  }
  return { total: Math.round(total), share: Object.fromEntries(Object.entries(vol).map(([k, v]) => [k, total ? Math.round(v / total * 100) : 0])) as Record<MuscleGroup, number>, issues };
}
