import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { sequenceInput, sequenceWorkout, elapsedPhase, SequenceError, LOCATION_EQUIPMENT, type Routine } from './sequencer';
import { syncDays } from './gamification';
import { getSession, sessionInclude } from './services';

// Free Workout: manual exercises/sets/reps/weight/rest. No total-duration limit exists for this mode.
const prescription = z.object({ exerciseId: z.string().min(1).max(100), sets: z.number().int().min(1).max(8), reps: z.number().int().min(1).max(600), restSeconds: z.number().int().min(10).max(600), targetKg: z.number().min(0).max(400).default(0), supersetGroup: z.string().regex(/^[A-J]$/).nullable().optional(), timed: z.boolean().optional() }).strict();
export const freeInput = z.object({ name: z.string().trim().min(2).max(100), exercises: z.array(prescription).min(1).max(20), program: z.object({ key: z.enum(['personal', 'four_day', 'gym_beginner']), day: z.number().int().min(1).max(60) }).strict().optional() }).strict()
  .refine(v => Object.values(v.exercises.reduce<Record<string, number>>((m, e) => (e.supersetGroup ? { ...m, [e.supersetGroup]: (m[e.supersetGroup] ?? 0) + 1 } : m), {})).every(n => n >= 2 && n <= 4), 'A superset groups 2-4 exercises');
const ranks = ['beginner', 'intermediate', 'advanced'] as const;
// Phase timers tolerate 1 s of client/server clock rounding.
// Rep blocks: plausibility floor of 1 s per logged rep (never less than 3 s) before work counts as completed.
const TOLERANCE_MS = 1000, MIN_REP_PHASE_MS = 3000, MS_PER_LOGGED_REP = 1000;

export async function previewRoutine(userId: string, raw: unknown) {
  const input = sequenceInput.parse(raw), profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  // Location is the user's explicit statement of what is available right now (e.g. at the gym today).
  const allowed = new Set([...(profile.equipment as string[]), 'body weight', ...(input.location === 'any' ? [] : LOCATION_EQUIPMENT[input.location])]);
  const missing = input.equipment.filter(e => !allowed.has(e));
  if (missing.length) throw new ApiError(400, 'EQUIPMENT_UNAVAILABLE', { missing });
  // Never generate above the user's stated experience level.
  const level = ranks[Math.min(ranks.indexOf(input.difficulty), ranks.indexOf(profile.experience as typeof ranks[number]))] ?? 'beginner';
  try { return sequenceWorkout(await prisma.exercise.findMany(), { ...input, difficulty: level }); }
  catch (error) { if (error instanceof SequenceError) throw new ApiError(422, error.code, error.details); throw error; }
}

export async function createTraining(userId: string, mode: 'free' | 'follow', raw: unknown) {
  const routine = mode === 'follow' ? await previewRoutine(userId, raw) : null;
  const input = mode === 'free' ? freeInput.parse(raw) : null;
  const rows = input?.exercises ?? Object.values(routine!.phases.filter(p => p.kind === 'exercise').reduce((all, p) => {
    const key = p.exerciseId!; all[key] ??= { exerciseId: key, sets: 0, reps: p.reps || 1, restSeconds: routine!.settings.restSeconds, targetKg: 0 }; all[key].sets++; return all;
  }, {} as Record<string, { exerciseId: string; sets: number; reps: number; restSeconds: number; targetKg: number }>));
  if (new Set(rows.map(p => p.exerciseId)).size !== rows.length) throw new ApiError(400, 'DUPLICATE_EXERCISE');
  return prisma.$transaction(async tx => {
    const existing = await tx.workoutSession.findFirst({ where: { userId, status: { in: ['active', 'paused'] } } });
    if (existing) throw new ApiError(409, 'ACTIVE_WORKOUT_EXISTS', { sessionId: existing.id });
    if (await tx.exercise.count({ where: { id: { in: rows.map(p => p.exerciseId) } } }) !== rows.length) throw new ApiError(400, 'UNKNOWN_EXERCISE');
    const state = await syncDays(tx, userId);
    const name = input?.name.normalize('NFC') ?? 'Follow Along';
    const plan = await tx.workoutPlan.create({ data: { userId, name, goal: mode, status: 'session_template', source: mode, days: { create: { name: mode, week: 1, weekday: 0, order: 0, exercises: { create: rows.map((r, order) => { const { supersetGroup: _g, timed: _t, ...p } = r as typeof r & { supersetGroup?: string | null; timed?: boolean }; void _g; void _t; return { ...p, order }; }) } } } }, include: { days: true } });
    const target = mode === 'follow' ? routine!.exerciseCount : rows.reduce((n, p) => n + p.sets, 0);
    return tx.workoutSession.create({ data: { userId, planId: plan.id, dayId: plan.days[0].id, mode, programKey: input?.program?.key ?? null, programDay: input?.program?.day ?? null, creditTimezone: state.timezone, playerPlan: routine ?? undefined, phaseStartedAt: routine ? new Date() : null, creditTargetSets: target, prescriptions: { create: rows.map((p, order) => ({ ...p, originalExerciseId: p.exerciseId, order })) } }, include: sessionInclude });
  });
}

