import { z } from 'zod';

// Deterministic Follow Along sequencer. Same catalog + same input => same routine.
// Every second of warm-up, work, rest, transitions and cooldown is counted against the budget.
export const AVOID_TAGS = ['jumping', 'floor', 'wrist-loaded', 'knee-loaded', 'back-loaded', 'overhead'] as const;
export const DURATION_PRESETS = [5, 10, 15, 20, 30] as const;
// Muscle groups over canonical muscle IDs; compound exercises count for every group they touch.
export const FOCUS_GROUPS = {
  legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductor', 'abductors', 'left-soleus', 'right-soleus'],
  core: ['abs', 'obliques', 'lower-back'],
  push: ['chest', 'front-deltoids', 'triceps'],
  pull: ['upper-back', 'back-deltoids', 'biceps', 'trapezius', 'forearm'],
} as const;
export type FocusGroup = keyof typeof FOCUS_GROUPS;
export const LOCATION_EQUIPMENT = { home: ['body weight'], gym: ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'] } as const;
export function focusMuscles(focus: string): string[] | null { return focus === 'all' ? null : focus === 'upper' ? [...FOCUS_GROUPS.push, ...FOCUS_GROUPS.pull] : (FOCUS_GROUPS as Record<string, readonly string[]>)[focus]?.slice() ?? [focus]; }
export const sequenceInput = z.object({
  seconds: z.number().int().min(60).max(3600),
  focus: z.string().max(50).default('all'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.array(z.string().max(40)).min(1).max(10),
  avoid: z.array(z.enum(AVOID_TAGS)).max(6).default([]),
  excludedIds: z.array(z.string().max(100)).max(100).default([]),
  location: z.enum(['home', 'gym', 'any']).default('any'),
  reviewedConstraints: z.literal(true),
}).strict();
export type SequenceInput = z.infer<typeof sequenceInput>;
export type Candidate = { id: string; canonicalId: string | null; difficulty: string; equipment: unknown; primaryMuscles: unknown; secondaryMuscles?: unknown; tags: unknown; tracking: string };
export type PhaseKind = 'warmup' | 'exercise' | 'rest' | 'transition' | 'cooldown';
export type Phase = { kind: PhaseKind; exerciseId: string | null; seconds: number; tracking: 'timed' | 'reps'; reps: number; round?: number };
export type Routine = {
  version: 2; budgetSeconds: number; totalSeconds: number; phases: Phase[];
  summary: Record<PhaseKind, number>; exerciseCount: number; uniqueExercises: number; rounds: number;
  settings: { workSeconds: number; restSeconds: number; transitionSeconds: number; repTarget: number };
  criteria: { minimumFraction: number };
};
export class SequenceError extends Error {
  constructor(public code: 'BUDGET_TOO_SHORT' | 'NO_EXERCISE_MATCH' | 'NO_PREPARATION_MATCH' | 'BUDGET_EXCEEDED', public details: Record<string, unknown>) { super(code); }
}

const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
const SETTINGS = {
  beginner: { workSeconds: 30, restSeconds: 30, repTarget: 8 },
  intermediate: { workSeconds: 40, restSeconds: 20, repTarget: 10 },
  advanced: { workSeconds: 45, restSeconds: 15, repTarget: 12 },
} as const;
export const TRANSITION_SECONDS = 5;
const SECONDS_PER_REP = 3, REP_SETUP_SECONDS = 6;
const list = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []);

export function preparationSeconds(budget: number) {
  return { warmup: budget <= 600 ? 60 : budget <= 1200 ? 120 : 180, cooldown: budget <= 600 ? 60 : budget <= 1200 ? 90 : 120 };
}
export function workSecondsFor(tracking: string, difficulty: SequenceInput['difficulty']) {
  const s = SETTINGS[difficulty];
  return tracking === 'timed' ? s.workSeconds : s.repTarget * SECONDS_PER_REP + REP_SETUP_SECONDS;
}

// Interleave so the same primary muscle does not appear twice in a row when avoidable.
function interleave(pool: Candidate[]) {
  const rest = [...pool], out: Candidate[] = [];
  while (rest.length) {
    const last = out.at(-1), lastMuscle = last ? list(last.primaryMuscles)[0] : undefined;
    const index = rest.findIndex(e => list(e.primaryMuscles)[0] !== lastMuscle);
    out.push(rest.splice(index < 0 ? 0 : index, 1)[0]);
  }
  return out;
}

export function sequenceWorkout(catalog: Candidate[], raw: unknown): Routine {
  const input = sequenceInput.parse(raw);
  const settings = SETTINGS[input.difficulty];
  const equipment = new Set([...input.equipment, 'body weight']);
  const avoid = new Set<string>(input.avoid);
  const sorted = [...catalog].sort((a, b) => (a.canonicalId ?? a.id).localeCompare(b.canonicalId ?? b.id));
  const usable = sorted.filter(e => !input.excludedIds.includes(e.id) && list(e.equipment).every(x => equipment.has(x)) && list(e.tags).every(x => !avoid.has(x)));
  const warm = usable.filter(e => list(e.tags).includes('warmup'));
  const cool = usable.filter(e => list(e.tags).includes('cooldown'));
  if (!warm.length || !cool.length) throw new SequenceError('NO_PREPARATION_MATCH', { warmupCandidates: warm.length, cooldownCandidates: cool.length });

  const levelOk = usable.filter(e => !list(e.tags).some(t => t === 'warmup' || t === 'cooldown') && (rank[e.difficulty] ?? 1) <= rank[input.difficulty]);
  const targets = focusMuscles(input.focus);
  const score = (e: Candidate) => !targets ? 1 : list(e.primaryMuscles).some(m => targets.includes(m)) ? 2 : list(e.secondaryMuscles).some(m => targets.includes(m)) ? 1 : 0;
  const pool = interleave(levelOk.filter(e => score(e) > 0).sort((a, b) => score(b) - score(a) || (rank[b.difficulty] ?? 0) - (rank[a.difficulty] ?? 0) || (a.canonicalId ?? a.id).localeCompare(b.canonicalId ?? b.id)));
  if (!pool.length) throw new SequenceError('NO_EXERCISE_MATCH', {
    focus: input.focus, afterEquipmentAndConstraints: usable.length, afterDifficulty: levelOk.length,
    excludedByEquipment: sorted.filter(e => !list(e.equipment).every(x => equipment.has(x))).length,
    excludedByConstraints: sorted.filter(e => list(e.tags).some(x => avoid.has(x))).length,
  });

  const prep = preparationSeconds(input.seconds);
  const minimumWork = Math.min(...pool.map(e => workSecondsFor(e.tracking, input.difficulty)));
  // warm-up + transition + one exercise + transition + cooldown
  const minimumSeconds = prep.warmup + TRANSITION_SECONDS + minimumWork + TRANSITION_SECONDS + prep.cooldown;
  if (minimumSeconds > input.seconds) throw new SequenceError('BUDGET_TOO_SHORT', { budgetSeconds: input.seconds, minimumSeconds, ...prep, transitionSeconds: TRANSITION_SECONDS, shortestExerciseSeconds: minimumWork });

  const phases: Phase[] = [];
  const coolParts = prep.cooldown >= 90 && cool.length > 1 ? [cool[0], cool[1]] : [cool[0]];
  phases.push({ kind: 'warmup', exerciseId: warm[0].id, seconds: prep.warmup, tracking: 'timed', reps: 0 });
  const available = input.seconds - prep.warmup - prep.cooldown - TRANSITION_SECONDS;
  let used = 0, count = 0;
  for (let slot = 0; slot < 60; slot++) {
    const exercise = pool[slot % pool.length];
    const work = workSecondsFor(exercise.tracking, input.difficulty);
    const cost = (count ? settings.restSeconds : 0) + TRANSITION_SECONDS + work;
    if (used + cost > available) break;
    if (count) phases.push({ kind: 'rest', exerciseId: null, seconds: settings.restSeconds, tracking: 'timed', reps: 0 });
    phases.push({ kind: 'transition', exerciseId: exercise.id, seconds: TRANSITION_SECONDS, tracking: 'timed', reps: 0 });
    const timed = exercise.tracking === 'timed';
    phases.push({ kind: 'exercise', exerciseId: exercise.id, seconds: work, tracking: timed ? 'timed' : 'reps', reps: timed ? 0 : settings.repTarget, round: Math.floor(slot / pool.length) + 1 });
    used += cost; count++;
  }
  phases.push({ kind: 'transition', exerciseId: coolParts[0].id, seconds: TRANSITION_SECONDS, tracking: 'timed', reps: 0 });
  const coolEach = Math.floor(prep.cooldown / coolParts.length);
  coolParts.forEach((e, i) => phases.push({ kind: 'cooldown', exerciseId: e.id, seconds: i === coolParts.length - 1 ? prep.cooldown - coolEach * (coolParts.length - 1) : coolEach, tracking: 'timed', reps: 0 }));

  const summary = { warmup: 0, exercise: 0, rest: 0, transition: 0, cooldown: 0 } as Record<PhaseKind, number>;
  for (const p of phases) summary[p.kind] += p.seconds;
  const totalSeconds = phases.reduce((n, p) => n + p.seconds, 0);
  if (totalSeconds > input.seconds) throw new SequenceError('BUDGET_EXCEEDED', { budgetSeconds: input.seconds, totalSeconds });
  return {
    version: 2, budgetSeconds: input.seconds, totalSeconds, phases, summary, exerciseCount: count,
    uniqueExercises: Math.min(count, pool.length), rounds: Math.ceil(count / pool.length),
    settings: { ...settings, transitionSeconds: TRANSITION_SECONDS }, criteria: { minimumFraction: 0.8 },
  };
}

export function elapsedPhase(session: { status: string; phaseStartedAt: Date | null; phaseElapsedMs: number }, phase: Pick<Phase, 'seconds'>, now = new Date()) {
  return Math.max(0, Math.min(phase.seconds * 1000, session.phaseElapsedMs + (session.status === 'active' && session.phaseStartedAt ? now.getTime() - session.phaseStartedAt.getTime() : 0)));
}
