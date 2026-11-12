import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { createTraining, previewRoutine, trainingAction } from '../src/server/training';
import { finishSession, getSession, logSet } from '../src/server/services';
import type { Routine } from '../src/server/sequencer';
const prefix = `training-${Date.now()}`;
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } }); await prisma.$disconnect(); });
async function user(suffix: string) {
  const id = prefix + suffix;
  await prisma.user.create({ data: { id, name: 'မြန်မာ', email: id + '@example.test', profile: { create: { equipment: ['body weight', 'dumbbell'], experience: 'beginner', onboarded: true } } } });
  return id;
}
const ex = async (canonicalId: string) => (await prisma.exercise.findUniqueOrThrow({ where: { canonicalId } })).id;
let n = 0;
const act = (revision: number, kind: string, extra: Record<string, unknown> = {}) => ({ actionId: `test-action-${++n}-${Date.now()}`, revision, kind, ...extra });

test('Free Workout: no duration limit, pause/resume, skip, replace, add, idempotent actions, owner isolation, finish', async () => {
  const a = await user('free'), b = await user('free-b');
  const squat = await ex('bodyweight-squat'), lunge = await ex('forward-lunge'), curl = await ex('dumbbell-biceps-curl'), bridge = await ex('glute-bridge');
  const squatRecord = await prisma.exercise.findUniqueOrThrow({ where: { id: squat } });
  const alternative = (squatRecord.alternatives as string[])[0];
  const session = await createTraining(a, 'free', { name: 'ကျွန်ုပ်၏ Free Workout', exercises: [{ exerciseId: squat, sets: 2, reps: 10, restSeconds: 60, targetKg: 0 }, { exerciseId: curl, sets: 2, reps: 8, restSeconds: 90, targetKg: 6 }] });
  expect(session.mode).toBe('free'); expect(session.playerPlan).toBeNull(); expect(session.creditTargetSets).toBe(4);
  expect(session.plan.name).toBe('ကျွန်ုပ်၏ Free Workout');
  await expect(createTraining(a, 'free', { name: 'second', exercises: [{ exerciseId: squat, sets: 1, reps: 1, restSeconds: 15, targetKg: 0 }] })).rejects.toMatchObject({ code: 'ACTIVE_WORKOUT_EXISTS' });
  await expect(getSession(b, session.id)).rejects.toMatchObject({ status: 404 });
  await expect(trainingAction(b, session.id, act(0, 'pause'))).rejects.toMatchObject({ status: 404 });
  const t0 = new Date();
  const pauseAction = act(0, 'pause');
  let s = await trainingAction(a, session.id, pauseAction, t0);
  expect(s.status).toBe('paused');
  s = await trainingAction(a, session.id, pauseAction, t0); // retry is idempotent
  expect(s.revision).toBe(1);
  await expect(logSet(a, session.id, { exerciseId: squat, setIndex: 0, reps: 10, weight: 0, unit: 'kg', restSeconds: 60 })).rejects.toMatchObject({ code: 'WORKOUT_PAUSED' });
  await expect(trainingAction(a, session.id, act(0, 'resume'))).rejects.toMatchObject({ code: 'STALE_WORKOUT' });
  s = await trainingAction(a, session.id, act(1, 'resume'), new Date(t0.getTime() + 5000));
  expect(s.status).toBe('active'); expect(s.totalPausedMs).toBe(5000);
  const squatRow = s.prescriptions.find(p => p.exerciseId === squat)!, curlRow = s.prescriptions.find(p => p.exerciseId === curl)!;
  s = await trainingAction(a, session.id, act(2, 'replace', { prescriptionId: squatRow.id, exerciseId: alternative }));
  expect(s.prescriptions.find(p => p.id === squatRow.id)!.exerciseId).toBe(alternative);
  await expect(trainingAction(a, session.id, act(3, 'replace', { prescriptionId: curlRow.id, exerciseId: squat }))).rejects.toMatchObject({ code: 'INVALID_REPLACEMENT' });
  const extra = alternative === bridge ? lunge : bridge;
  s = await trainingAction(a, session.id, act(3, 'add', { prescription: { exerciseId: extra, sets: 1, reps: 12, restSeconds: 30, targetKg: 0 } }));
  expect(s.creditTargetSets).toBe(5);
  s = await trainingAction(a, session.id, act(4, 'skip', { prescriptionId: curlRow.id }));
  for (const setIndex of [0, 1]) await logSet(a, session.id, { exerciseId: alternative, setIndex, reps: 10, weight: 0, unit: 'kg', restSeconds: 60 });
  await logSet(a, session.id, { exerciseId: extra, setIndex: 0, reps: 12, weight: 0, unit: 'kg', restSeconds: 30 });
  await expect(logSet(a, session.id, { exerciseId: curl, setIndex: 0, reps: 8, weight: 6, unit: 'kg', restSeconds: 90 })).rejects.toMatchObject({ code: 'INVALID_SET' });
  expect((await getSession(a, session.id)).restUntil).not.toBeNull();
  await prisma.workoutSession.update({ where: { id: session.id }, data: { startedAt: new Date(Date.now() - 120000) } });
  const done = await finishSession(a, session.id, 'မြန်မာ မှတ်ချက်');
  // 3 of 5 target sets (the skipped exercise still counts in the target) is below 80%: work saved, no XP.
  expect(done.status).toBe('completed'); expect(done.reward.awarded).toBe(false);
  expect(await prisma.workoutSet.count({ where: { sessionId: session.id } })).toBe(3);
  expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } })).note).toBe('မြန်မာ မှတ်ချက်');
});

