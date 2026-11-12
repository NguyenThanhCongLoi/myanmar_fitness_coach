import { z } from 'zod';

export const FOCUS_AREAS = ['full', 'waist', 'glutes', 'legs', 'upper'] as const;
export type FocusArea = typeof FOCUS_AREAS[number];
export const bodyPreferencesSchema = z.object({
  focusAreas: z.array(z.enum(FOCUS_AREAS)).min(1).max(3).refine(a => new Set(a).size === a.length && (!a.includes('full') || a.length === 1)),
  waistGoal: z.enum(['reduce', 'strong', 'maintain']),
  gluteGoal: z.enum(['build', 'strong', 'maintain', 'reduce']),
  currentWaist: z.enum(['slim', 'medium', 'fuller', 'unsure']).default('unsure'),
  currentGlutes: z.enum(['small', 'medium', 'fuller', 'unsure']).default('unsure'),
  protectedAreas: z.array(z.enum(['knees', 'back', 'shoulders', 'wrists'])).max(4),
  waistCm: z.number().min(40).max(250).nullable().optional(),
  hipsCm: z.number().min(40).max(250).nullable().optional(),
}).strict();
export type BodyPreferences = z.infer<typeof bodyPreferencesSchema>;
export const DEFAULT_BODY_PREFERENCES: BodyPreferences = { focusAreas: ['full'], waistGoal: 'maintain', gluteGoal: 'maintain', currentWaist: 'unsure', currentGlutes: 'unsure', protectedAreas: [] };
export function readBodyPreferences(raw: unknown): BodyPreferences {
  const result = bodyPreferencesSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_BODY_PREFERENCES;
}
export function focusMuscles(p: BodyPreferences): string[] {
  return [...new Set([...p.focusAreas.flatMap(a => a === 'waist' ? ['abs', 'obliques'] : a === 'glutes' ? ['gluteal'] : a === 'legs' ? ['quadriceps', 'hamstring', 'calves'] : a === 'upper' ? ['chest', 'upper-back', 'front-deltoids'] : []), ...(p.waistGoal !== 'maintain' ? ['abs', 'obliques'] : []), ...(p.gluteGoal !== 'maintain' ? ['gluteal'] : [])])];
}
export function toggleFocus(current: FocusArea[], next: FocusArea): FocusArea[] {
  if (next === 'full') return ['full'];
  const specific = current.filter(a => a !== 'full');
  const result = specific.includes(next) ? specific.filter(a => a !== next) : [...specific, next].slice(-3);
  return result.length ? result : ['full'];
}
