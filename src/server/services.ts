import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { grantWorkoutCredit, syncDays,gameSummary } from './gamification';
import { civilDay } from './streak';
import { detectPr } from './progression';
import { ApiError, planSchema, profileSchema, setSchema, toKg, workoutStreak, yangonDay, type PlanInput } from './validation';

const planInclude = { days: { orderBy: { order: 'asc' as const }, include: { exercises: { orderBy: { order: 'asc' as const }, include: { exercise: { include: { translations: true } } } } } } };
export const sessionInclude = { prescriptions:{orderBy:{order:'asc' as const},include:{exercise:{include:{translations:true}}}},phaseLogs:true, plan: { select: { id: true, name: true } }, day: { include: { exercises: { orderBy: { order: 'asc' as const }, include: { exercise: { include: { translations: true } } } } } }, sets: { orderBy: { setIndex: 'asc' as const }, include: { exercise: { select: { id: true, name: true } } } } };

export async function exerciseList(search = '') {
  return prisma.exercise.findMany({
    where: search ? { OR: [{ name: { contains: search } }, { normalizedName: { contains: search.toLowerCase() } }, { translations: { some: { name: { contains: search } } } }] } : {},
    include: { translations: true }, orderBy: { name: 'asc' }, take: 100,
  });
}
export async function plansForUser(userId: string) {
  return prisma.workoutPlan.findMany({ where: { userId,status:'active' }, include: planInclude, orderBy: { createdAt: 'desc' } });
}
export async function saveProfile(userId: string, raw: unknown) {
  const data = profileSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const game = await tx.gameState.findUnique({where:{userId}});
    if(game)data.timezone=game.timezone;
    const profile = await tx.fitnessProfile.upsert({ where: { userId }, create: { userId, ...data, onboarded: true }, update: { ...data, onboarded: true } });
    await tx.goal.updateMany({ where: { userId, active: true }, data: { active: false } });
    await tx.goal.create({ data: { userId, kind: data.goal, label: data.goal } });
    return profile;
  });
}

async function createPlanInTransaction(tx: Prisma.TransactionClient, userId: string, data: PlanInput, proposalId?: string) {
  const ids = [...new Set(data.days.flatMap(day => day.exercises.map(item => item.exerciseId)))];
  if (await tx.exercise.count({ where: { id: { in: ids } } }) !== ids.length) throw new ApiError(400, 'UNKNOWN_EXERCISE');
  return tx.workoutPlan.create({ data: {
    userId, name: data.name.normalize('NFC'), goal: data.goal.normalize('NFC'), weeks: data.weeks,
    source: proposalId ? 'ai' : 'manual', proposalId,
    days: { create: data.days.map((day, order) => ({ name: day.name.normalize('NFC'), week: day.week, weekday: day.weekday, order,
      exercises: { create: day.exercises.map((exercise, index) => ({ ...exercise, order: index })) },
    })) },
  }, include: planInclude });
}
export async function createPlan(userId: string, raw: unknown) {
  const data = planSchema.parse(raw);
  return prisma.$transaction(tx => createPlanInTransaction(tx, userId, data));
}
export async function approveProposal(userId: string, proposalId: string) {
  return prisma.$transaction(async tx => {
    const proposal = await tx.planProposal.findFirst({ where: { id: proposalId, userId } });
    if (!proposal) throw new ApiError(404, 'NOT_FOUND');
    if (proposal.status === 'approved') return tx.workoutPlan.findFirstOrThrow({ where: { proposalId, userId }, include: planInclude });
    if (proposal.status !== 'pending') throw new ApiError(409, 'PROPOSAL_NOT_PENDING');
    const claimed = await tx.planProposal.updateMany({ where: { id: proposalId, userId, status: 'pending' }, data: { status: 'approved', approvedAt: new Date() } });
    if (claimed.count !== 1) throw new ApiError(409, 'PROPOSAL_NOT_PENDING');
    const plan = await createPlanInTransaction(tx, userId, planSchema.parse(proposal.payload), proposalId);
    await tx.agentAction.create({ data: { userId, tool: 'approve_plan', status: 'approved_by_user', arguments: { proposalId, planId: plan.id } } });
    return plan;
  });
}

