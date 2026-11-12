// Shared, deterministic programme logic (client + server): muscle groups, training splits,
// a weekly plan built only from existing exercises, and general nutrition guidance.
// Nothing here is medical advice; numbers are common evidence-based ranges for healthy adults.
import { doseFor, HOME_EQUIPMENT, type Level } from './dose';

export type ProgramExercise = { id: string; videoUrl?: string | null; primaryMuscles?: string[]; secondaryMuscles?: string[]; equipment: string[]; difficulty: string; tags?: string[]; tracking?: string; guidance?: { home?: unknown[]; perSide?: boolean } };
export const MUSCLE_GROUPS = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  arms: ['biceps', 'triceps', 'forearm'],
  legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductor', 'abductors', 'left-soleus', 'right-soleus'],
  core: ['abs', 'obliques'],
} as const;
export type MuscleGroup = keyof typeof MUSCLE_GROUPS;
// Muscles commonly trained together in one session.
export const SPLITS = {
  push: ['chest', 'front-deltoids', 'triceps'],
  pull: ['upper-back', 'back-deltoids', 'biceps', 'trapezius', 'forearm'],
  legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductor', 'abductors'],
  core: ['abs', 'obliques', 'lower-back'],
} as const;
export type Split = keyof typeof SPLITS | 'full' | 'upper' | 'lower';
const SPLIT_MUSCLES: Record<Split, readonly string[]> = { ...SPLITS, full: [...SPLITS.push, ...SPLITS.pull, ...SPLITS.legs, ...SPLITS.core], upper: [...SPLITS.push, ...SPLITS.pull], lower: [...SPLITS.legs, ...SPLITS.core] };
const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const isPrep = (e: ProgramExercise) => (e.tags ?? []).some(t => t === 'warmup' || t === 'cooldown');
export function availableAt(e: ProgramExercise, location: 'home' | 'gym') {
  return location === 'gym' || (((e.guidance?.home?.length ?? 0) > 0) && e.equipment.every(q => HOME_EQUIPMENT.includes(q) || q === 'bench'));
}
export function exercisesFor(muscles: readonly string[], library: ProgramExercise[], location?: 'home' | 'gym') {
  return library.filter(e => !isPrep(e) && (e.primaryMuscles ?? []).some(m => muscles.includes(m)) && (!location || availableAt(e, location)))
    .sort((a, b) => (rank[a.difficulty] ?? 1) - (rank[b.difficulty] ?? 1) || (b.secondaryMuscles?.length ?? 0) - (a.secondaryMuscles?.length ?? 0) || a.id.localeCompare(b.id));
}
// Pick up to `max` exercises that cover as many different target muscles as possible (compound first), at or below the user level.
export function pickSession(split: Split, library: ProgramExercise[], location: 'home' | 'gym', level: Level, max = 5) {
  const targets = SPLIT_MUSCLES[split];
  const pool = exercisesFor(targets, library, location).filter(e => (rank[e.difficulty] ?? 1) <= rank[level])
    .sort((a, b) => (b.primaryMuscles?.length ?? 0) + (b.secondaryMuscles?.length ?? 0) * 0.5 - ((a.primaryMuscles?.length ?? 0) + (a.secondaryMuscles?.length ?? 0) * 0.5)
      || Number(location === 'gym') * (Number(b.equipment.some(q => q !== 'body weight')) - Number(a.equipment.some(q => q !== 'body weight'))) || a.id.localeCompare(b.id));
  const chosen: ProgramExercise[] = [], covered = new Set<string>();
  while (chosen.length < max) {
    const next = pool.filter(e => !chosen.includes(e)).sort((a, b) => (b.primaryMuscles ?? []).filter(m => targets.includes(m) && !covered.has(m)).length - (a.primaryMuscles ?? []).filter(m => targets.includes(m) && !covered.has(m)).length)[0];
    if (!next) break;
    chosen.push(next); (next.primaryMuscles ?? []).forEach(m => covered.add(m));
  }
  return chosen.map(e => ({ exercise: e, dose: doseFor({ tracking: e.tracking, equipment: e.equipment, tags: e.tags }, level, !!e.guidance?.perSide) }));
}
// Weekly rotation by training days per week (rest days in between are healthy, never "missed").
export function weeklySplits(days: number): Split[] {
  const table: Record<number, Split[]> = { 1: ['full'], 2: ['upper', 'lower'], 3: ['push', 'pull', 'legs'], 4: ['push', 'pull', 'legs', 'core'], 5: ['push', 'pull', 'legs', 'upper', 'lower'], 6: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
  return table[Math.max(1, Math.min(6, days))];
}
export function weeklyPlan(weekdays: number[], daysPerWeek: number) {
  const days = (weekdays.length ? [...weekdays].sort((a, b) => a - b) : [0, 2, 4, 1, 3, 5].slice(0, daysPerWeek).sort((a, b) => a - b));
  const splits = weeklySplits(days.length);
  return Array.from({ length: 7 }, (_, weekday) => { const i = days.indexOf(weekday); return { weekday, split: i >= 0 ? splits[i % splits.length] : null }; });
}

// General nutrition guidance from body weight and goal (healthy adults). Not a diet prescription.
export type Goal = 'general_fitness' | 'build_strength' | 'build_muscle' | 'improve_endurance';
export function nutritionGuidance(weightKg: number | null, goal: Goal) {
  const protein = { general_fitness: [1.2, 1.6], build_strength: [1.6, 2.0], build_muscle: [1.6, 2.2], improve_endurance: [1.2, 1.6] }[goal] ?? [1.2, 1.6];
  return {
    goal, weightKg,
    proteinG: weightKg ? [Math.round(weightKg * protein[0]), Math.round(weightKg * protein[1])] : null,
    proteinPerKg: protein,
    waterL: weightKg ? [Math.round(weightKg * 0.03 * 10) / 10, Math.round(weightKg * 0.035 * 10) / 10] : null,
    energy: goal === 'build_muscle' ? 'small_surplus' : goal === 'improve_endurance' ? 'carbs_around_training' : 'maintenance',
  };
}

// ---------- Exercise recommendations (evidence-informed, deterministic) ----------
// Movement pattern per canonical exercise (similar in spirit to the force/mechanic fields of open exercise datasets).
export const PATTERN: Record<string, string> = {
  'barbell-reverse-lunge': 'lunge', 'cable-face-pull': 'rear-delt', 'bench-hop': 'plyo', 'standing-calf-raise': 'calf', 'dead-bug': 'core-anti-ext',
  'dumbbell-bench-press': 'push-h', 'dumbbell-bent-over-row': 'pull-h', 'dumbbell-biceps-curl': 'biceps', 'forward-lunge': 'lunge', 'glute-bridge': 'hinge',
  'push-up': 'push-h', 'walking-lunge': 'lunge', 'bodyweight-squat': 'squat', 'barbell-back-squat': 'squat', 'forearm-plank': 'core-anti-ext',
  'side-plank': 'core-anti-lat', 'bird-dog': 'core-anti-rot', 'wall-push-up': 'push-h', 'knee-push-up': 'push-h', 'dumbbell-shoulder-press': 'push-v',
  'dumbbell-lateral-raise': 'shoulder-iso', 'band-row': 'pull-h', 'bodyweight-hip-hinge': 'hinge', 'low-step-up': 'lunge', 'seated-knee-lift': 'core-flex',
  'wall-sit': 'squat', 'heel-raise-balance': 'calf', 'lat-pulldown': 'pull-v', 'seated-cable-row': 'pull-h', 'triceps-pushdown': 'triceps',
  'pec-deck': 'chest-iso', 'machine-chest-press': 'push-h', 'leg-press': 'squat', 'leg-extension': 'quad-iso', 'seated-leg-curl': 'ham-iso',
  'barbell-bench-press': 'push-h', 'barbell-deadlift': 'hinge', 'romanian-deadlift': 'hinge', 'barbell-bent-over-row': 'pull-h', 'cable-crossover': 'chest-iso',
  crunch: 'core-flex', superman: 'back-ext', 'dumbbell-hammer-curl': 'biceps', 'bench-dip': 'triceps',
  // gym-beginner additions
  'hip-adduction-machine': 'quad-iso', 'machine-shoulder-press': 'push-v', 'assisted-pull-up-machine': 'pull-v', 'lying-leg-curl': 'ham-iso',
  'smith-machine-squat': 'squat', 'hack-squat-machine': 'squat', 'seated-calf-raise-machine': 'calf', 'cable-biceps-curl': 'biceps',
  'incline-dumbbell-press': 'push-h', 'dumbbell-triceps-kickback': 'triceps', 'overhead-dumbbell-triceps-extension': 'triceps', 'barbell-hip-thrust': 'hinge',
  'pull-up': 'pull-v', 'bent-over-rear-delt-raise': 'rear-delt', 'barbell-biceps-curl': 'biceps',
};
const ISOLATION = new Set(['biceps', 'triceps', 'chest-iso', 'shoulder-iso', 'quad-iso', 'ham-iso', 'calf', 'rear-delt']);
// pattern -> complementary patterns + reason. Basis: ACSM 2009 progression position stand (multi-joint before single-joint,
// balanced agonist/antagonist training), WHO 2020 (all major muscle groups), core training literature (anti-extension/-lateral/-rotation).
const COMPLEMENT: Record<string, [string, string][]> = {
  'push-h': [['pull-h', 'BALANCE_ANTAGONIST'], ['triceps', 'SYNERGIST_FINISHER'], ['core-anti-ext', 'CORE_SUPPORT']],
  'push-v': [['pull-v', 'BALANCE_ANTAGONIST'], ['shoulder-iso', 'SAME_REGION_ISOLATION'], ['triceps', 'SYNERGIST_FINISHER']],
  'pull-h': [['push-h', 'BALANCE_ANTAGONIST'], ['pull-v', 'OTHER_ANGLE'], ['biceps', 'SYNERGIST_FINISHER'], ['rear-delt', 'POSTURE']],
  'pull-v': [['push-v', 'BALANCE_ANTAGONIST'], ['pull-h', 'OTHER_ANGLE'], ['biceps', 'SYNERGIST_FINISHER']],
  squat: [['hinge', 'BALANCE_ANTAGONIST'], ['lunge', 'SINGLE_LEG'], ['calf', 'SAME_REGION_ISOLATION'], ['core-anti-ext', 'CORE_SUPPORT']],
  hinge: [['squat', 'BALANCE_ANTAGONIST'], ['ham-iso', 'SAME_REGION_ISOLATION'], ['core-anti-ext', 'CORE_SUPPORT']],
  lunge: [['hinge', 'BALANCE_ANTAGONIST'], ['squat', 'COMPOUND_FIRST'], ['core-anti-lat', 'CORE_SUPPORT']],
  'quad-iso': [['ham-iso', 'BALANCE_ANTAGONIST'], ['squat', 'COMPOUND_FIRST']],
  'ham-iso': [['quad-iso', 'BALANCE_ANTAGONIST'], ['hinge', 'COMPOUND_FIRST']],
  'chest-iso': [['push-h', 'COMPOUND_FIRST'], ['pull-h', 'BALANCE_ANTAGONIST']],
  'shoulder-iso': [['push-v', 'COMPOUND_FIRST'], ['rear-delt', 'POSTURE']],
  'rear-delt': [['pull-h', 'COMPOUND_FIRST'], ['push-h', 'BALANCE_ANTAGONIST']],
  biceps: [['pull-v', 'COMPOUND_FIRST'], ['triceps', 'BALANCE_ANTAGONIST']],
  triceps: [['push-h', 'COMPOUND_FIRST'], ['biceps', 'BALANCE_ANTAGONIST']],
  'core-anti-ext': [['core-anti-lat', 'CORE_VARIETY'], ['core-anti-rot', 'CORE_VARIETY'], ['back-ext', 'BALANCE_ANTAGONIST']],
  'core-anti-lat': [['core-anti-ext', 'CORE_VARIETY'], ['core-anti-rot', 'CORE_VARIETY']],
  'core-anti-rot': [['core-anti-ext', 'CORE_VARIETY'], ['core-anti-lat', 'CORE_VARIETY']],
  'core-flex': [['back-ext', 'BALANCE_ANTAGONIST'], ['core-anti-ext', 'CORE_VARIETY']],
  'back-ext': [['core-flex', 'BALANCE_ANTAGONIST'], ['hinge', 'COMPOUND_FIRST']],
  calf: [['squat', 'COMPOUND_FIRST'], ['lunge', 'SINGLE_LEG']],
  plyo: [['squat', 'COMPOUND_FIRST'], ['hinge', 'BALANCE_ANTAGONIST']],
};
export type Recommendation = { id: string; reason: string };
export function patternOf(e: { canonicalId?: string | null; id: string }) { return PATTERN[e.canonicalId ?? ''] ?? PATTERN[e.id] ?? 'other'; }
export function recommendFor<T extends ProgramExercise & { canonicalId?: string | null }>(exercise: T, library: T[], location: 'home' | 'gym', level: Level) {
  const pattern = patternOf(exercise);
  const usable = library.filter(e => e.id !== exercise.id && !isPrep(e) && availableAt(e, location) && (rank[e.difficulty] ?? 1) <= rank[level]);
  const primary = exercise.primaryMuscles ?? [];
  const compound = (e: T) => !ISOLATION.has(patternOf(e));
  const score = (e: T) => (compound(e) ? 2 : 0) + (patternOf(e) !== pattern ? 1 : 0) + (e.secondaryMuscles?.length ?? 0) * 0.1;
  const sameMuscle: Recommendation[] = usable.filter(e => (e.primaryMuscles ?? []).some(m => primary.includes(m)))
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)).slice(0, 3)
    .map(e => ({ id: e.id, reason: patternOf(e) !== pattern ? (compound(e) ? 'OTHER_ANGLE' : 'SAME_REGION_ISOLATION') : 'SAME_PATTERN_VARIATION' }));
  const taken = new Set(sameMuscle.map(r => r.id));
  const complementary: Recommendation[] = [];
  for (const [p, reason] of COMPLEMENT[pattern] ?? []) {
    const pick = usable.filter(e => patternOf(e) === p && !taken.has(e.id)).sort((a, b) => (rank[b.difficulty] ?? 1) - (rank[a.difficulty] ?? 1) || a.id.localeCompare(b.id))[0];
    if (pick) { complementary.push({ id: pick.id, reason }); taken.add(pick.id); }
  }
  return { pattern, compound: compound(exercise), sameMuscle, complementary: complementary.slice(0, 4) };
}
export const EVIDENCE = [
  'ACSM Position Stand: Progression Models in Resistance Training for Healthy Adults (Medicine & Science in Sports & Exercise, 2009).',
  'WHO Guidelines on Physical Activity and Sedentary Behaviour (2020): muscle-strengthening activity for all major muscle groups on 2 or more days a week.',
  'Schoenfeld, Ogborn & Krieger (2017), Journal of Sports Sciences: dose-response of weekly resistance-training volume and muscle growth.',
  'Reviews on exercise variation (e.g. Kassiano et al., 2022): using more than one exercise per muscle can develop it more completely.',
] as const;
export const NUTRITION_EVIDENCE = [
  'International Society of Sports Nutrition position stand: protein and exercise (Jäger et al., 2017): 1.4–2.0 g/kg/day for active people.',
  'Morton et al. (2018), British Journal of Sports Medicine meta-analysis: gains from extra protein level off around 1.6 g/kg/day.',
  'ACSM, Academy of Nutrition and Dietetics & Dietitians of Canada joint position: Nutrition and Athletic Performance (2016).',
  'WHO Healthy diet fact sheet: at least 400 g of fruit and vegetables a day, free sugars below 10% of energy, salt below 5 g a day.',
  'EFSA (2010) adequate total water intake: about 2.0 L/day for women and 2.5 L/day for men, from drinks and food.',
] as const;
