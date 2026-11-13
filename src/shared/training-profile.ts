import type { Level } from './dose';

export type TrainingFactors = { goal?: string; weightGoal?: string; age?: number | null; activityLevel?: string; screened?: boolean };
// Product heuristics, not a diagnosis or a clinical prescription. Sex is not a load multiplier.
export function startingStep(level: Level, factors: TrainingFactors) {
  if (factors.screened || (factors.age ?? 0) >= 65 || factors.activityLevel === 'sedentary') return 0;
  return level === 'advanced' ? 4 : level === 'intermediate' ? 2 : 0;
}
export function restFor(e: { id?: string; equipment: string[]; tags?: string[]; difficulty?: string }, location: 'home' | 'gym', factors: TrainingFactors, step: number) {
  const compound = /squat|deadlift|leg-press|bench-press|machine-chest-press|seated-cable-row/.test(e.id ?? '');
  if (location === 'gym') return (factors.goal === 'build_strength' ? 150 : 90) + (compound ? 30 : 0) + (factors.screened || (factors.age ?? 0) >= 65 ? 30 : 0);
  return 10 + (step < 2 ? 10 : 0) + (factors.activityLevel === 'sedentary' ? 10 : 0)
    + ((e.tags ?? []).includes('jumping') || e.difficulty === 'intermediate' ? 10 : 0) + (factors.screened || (factors.age ?? 0) >= 65 ? 10 : 0);
}
export function sessionBudget(requested: number, step: number, factors: TrainingFactors) {
  // Time available is a ceiling, not permission to give a new/inactive user seven sets.
  const cap = factors.screened || ((factors.age ?? 0) >= 65 && step < 2) ? 20 : step < 2 ? 25 : 60;
  return Math.min(requested, cap);
}
