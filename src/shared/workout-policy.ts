import { availableAt, hasCollectionVideo } from './exercise-place';
import { readBodyPreferences } from './body-preferences';
type EligibleExercise={id:string;equipment:string[];videoUrl?:string|null;tags?:string[]};

export type WorkoutProfile = { equipment: unknown; bodyPreferences?: unknown; limitations?: string; screening?: unknown; birthYear?: number | null };
const PROTECTED: Record<string, string[]> = { knees: ['knee-loaded','jumping'], back: ['back-loaded'], shoulders: ['overhead'], wrists: ['wrist-loaded'] };
/** Same hard eligibility boundary for plans, quick, recommendations and session creation. */
export function eligibleExercises<T extends EligibleExercise>(library: T[], profile: WorkoutProfile, place: 'home' | 'gym'): T[] {
  const equipment = Array.isArray(profile.equipment) ? profile.equipment as string[] : [];
  const body = readBodyPreferences(profile.bodyPreferences);
  const avoided = new Set(body.protectedAreas.flatMap(a => PROTECTED[a] ?? []));
  // Recognizable restrictions are conservative filters, never a diagnosis from free text.
  const limits = (profile.limitations ?? '').toLowerCase();
  for (const [area, tags] of Object.entries(PROTECTED)) if (limits.includes(area) || (area === 'knees' && limits.includes('knee'))) tags.forEach(t=>avoided.add(t));
  if(limits.includes('no jumping'))avoided.add('jumping');
  if(limits.includes('no floor'))avoided.add('floor');
  const health = (profile.screening ?? {}) as Record<string,boolean>;
  const lowImpact = Object.values(health).some(Boolean) || !!(profile.birthYear && new Date().getUTCFullYear()-profile.birthYear>=65);
  return library.filter(e=>availableAt(e,place) && hasCollectionVideo(e)
    && e.equipment.every(q=>q==='body weight'||equipment.includes(q))
    && !(e.tags??[]).some(t=>avoided.has(t)||(lowImpact&&t==='jumping')));
}