export async function startSession(userId: string, dayId: string) {
  return prisma.$transaction(async tx => {
    const day = await tx.planDay.findFirst({ where: { id: dayId, plan: { userId } } });
    if (!day) throw new ApiError(404, 'NOT_FOUND');
    const active = await tx.workoutSession.findFirst({ where: { userId, status: {in:['active','paused']} }, include: sessionInclude });
    if (active) return active;
    const state=await syncDays(tx,userId);
    return tx.workoutSession.create({ data: { userId, planId: day.planId, dayId,creditTimezone:state.timezone,creditTargetSets:0,prescriptions:{create:(await tx.planExercise.findMany({where:{dayId}})).map(({exerciseId,order,sets,reps,restSeconds,targetKg})=>({exerciseId,originalExerciseId:exerciseId,order,sets,reps,restSeconds,targetKg}))} }, include: sessionInclude });
  });
}
export async function getSession(userId: string, id: string) {
  const session = await prisma.workoutSession.findFirst({ where: { id, userId }, include: sessionInclude });
  if (!session) throw new ApiError(404, 'NOT_FOUND');
  return session;
}
export async function logSet(userId: string, sessionId: string, raw: unknown) {
  const data = setSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const session = await tx.workoutSession.findFirst({ where: { id: sessionId, userId }, include: { prescriptions:true, day: { include: { exercises: true } } } });
    if (!session) throw new ApiError(404, 'NOT_FOUND');
    if (session.status === 'paused') throw new ApiError(409, 'WORKOUT_PAUSED');
    if (session.status !== 'active') throw new ApiError(409, 'WORKOUT_ENDED');
    const prescription = (session.prescriptions.length?session.prescriptions.filter(p=>!p.skipped):session.day.exercises).find(item => item.exerciseId === data.exerciseId);
    if (!prescription || data.setIndex >= prescription.sets) throw new ApiError(400, 'INVALID_SET');
    const fields = { reps: data.reps, weightKg: toKg(data.weight, data.unit), restSeconds: data.restSeconds, rir: data.rir ?? null, kind: data.kind, seconds: data.seconds ?? 0, completed: true };
    if(session.mode==='follow')throw new ApiError(400,'INVALID_INPUT');
    // Superset: go straight to the next exercise of the group; rest only after the last one.
    const group=(prescription as {supersetGroup?:string|null}).supersetGroup;
    const groupOrder=group?session.prescriptions.filter(p=>!p.skipped&&(p as {supersetGroup?:string|null}).supersetGroup===group).sort((a,b)=>a.order-b.order):[];
    const restMs=group&&groupOrder.at(-1)?.exerciseId!==data.exerciseId?0:data.restSeconds*1000;
    await tx.workoutSession.update({where:{id:sessionId},data:{restUntil:restMs?new Date(Date.now()+restMs):null}});
    return tx.workoutSet.upsert({
      where: { sessionId_exerciseId_setIndex: { sessionId, exerciseId: data.exerciseId, setIndex: data.setIndex } },
      create: { sessionId, exerciseId: data.exerciseId, setIndex: data.setIndex, ...fields }, update: fields,
    });
  }).then(async set => ({ ...set, pr: set.kind === 'warmup' ? null : await detectPr(userId, set.exerciseId, set.id, set.weightKg, set.reps) }));
}
export async function finishSession(userId: string, id: string, note: string) {
  return prisma.$transaction(async tx => {
    const session = await tx.workoutSession.findFirst({ where: { id, userId } });
    if (!session) throw new ApiError(404, 'NOT_FOUND');
    if(session.status==='abandoned')throw new ApiError(409,'WORKOUT_ENDED');
    if(session.mode==='follow'&&session.playerPlan&&session.playerIndex<(session.playerPlan as {phases:unknown[]}).phases.length)throw new ApiError(409,'PHASE_NOT_READY');
    if (session.status === 'completed') return {...session,reward:{awarded:false,xp:0,reason:'already_completed'}};
    if (await tx.workoutSet.count({ where: { sessionId: id, completed: true } }) === 0) throw new ApiError(400, 'LOG_A_SET_FIRST');
    const now=new Date();
    const rx=await tx.sessionExercise.findMany({where:{sessionId:id}}), done=await tx.workoutSet.findMany({where:{sessionId:id,completed:true,kind:{not:'warmup'}}});
    const planned=rx.reduce((n,p)=>n+p.sets,0);
    const actual=rx.reduce((n,p)=>n+done.filter(x=>x.exerciseId===p.exerciseId&&x.setIndex<p.sets).reduce((m,x)=>m+Math.min(1,(p.timed?x.seconds:x.reps)/Math.max(1,p.reps)),0),0);
    const completionPct=planned?Math.min(100,Math.round(actual/planned*100)):null;
    const completed=await tx.workoutSession.update({ where: { id }, data: { status: 'completed', endedAt: now, note: note.normalize('NFC'), completionPct } });
    const reward=await grantWorkoutCredit(tx,userId,id,now);
    return {...completed,reward};
  });
}
export async function dashboard(userId: string) {
  const [sessions, profile, planCount, exerciseCount, activeSession, measurements] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId, status: 'completed' }, include: { sets: true }, orderBy: { startedAt: 'desc' }, take: 1000 }),
    prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.workoutPlan.count({ where: { userId } }), prisma.exercise.count(),
    prisma.workoutSession.findFirst({ where: { userId, status: {in:['active','paused']} }, select: { id: true } }),
    prisma.bodyMeasurement.findMany({ where: { userId }, orderBy: { recordedAt: 'desc' }, take: 20 }),
  ]);
  const zone=profile?.timezone??'Asia/Yangon';
  const game=profile?.onboarded?await gameSummary(userId):null;
  const date = new Date(civilDay(new Date(),zone) + 'T00:00:00Z');
  const week = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(date); d.setUTCDate(d.getUTCDate() - 6 + index);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: sessions.filter(session => civilDay(session.endedAt ?? session.startedAt,zone) === key).length };
  });
  return { profile, activeSession, measurements, stats: {
    completed: sessions.length, planCount, exerciseCount, streak: game?.streak.current??0,
    sets: sessions.reduce((sum, session) => sum + session.sets.length, 0),
    volumeKg: sessions.reduce((sum, session) => sum + session.sets.reduce((n, set) => n + set.reps * set.weightKg, 0), 0), week,
  } };
}