const actionSchema = z.object({
  actionId: z.string().min(8).max(80), revision: z.number().int().min(0),
  kind: z.enum(['pause', 'resume', 'advance', 'skip', 'replace', 'add', 'update', 'end', 'abandon']),
  prescriptionId: z.string().max(100).optional(), exerciseId: z.string().max(100).optional(), prescription: prescription.optional(),
  reps: z.number().int().min(0).max(200).optional(), confirm: z.boolean().optional(),
}).strict();

export async function trainingAction(userId: string, sessionId: string, raw: unknown, now = new Date()) {
  const input = actionSchema.parse(raw);
  await prisma.$transaction(async tx => {
    const session = await tx.workoutSession.findFirst({ where: { id: sessionId, userId }, include: { prescriptions: true, sets: true } });
    if (!session) throw new ApiError(404, 'NOT_FOUND');
    // Idempotent retry: an already-applied action returns the current state.
    if (await tx.workoutAction.findUnique({ where: { sessionId_actionId: { sessionId, actionId: input.actionId } } })) return;
    if (session.revision !== input.revision) throw new ApiError(409, 'STALE_WORKOUT');
    if (!['active', 'paused'].includes(session.status)) throw new ApiError(409, 'WORKOUT_ENDED');
    const routine = session.mode === 'follow' ? session.playerPlan as unknown as Routine | null : null;
    const phase = routine?.phases[session.playerIndex];
    if (input.kind === 'pause') {
      if (session.status === 'active') await tx.workoutSession.update({ where: { id: sessionId }, data: {
        status: 'paused', pausedAt: now, phaseElapsedMs: phase ? elapsedPhase(session, phase, now) : session.phaseElapsedMs, phaseStartedAt: null,
        restRemainingMs: Math.max(0, (session.restUntil?.getTime() ?? 0) - now.getTime()), restUntil: null } });
    } else if (input.kind === 'resume') {
      if (session.status === 'paused') await tx.workoutSession.update({ where: { id: sessionId }, data: {
        status: 'active', pausedAt: null, totalPausedMs: { increment: Math.max(0, now.getTime() - (session.pausedAt?.getTime() ?? now.getTime())) },
        phaseStartedAt: phase ? now : null, restUntil: session.restRemainingMs ? new Date(now.getTime() + session.restRemainingMs) : null, restRemainingMs: 0 } });
    } else if (input.kind === 'abandon') {
      if (!input.confirm) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
      await tx.workoutSession.update({ where: { id: sessionId }, data: { status: 'abandoned', endedAt: now, phaseStartedAt: null } });
    } else if (routine) {
      if (input.kind === 'end') {
        // Exit early but keep the work actually done: remaining phases are logged as skipped, never as completed.
        if (!input.confirm) throw new ApiError(400, 'CONFIRMATION_REQUIRED');
        const elapsed = phase ? Math.floor(elapsedPhase(session, phase, now) / 1000) : 0;
        await tx.workoutPhaseLog.createMany({ data: routine.phases.slice(session.playerIndex).map((p, i) => ({ sessionId, phaseIndex: session.playerIndex + i, kind: p.kind, exerciseId: p.exerciseId, seconds: i === 0 ? elapsed : 0, reps: 0, status: 'skipped' })) });
        await tx.workoutSession.update({ where: { id: sessionId }, data: { status: 'active', pausedAt: null, playerIndex: routine.phases.length, phaseElapsedMs: 0, phaseStartedAt: null } });
      } else {
        if (!['advance', 'skip'].includes(input.kind)) throw new ApiError(400, 'INVALID_INPUT');
        if (session.status !== 'active') throw new ApiError(409, 'WORKOUT_PAUSED');
        if (!phase) throw new ApiError(409, 'WORKOUT_ENDED');
        const elapsedMs = elapsedPhase(session, phase, now), seconds = Math.round(elapsedMs / 1000);
        const timeUp = elapsedMs + TOLERANCE_MS >= phase.seconds * 1000;
        if (input.kind === 'advance') {
          if (phase.kind === 'exercise' && !input.confirm) throw new ApiError(409, 'PHASE_NOT_READY');
          if (phase.kind === 'exercise' && phase.tracking === 'reps') { if (!input.reps || elapsedMs < Math.max(MIN_REP_PHASE_MS, input.reps * MS_PER_LOGGED_REP)) throw new ApiError(409, 'PHASE_NOT_READY'); }
          else if (!timeUp) throw new ApiError(409, 'PHASE_NOT_READY');
        }
        const completed = input.kind === 'advance';
        await tx.workoutPhaseLog.create({ data: { sessionId, phaseIndex: session.playerIndex, kind: phase.kind, exerciseId: phase.exerciseId, seconds, reps: completed && phase.tracking === 'reps' ? input.reps ?? 0 : 0, status: completed ? 'completed' : 'skipped' } });
        if (completed && phase.kind === 'exercise') await tx.workoutSet.create({ data: { sessionId, exerciseId: phase.exerciseId!, setIndex: session.playerIndex, reps: phase.tracking === 'reps' ? input.reps! : 0, seconds, weightKg: 0, restSeconds: 0, completed: true } });
        const next = session.playerIndex + 1;
        await tx.workoutSession.update({ where: { id: sessionId }, data: { playerIndex: next, phaseElapsedMs: 0, phaseStartedAt: next < routine.phases.length ? now : null } });
      }
    } else {
      const current = session.prescriptions.find(p => p.id === input.prescriptionId);
      if (input.kind === 'add') {
        const p = prescription.parse(input.prescription);
        if (!await tx.exercise.findUnique({ where: { id: p.exerciseId } })) throw new ApiError(400, 'UNKNOWN_EXERCISE');
        if (session.prescriptions.some(x => x.exerciseId === p.exerciseId)) throw new ApiError(400, 'DUPLICATE_EXERCISE');
        if (session.prescriptions.length >= 20) throw new ApiError(400, 'INVALID_INPUT');
        await tx.sessionExercise.create({ data: { sessionId, ...p, originalExerciseId: p.exerciseId, order: session.prescriptions.length } });
        await tx.workoutSession.update({ where: { id: sessionId }, data: { creditTargetSets: { increment: p.sets } } });
      } else {
        if (!current) throw new ApiError(404, 'NOT_FOUND');
        if (input.kind === 'skip') await tx.sessionExercise.update({ where: { id: current.id }, data: { skipped: true } });
        else if (input.kind === 'replace') {
          const original = await tx.exercise.findUniqueOrThrow({ where: { id: current.originalExerciseId } });
          if (!(original.alternatives as string[]).includes(input.exerciseId ?? '') || session.sets.some(s => s.exerciseId === current.exerciseId) || session.prescriptions.some(x => x.exerciseId === input.exerciseId)) throw new ApiError(400, 'INVALID_REPLACEMENT');
          await tx.sessionExercise.update({ where: { id: current.id }, data: { exerciseId: input.exerciseId } });
        } else if (input.kind === 'update') {
          const p = prescription.parse(input.prescription);
          if (p.exerciseId !== current.exerciseId || session.sets.some(s => s.exerciseId === current.exerciseId)) throw new ApiError(400, 'INVALID_INPUT');
          await tx.sessionExercise.update({ where: { id: current.id }, data: p });
          const target = session.prescriptions.reduce((n, x) => n + (x.id === current.id ? p.sets : x.sets), 0);
          await tx.workoutSession.update({ where: { id: sessionId }, data: { creditTargetSets: session.sets.length ? Math.max(session.creditTargetSets, target) : target } });
        } else throw new ApiError(400, 'INVALID_INPUT');
      }
    }
    await tx.workoutSession.update({ where: { id: sessionId }, data: { revision: { increment: 1 } } });
    await tx.workoutAction.create({ data: { sessionId, actionId: input.actionId, result: { revision: session.revision + 1 } } });
  }, { timeout: 20000 });
  return getSession(userId, sessionId);
}
