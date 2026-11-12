import { prisma } from '@/shared/lib/prisma';
import { muscleBalance } from '@/shared/plan';

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
/** Balance of what the user actually trained in the last 7 days (owner-scoped). */
export async function doneBalance(userId: string, now = new Date()) {
  const sets = await prisma.workoutSet.groupBy({ by: ['exerciseId'], where: { session: { userId, startedAt: { gte: new Date(now.getTime() - 7 * 86400000) } } }, _count: { _all: true } });
  if (!sets.length) return muscleBalance([], []);
  const lib = await prisma.exercise.findMany({ where: { id: { in: sets.map(s => s.exerciseId) } }, select: { id: true, primaryMuscles: true } });
  return muscleBalance(sets.map(s => ({ id: s.exerciseId, sets: s._count._all })), lib.map(e => ({ id: e.id, primaryMuscles: strings(e.primaryMuscles) })));
}
