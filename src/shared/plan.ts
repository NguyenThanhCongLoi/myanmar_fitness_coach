import {orderedSets} from './workout-sequence';
// Day-by-day training programmes (Day 1, Day 2, ...): the next day is simply the first one not yet done,
// so a missed calendar day is never "late". Built only from existing exercises; deterministic.
import { doseFor, type Level } from './dose';
import { estimatedSetSeconds, blockRest } from './workout-timing';
import { availableAt as inPlace, placeOf, hasCollectionVideo } from './exercise-place';
import { restFor, sessionBudget, type TrainingFactors } from './training-profile';
export { placeOf, GYM_EQUIPMENT } from './exercise-place';
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
export const CARDIO_IDS = ['curated-squat', 'dataset-1373', 'vid-sumo-squat', 'vid-reverse-lunge', 'vid-jumping-jacks', 'vid-high-knees', 'vid-butt-kicks', 'vid-shadow-boxing', 'vid-knee-to-elbow', 'vid-mountain-climbers', 'curated-march', 'dataset-3470', 'dataset-1460', 'curated-seated-march', 'curated-heel-walk', 'core-164'];
// Beginner machine circuit: one movement per major muscle group, machines guide the path.
export const MACHINE_FULL = ['gym-leg-press', 'gym-machine-chest-press', 'gym-lat-pulldown', 'gym-seated-cable-row', 'gym-machine-shoulder-press', 'gym-lying-leg-curl', 'gym-leg-extension'];

