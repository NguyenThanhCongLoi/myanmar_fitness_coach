// Explicit product collection: 19 supplied clips, not a guess based on equipment.
export const HOME_VIDEO_IDS = [
  'dataset-1373', 'dataset-0276', 'dataset-3013', 'dataset-0662', 'curated-squat',
  'curated-plank', 'curated-bird-dog', 'curated-knee-push', 'vid-arm-circles',
  'vid-bicycle-crunch', 'vid-butt-kicks', 'vid-high-knees', 'vid-jumping-jacks',
  'vid-mountain-climbers', 'vid-reverse-lunge', 'vid-reverse-crunch',
  'vid-shadow-boxing', 'vid-knee-to-elbow', 'vid-sumo-squat',
] as const;
const homeIds = new Set<string>(HOME_VIDEO_IDS);
export type PlaceExercise = { id?: string; equipment: string[]; videoUrl?: string | null };
export const GYM_EQUIPMENT = ['machine', 'cable', 'barbell', 'dumbbell', 'bench', 'band'];
export function isHomeExercise(e: PlaceExercise) { return !!e.id && homeIds.has(e.id) && e.equipment.every(x => x === 'body weight'); }
export function isGymExercise(e: PlaceExercise) { return !isHomeExercise(e) && e.equipment.some(x => GYM_EQUIPMENT.includes(x)); }
export function availableAt(e: PlaceExercise, location: 'home' | 'gym') { return location === 'home' ? isHomeExercise(e) : isGymExercise(e); }
export function placeOf(e: PlaceExercise): 'home' | 'gym' { return isGymExercise(e) ? 'gym' : 'home'; }
export function hasCollectionVideo(e: PlaceExercise) {
  return !!e.videoUrl && (isHomeExercise(e) ? /^\/media\/video\/(?:vid-[\w-]+|[\w-]+-owner)\.mp4$/.test(e.videoUrl) : isGymExercise(e) && /\.mp4$/.test(e.videoUrl));
}