test('Follow Along: preview equals started routine, server timer, pause/resume, rep/timed logging, actual work saved, XP after verified completion', async () => {
  const a = await user('follow'), b = await user('follow-b');
  const input = { seconds: 300, focus: 'all', difficulty: 'advanced', equipment: ['body weight'], avoid: [], excludedIds: [], reviewedConstraints: true };
  const preview = await previewRoutine(a, input);
  expect(preview.totalSeconds).toBeLessThanOrEqual(300);
  await expect(previewRoutine(a, { ...input, equipment: ['barbell'] })).rejects.toMatchObject({ code: 'EQUIPMENT_UNAVAILABLE' });
  await expect(previewRoutine(a, { ...input, seconds: 90 })).rejects.toMatchObject({ code: 'BUDGET_TOO_SHORT', details: { minimumSeconds: 160 } });
  const created = await createTraining(a, 'follow', input);
  const routine = created.playerPlan as unknown as Routine;
  expect(routine).toEqual(preview); // advanced request is capped to the beginner profile in both
  expect(routine.settings.restSeconds).toBe(30);
  await expect(trainingAction(b, created.id, act(0, 'skip'))).rejects.toMatchObject({ status: 404 });
  let s = created; let clock = new Date(created.phaseStartedAt!.getTime());
  await expect(trainingAction(a, s.id, act(s.revision, 'advance'), new Date(clock.getTime() + 5000))).rejects.toMatchObject({ code: 'PHASE_NOT_READY' });
  s = await trainingAction(a, s.id, act(s.revision, 'pause'), new Date(clock.getTime() + 20000));
  expect(s.phaseElapsedMs).toBe(20000);
  clock = new Date(clock.getTime() + 600000); // ten minutes away (background tab) while paused
  s = await trainingAction(a, s.id, act(s.revision, 'resume'), clock);
  expect(s.totalPausedMs).toBe(580000);
  for (let i = s.playerIndex; i < routine.phases.length; i++) {
    const p = routine.phases[i];
    clock = new Date(clock.getTime() + p.seconds * 1000 - s.phaseElapsedMs);
    s = await trainingAction(a, s.id, act(s.revision, 'advance', p.kind === 'exercise' ? { confirm: true, reps: p.tracking === 'reps' ? p.reps : undefined } : {}), clock);
  }
  expect(s.playerIndex).toBe(routine.phases.length);
  const blocks = routine.phases.filter(p => p.kind === 'exercise').length;
  expect(await prisma.workoutPhaseLog.count({ where: { sessionId: s.id, kind: 'exercise', status: 'completed' } })).toBe(blocks);
  expect(await prisma.workoutSet.count({ where: { sessionId: s.id } })).toBe(blocks);
  await prisma.workoutSession.update({ where: { id: s.id }, data: { startedAt: new Date(Date.now() - 400000) } });
  const finished = await finishSession(a, s.id, '');
  expect(finished.reward.awarded).toBe(true); expect(finished.reward.xp).toBe(50);
  expect((await finishSession(a, s.id, '')).reward.awarded).toBe(false);
});

test('Follow Along early exit keeps actual work, logs remaining phases as skipped and earns no XP', async () => {
  const a = await user('exit');
  const s0 = await createTraining(a, 'follow', { seconds: 600, focus: 'all', difficulty: 'beginner', equipment: ['body weight'], avoid: [], excludedIds: [], reviewedConstraints: true });
  const routine = s0.playerPlan as unknown as Routine;
  let s = await trainingAction(a, s0.id, act(0, 'skip'));
  s = await trainingAction(a, s0.id, act(s.revision, 'skip'));
  const p = routine.phases[2]; expect(p.kind).toBe('exercise');
  if (p.tracking === 'reps') await expect(trainingAction(a, s0.id, act(s.revision, 'advance', { confirm: true, reps: 8 }), new Date(s.phaseStartedAt!.getTime() + 4000))).rejects.toMatchObject({ code: 'PHASE_NOT_READY' });
  s = await trainingAction(a, s0.id, act(s.revision, 'advance', { confirm: true, reps: 5 }), new Date(s.phaseStartedAt!.getTime() + p.seconds * 1000));
  await expect(trainingAction(a, s0.id, act(s.revision, 'end'))).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
  s = await trainingAction(a, s0.id, act(s.revision, 'end', { confirm: true }));
  expect(s.playerIndex).toBe(routine.phases.length);
  expect(await prisma.workoutPhaseLog.count({ where: { sessionId: s0.id } })).toBe(routine.phases.length);
  await prisma.workoutSession.update({ where: { id: s0.id }, data: { startedAt: new Date(Date.now() - 120000) } });
  const result = await finishSession(a, s0.id, '');
  expect(result.status).toBe('completed'); expect(result.reward.awarded).toBe(false);
  expect(await prisma.workoutSet.count({ where: { sessionId: s0.id } })).toBe(1);
});
