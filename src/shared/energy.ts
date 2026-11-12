// Energy balance estimates (not medical measurements).
// BMR: Mifflin-St Jeor (1990). Activity energy: MET x kg x hours (Compendium of Physical Activities, Ainsworth et al. 2011).
// ~7700 kcal per kg of body-weight change is a common approximation; real change varies.
export const ACTIVITIES = {
  walking: 3.5, brisk_walking: 4.3, running: 9.0, cycling: 6.8, swimming: 7.0, jump_rope: 11.0, football: 7.0,
  badminton: 5.5, dancing: 5.0, yoga: 2.5, housework: 3.0, stairs: 8.0,
} as const;
export type ActivityKind = keyof typeof ACTIVITIES;
export const STRENGTH_MET = 5.0; // general resistance training, moderate effort
export function activityKcal(kind: ActivityKind, minutes: number, weightKg: number) { return Math.round(ACTIVITIES[kind] * weightKg * minutes / 60); }
export function workoutKcal(minutes: number, weightKg: number) { return Math.round(STRENGTH_MET * weightKg * minutes / 60); }
export type Body = { weightKg: number | null; heightCm: number | null; birthYear: number | null; sex: string | null };
export function bmr(b: Body, year = new Date().getUTCFullYear()) {
  if (!b.weightKg || !b.heightCm || !b.birthYear) return null;
  const age = year - b.birthYear;
  const base = 10 * b.weightKg + 6.25 * b.heightCm - 5 * age;
  return Math.round(base + (b.sex === 'male' ? 5 : b.sex === 'female' ? -161 : -78));
}
// Baseline daily energy = BMR x 1.2 (light daily life); logged workouts/cardio are added on top to avoid double counting.
export const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.3, active: 1.45 } as const;
export function baseline(b: Body, level: keyof typeof ACTIVITY_FACTOR = 'sedentary') { const v = bmr(b); return v ? Math.round(v * (ACTIVITY_FACTOR[level] ?? 1.2)) : null; }
export type WeightGoal = 'lose' | 'maintain' | 'gain';
// Moderate, widely used targets: about -500 kcal/day to lose (~0.5 kg/week), +250 kcal/day to gain lean mass; never below a safe floor.
export function intakeTarget(b: Body, goal: WeightGoal, exerciseKcal = 0) {
  const base = baseline(b); if (!base) return null;
  const floor = b.sex === 'male' ? 1500 : b.sex === 'female' ? 1200 : 1400;
  const total = base + exerciseKcal;
  return Math.max(floor, Math.round(goal === 'lose' ? total - 500 : goal === 'gain' ? total + 250 : total));
}
export function projection(avgDailyBalance: number, weightKg: number | null, goalWeightKg: number | null) {
  const weeklyKg = Math.round((avgDailyBalance * 7 / 7700) * 100) / 100;
  if (!weightKg || !goalWeightKg || weeklyKg === 0) return { weeklyKg, weeksToGoal: null };
  const delta = goalWeightKg - weightKg;
  if (Math.sign(delta) !== Math.sign(weeklyKg)) return { weeklyKg, weeksToGoal: null };
  return { weeklyKg, weeksToGoal: Math.ceil(Math.abs(delta / weeklyKg)) };
}
// Approximate portions of common Myanmar foods (kcal, protein g). Estimates for quick logging; real values vary by recipe and portion.
export const FOOD_PRESETS = [
  { key: 'rice_plate', kcal: 260, protein: 5 }, { key: 'mohinga', kcal: 400, protein: 18 }, { key: 'shan_noodles', kcal: 450, protein: 18 },
  { key: 'chicken_curry', kcal: 300, protein: 25 }, { key: 'fish_curry', kcal: 250, protein: 24 }, { key: 'tea_leaf_salad', kcal: 250, protein: 8 },
  { key: 'egg', kcal: 75, protein: 6 }, { key: 'tofu_shan', kcal: 180, protein: 10 }, { key: 'pe_byouk', kcal: 200, protein: 12 },
  { key: 'banana', kcal: 100, protein: 1 }, { key: 'milk_tea', kcal: 120, protein: 3 }, { key: 'vegetables', kcal: 60, protein: 3 },
] as const;