export function bmiOf(weightKg?: number | null, heightCm?: number | null) {
  if (!weightKg || !heightCm) return null;
  return Math.round(weightKg / (heightCm / 100) ** 2 * 10) / 10;
}
export function bmiBand(bmi: number | null): BmiBand | null {
  if (bmi === null) return null;
  return bmi < 18.5 ? 'under' : bmi < 25 ? 'normal' : bmi < 30 ? 'over' : 'obese';
}
// At home there is more cardio: alternate strength and cardio days.
const HOME_SPLITS: Record<number, DaySplit[]> = { 1: ['full'], 2: ['full', 'full'], 3: ['full', 'cardio', 'full'], 4: ['full', 'cardio', 'full', 'cardio'], 5: ['full', 'cardio', 'full', 'cardio', 'full'], 6: ['full', 'cardio', 'full', 'cardio', 'full', 'core'] };
export function programSplits(program: ProgramKey, daysPerWeek: number, location: 'home' | 'gym' = 'gym'): DaySplit[] {
  if (program === 'personal' && location === 'home') return HOME_SPLITS[Math.max(1, Math.min(6, daysPerWeek))];
  if (program === 'four_day') return ['chest', 'back', 'legs', location === 'gym' ? 'full' : 'cardio'];
  if (program === 'gym_beginner') return ['machine_full', 'machine_full', 'machine_full'];
  return weeklySplits(daysPerWeek).map(s=>location==='gym'&&s==='core'?'full':s);
}
// Cardio volume follows BMI: start gentler and lower-impact with a higher BMI, build up over weeks.
export function cardioSettings(band: BmiBand | null) {
  void band; // Body size does not establish fitness capability. Profile/feedback sets work and recovery.
  return { minutes: 25, work: 40, rest: 20 };
}
const num = (v: string) => Number(String(v).split('–').pop()) || 10;
function strengthItems(split: DaySplit, library: ProgramExercise[], location: 'home' | 'gym', level: Level, priorityMuscles: readonly string[] = []): PlanItem[] {
  library = library.filter(e=>inPlace(e,location)&&hasCollectionVideo(e));
  if (split === 'machine_full') {
    const ids = location === 'gym' ? MACHINE_FULL : [];
    const chosen = ids.map(id => library.find(e => e.id === id)).filter((e): e is ProgramExercise => !!e);
    if (chosen.length >= 4) return chosen.map(e => toItem(e, doseFor({ tracking: e.tracking, equipment: e.equipment, tags: e.tags }, 'beginner', !!e.guidance?.perSide)));
    split = 'full';
  }
  const base: Split = split === 'chest' ? 'push' : split === 'back' ? 'pull' : (split as Split);
  // At home, follow-along needs a demo: use exercises with video first; fill with others only if too few.
  if (location === 'home') {
    const homeLib = library.filter(e => inPlace(e, 'home') && hasCollectionVideo(e));
    const withVideo = pickSession(base, homeLib.filter(e => e.videoUrl), location, level, 6, priorityMuscles);
    const more = withVideo.length >= 5 ? [] : pickSession(base, homeLib, location, level, 6, priorityMuscles).filter(x => !withVideo.some(v => v.exercise.id === x.exercise.id));
    let chosen = [...withVideo, ...more].slice(0, 6);
    return chosen.map(x => toItem(x.exercise, x.dose));
  }
  // Gym: use gym equipment (machines, cables, barbells, dumbbells on a bench); fill with others only if too few.
  const gymLib = library.filter(e => inPlace(e, 'gym'));
  const gymPick = pickSession(base, gymLib, location, level, 5, priorityMuscles);
  if (gymPick.length >= 3) return gymPick.map(x => toItem(x.exercise, x.dose));
  return gymPick.map(x => toItem(x.exercise, x.dose));
}
function toItem(e: ProgramExercise, d: { sets: string; target: string; unit: string; restSeconds: string; perSide: boolean }): PlanItem {
  return { id: e.id, sets: Math.min(4, num(d.sets)), target: num(d.target), unit: d.unit === 'reps' ? 'reps' : 'seconds', rest: Math.max(15, num(d.restSeconds)), perSide: d.perSide };
}
function cardioItems(library: ProgramExercise[], location: 'home' | 'gym', band: BmiBand | null, lowImpact: boolean, level: Level = 'beginner'): PlanItem[] {
  const c = cardioSettings(band);
  const moves = CARDIO_IDS.map(id => library.find(e => e.id === id)).filter((e): e is ProgramExercise => !!e && availableAt(e, location) && ['beginner','intermediate','advanced'].indexOf(e.difficulty) <= ['beginner','intermediate','advanced'].indexOf(level) && !(lowImpact && (e.tags ?? []).includes('jumping')))
    .sort((a, b) => Number(!!b.videoUrl) - Number(!!a.videoUrl)).slice(0, 6);
  if (!moves.length) return [];
  const rounds = Math.min(3, Math.max(1, Math.round(c.minutes * 60 / (moves.length * (c.work + c.rest)))));
  return moves.map(e => ({ id: e.id, sets: rounds, target: c.work, unit: 'seconds', rest: c.rest, perSide: false }));
}
/** Fill only within the time ceiling and bounded starting volume; never invent extra minutes. */
export function fillToMinutes(items: PlanItem[], minutes: number, step: number): PlanItem[] {
  let out = items;
  const maxSets = step < 2 ? 3 : 4, maxWork = step < 2 ? 30 : 60;
  for (let guard = 0; guard < 100; guard++) {
    let grown = out;
    for (let index=0;index<out.length;index++) {
      if(out[index].sets>=maxSets)continue;
      const candidate=out.map((i,n)=>n===index?{...i,sets:i.sets+1}:i);
      if(secondsFor(candidate)<=minutes*60){grown=candidate;break;}
    }
    if(grown===out)for(let index=0;index<out.length;index++) {
      if(out[index].unit!=='seconds'||out[index].target>=maxWork)continue;
      const candidate=out.map((i,n)=>n===index?{...i,target:Math.min(maxWork,i.target+5)}:i);
      if(secondsFor(candidate)<=minutes*60){grown=candidate;break;}
    }
    if(grown===out)break;
    out = grown;
  }
  return out;
}
export function secondsFor(items: PlanItem[]) {
  if (!items.length) return 0;
  const timed = items.every(i=>i.unit==='seconds');
  const rows=items.map(i=>({...i,exerciseId:i.id,sets:i.sets*(i.perSide&&i.unit==='seconds'?2:1)}));
  const blocks=orderedSets(rows,timed).map(({row,setIndex})=>({i:row,index:setIndex}));
  return 10 + blocks.reduce((n,b,index)=>{
    const next=blocks[index+1];
    const rest=next?blockRest(b.i.rest,b.index,b.i.unit==='seconds',next.i.id!==b.i.id,timed&&Math.floor(next.index/(next.i.perSide?2:1))>Math.floor(b.index/(b.i.perSide?2:1))):0;
    return n+(b.i.unit==='seconds'?b.i.target:estimatedSetSeconds(b.i.target,b.i.perSide))+rest;
  },0);
}
export function minutesFor(items: PlanItem[]) { return Math.ceil(secondsFor(items) / 60); }
export function trimToMinutes(items: PlanItem[], minutes: number) {
  let out=items;
  while (secondsFor(out)>minutes*60 && out.some(it=>it.sets>1)) out=out.map(it=>({...it,sets:Math.max(1,it.sets-1)}));
  while (secondsFor(out)>minutes*60 && out.length>1) out=out.slice(0,-1);
  return secondsFor(out)>minutes*60?[]:out;
}
/** Legacy media helper: never fall back to an unrelated catalogue when clips are missing. */
export const isOwnerVideo = (e: { videoUrl?: string | null }) => !!e.videoUrl && (/\/media\/video\/vid-/.test(e.videoUrl) || /-owner\.mp4$/.test(e.videoUrl));
export function ownerVideoLibrary<T extends { videoUrl?: string | null }>(library: T[]): T[] { const own = library.filter(isOwnerVideo); return own; }
export function buildPlan(o: { program: ProgramKey; daysPerWeek: number; library: ProgramExercise[]; location: 'home' | 'gym'; level: Level; bmi: number | null; weeks?: number; lowImpact?: boolean; priorityMuscles?: readonly string[]; goal?: string; weightGoal?: string }): PlanDay[] {
  o = { ...o, library: o.library.filter(e => inPlace(e, o.location)) };
  const splits = o.program==='personal' && o.location==='home' && ['build_strength','build_muscle'].includes(o.goal??'') ? (o.daysPerWeek<=3?Array.from({length:o.daysPerWeek},()=> 'full' as DaySplit):(['upper','lower','cardio','upper','lower','core'] as DaySplit[]).slice(0,o.daysPerWeek)) : programSplits(o.program, o.daysPerWeek, o.location), band = bmiBand(o.bmi);
  const lowImpact = !!o.lowImpact;
  const lib = lowImpact ? o.library.filter(e => !(e.tags ?? []).includes('jumping')) : o.library;
  const perSplit = new Map<DaySplit, PlanItem[]>();
  const labels=new Map<DaySplit,DaySplit>();
  for (const s of new Set(splits)) {
    let items = s === 'cardio' ? cardioItems(lib, o.location, band, lowImpact, o.level) : strengthItems(s, lib, o.location, o.level, o.priorityMuscles);
    let actual=s;
    if(s!=='full'&&s!=='cardio'&&items.length<2){items=strengthItems('full',lib,o.location,o.level,o.priorityMuscles);actual='full';}
    labels.set(s,actual);
    if (o.location === 'home' && s !== 'cardio') items = items.map(i => ({ ...i, unit: 'seconds' as const, target: i.unit === 'seconds' ? i.target : HOME_WORK[o.level], sets: Math.min(3, i.sets), rest: 20 }));
    perSplit.set(s, items);
  }
  const weeks = o.weeks ?? 4, days: PlanDay[] = [];
  for (let w = 0; w < weeks; w++) splits.forEach((split,index) => {
    const pool = perSplit.get(split) ?? [];
    const offset = pool.length ? index % pool.length : 0;
    const items = [...pool.slice(offset),...pool.slice(0,offset)];
    if (items.length) days.push({ day: days.length + 1, week: w + 1, split:labels.get(split)??split, items, minutes: minutesFor(items) });
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
export function buildWeek(o: { program: ProgramKey; daysPerWeek: number; library: ProgramExercise[]; location: 'home' | 'gym'; step: number; bmi: number | null; week: number; sessionMinutes: number; lowImpact?: boolean; priorityMuscles?: readonly string[]; factors?: TrainingFactors; splitOverride?: DaySplit; recentExerciseIds?: string[] }): PlanDay[] {
  const recent=new Map<string,number>();for(const id of o.recentExerciseIds??[])recent.set(id,(recent.get(id)??0)+1);
  const rank=(id:string)=>[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))%997,o.week*17)%97;
  o={...o,library:o.library.map(e=>({...e,selectionRank:(recent.get(e.id)??0)*100+rank(e.id)}))};
  const deload = o.week % 4 === 0 && o.step > 0; // every 4th week is a lighter recovery week
  const s = STEPS[Math.max(0, Math.min(MAX_STEP, o.step - (deload ? 1 : 0)))];
  const base = buildPlan({ program: o.program, daysPerWeek: o.daysPerWeek, library: o.library, location: o.location, level: s.maxLevel, bmi: o.bmi, weeks: 1, lowImpact: o.lowImpact, priorityMuscles: o.priorityMuscles, goal:o.factors?.goal,weightGoal:o.factors?.weightGoal });
  const factors = o.factors ?? {};
  const budget = sessionBudget(o.sessionMinutes, o.step, factors);
  const chosenBase = o.splitOverride ? buildPlan({ program: 'personal', daysPerWeek: 1, library: o.library, location: o.location, level: s.maxLevel, bmi: o.bmi, weeks: 1, lowImpact: o.lowImpact, priorityMuscles: o.priorityMuscles }).map(d => ({ ...d, split: o.splitOverride!, items: (o.splitOverride === 'cardio' ? cardioItems(o.library.filter(e => inPlace(e, o.location)), o.location, bmiBand(o.bmi), !!o.lowImpact, s.maxLevel) : strengthItems(o.splitOverride!, o.library.filter(e => inPlace(e, o.location)), o.location, s.maxLevel, o.priorityMuscles)) })) : base;
  return chosenBase.map((d, i) => {
    const cardioScale = 0.5 + 0.1 * Math.min(5, Math.max(0, o.step - (deload ? 1 : 0)));
    // how many moves: the chosen length decides (45 min -> 6 moves, 25 min -> 5); the step only sets intensity
    const moves = Math.max(s.exercises, o.sessionMinutes >= 40 ? 6 : o.sessionMinutes >= 25 ? 5 : s.exercises);
    const rotation = d.items.length ? (o.week-1) % d.items.length : 0;
    d = {...d,items:[...d.items.slice(rotation),...d.items.slice(0,rotation)]};
    let items = d.split === 'cardio' ? d.items.slice(0, Math.max(2, moves)).map(it => ({ ...it, sets: Math.max(1, Math.round(it.sets * cardioScale)), target: Math.min(it.target, s.work + 10) })) : d.items.slice(0, moves).map(it => o.location === 'home' || it.unit === 'seconds'
      ? { ...it, unit: 'seconds' as const, sets: s.sets, target: s.work, rest: s.rest }
      : { ...it, sets: s.sets, rest: Math.max(45, it.rest) });
    const byId = new Map(o.library.map(e => [e.id, e]));
    items = items.map(it => ({ ...it, perSide: o.location === 'home' ? it.id === 'curated-bird-dog' : it.perSide,
      target: it.unit === 'reps' ? (factors.goal === 'build_strength' ? 8 : 10) : it.target,
      rest: restFor({...byId.get(it.id),equipment:byId.get(it.id)?.equipment??[],targetReps:it.unit==='reps'?it.target:undefined}, o.location, factors, o.step) }));
    items = fillToMinutes(items, budget, o.step);
    items = trimToMinutes(items, budget);
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
