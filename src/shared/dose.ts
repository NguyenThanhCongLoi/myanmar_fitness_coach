// General, conservative starting doses by experience level (not individual medical advice).
// Reps: weighted moves use lower rep ranges and longer rest; bodyweight moves use higher reps; timed holds use seconds.
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Dose = { sets: string; target: string; unit: 'reps' | 'seconds'; restSeconds: string; perSide: boolean; loadTip: boolean };
type DoseExercise = { tracking?: string; equipment: string[]; tags?: string[] };
const TABLE = {
  prep: { beginner: ['1', '60–90'], intermediate: ['1', '60–90'], advanced: ['1', '60–90'] },
  timed: { beginner: ['2', '20–30'], intermediate: ['3', '30–45'], advanced: ['3', '45–60'] },
  jump: { beginner: ['2', '5'], intermediate: ['3', '6'], advanced: ['3', '8'] },
  loaded: { beginner: ['2', '8–10'], intermediate: ['3', '8–12'], advanced: ['4', '6–10'] },
  bodyweight: { beginner: ['2', '8–12'], intermediate: ['3', '12–15'], advanced: ['3', '15–20'] },
} as const;
const REST = { prep: '0', timed: '30–45', jump: '90', loaded: '90–120', bodyweight: '45–60' } as const;
export function doseFor(e: DoseExercise, level: Level, perSide = false): Dose {
  const tags = e.tags ?? [];
  const kind = tags.includes('warmup') || tags.includes('cooldown') ? 'prep' : e.tracking === 'timed' ? 'timed' : tags.includes('jumping') ? 'jump' : e.equipment.some(q => q !== 'body weight') && !e.equipment.every(q => q === 'bench') ? 'loaded' : 'bodyweight';
  const [sets, target] = TABLE[kind][level];
  return { sets, target, unit: kind === 'prep' || kind === 'timed' ? 'seconds' : 'reps', restSeconds: REST[kind], perSide, loadTip: kind === 'loaded' };
}
export const HOME_EQUIPMENT = ['body weight', 'band', 'dumbbell'];
