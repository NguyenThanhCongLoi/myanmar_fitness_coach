import { prisma } from '@/shared/lib/prisma';
import { doseFor, type Level } from '@/shared/dose';

// Progressive overload (double progression): work up to the top of the rep range, then add the smallest
// load step and restart at the bottom of the range. RIR (reps in reserve) gates load increases; repeated misses reduce load.
// Basis: ACSM 2009 progression models; common practice in strength apps. Estimates, adjusted by the user.
export function e1rm(weightKg: number, reps: number) { return weightKg > 0 && reps > 0 && reps <= 12 ? Math.round(weightKg * (1 + reps / 30) * 10) / 10 : null; }
export function loadStep(equipment: string[]) { return equipment.includes('barbell') ? 2.5 : equipment.includes('dumbbell') ? 2 : equipment.some(q => q === 'machine' || q === 'cable') ? 2.5 : 0; }
type LoggedSet = { reps: number; weightKg: number; rir: number | null; setIndex: number };
export type Suggestion = { weightKg: number; reps: number; note: 'START_LIGHT' | 'ADD_REP' | 'ADD_LOAD' | 'HOLD' | 'REDUCE' | 'HARDER_VARIATION'; previous: { reps: number; weightKg: number }[] };
export function suggestNext(sessions: LoggedSet[][], equipment: string[], range: [number, number], canIncrease = true): Suggestion {
  const [lo, hi] = range;
  const last = sessions[0];
  if (!last?.length) return { weightKg: 0, reps: lo, note: 'START_LIGHT', previous: [] };
  const previous = [...last].sort((a, b) => a.setIndex - b.setIndex).map(s => ({ reps: s.reps, weightKg: s.weightKg }));
  const weight = Math.max(...last.map(s => s.weightKg));
  const top = last.filter(s => s.weightKg === weight);
  const minReps = Math.min(...top.map(s => s.reps));
  const rirs = top.map(s => s.rir).filter((x): x is number => x !== null);
  const easyEnough = rirs.length === top.length && Math.min(...rirs) >= 2;
  const prevTop = (sessions[1] ?? []).filter(s => s.weightKg === weight);
  const confirmedTwice = prevTop.length > 0 && prevTop.every(s => s.reps >= hi && s.rir !== null && s.rir >= 2);
  const step = loadStep(equipment);
  if (weight === 0 || step === 0) {
    if (minReps >= hi) return { weightKg: weight, reps: hi, note: canIncrease && easyEnough && confirmedTwice ? 'HARDER_VARIATION' : 'HOLD', previous };
    return { weightKg: weight, reps: Math.min(hi, minReps + 1), note: 'ADD_REP', previous };
  }
  if (minReps >= hi) return canIncrease && easyEnough && confirmedTwice && step / weight <= .1
    ? { weightKg: Math.round((weight + step) * 10) / 10, reps: lo, note: 'ADD_LOAD', previous }
    : { weightKg: weight, reps: hi, note: 'HOLD', previous };
  if (minReps < lo) {
    const prev = sessions[1];
    const missedTwice = prev?.length && Math.min(...prev.filter(s => s.weightKg === weight).map(s => s.reps).concat(hi)) < lo;
    if (missedTwice) return { weightKg: Math.max(0, Math.round(weight * 0.9 / step) * step), reps: lo, note: 'REDUCE', previous };
    return { weightKg: weight, reps: lo, note: 'HOLD', previous };
  }
  return { weightKg: weight, reps: Math.min(hi, minReps + 1), note: 'ADD_REP', previous };
}
const range = (target: string): [number, number] => { const [a, b] = target.split('–').map(Number); return [a || 8, b || a || 12]; };

export async function progressionFor(userId: string, exerciseIds: string[], excludeSessionId?: string) {
  const [profile, exercises, sets] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.exercise.findMany({ where: { id: { in: exerciseIds } } }),
    prisma.workoutSet.findMany({ where: { exerciseId: { in: exerciseIds }, completed: true, kind: { not: 'warmup' }, session: { userId, status: 'completed', ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}) } }, include: { session: { select: { id: true, endedAt: true, feedback: { select: { pain: true, difficulty: true, technique: true } } } } }, orderBy: { loggedAt: 'desc' }, take: 400 }),
  ]);
  const level = (profile?.experience ?? 'beginner') as Level;
  return Object.fromEntries(exercises.map(e => {
    const own = sets.filter(s => s.exerciseId === e.id);
    const bySession = [...new Set(own.map(s => s.sessionId))].map(id => own.filter(s => s.sessionId === id));
    const dose = doseFor({ tracking: e.tracking, equipment: e.equipment as string[], tags: e.tags as string[] }, level);
    const best = own.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps) ?? 0), 0);
    const safe = bySession.slice(0, 2).length === 2 && bySession.slice(0, 2).every(ss => ss[0]?.session.feedback?.technique === 'good' && !ss[0].session.feedback?.pain && ss[0].session.feedback?.difficulty !== 'too_hard');
    let suggestion = dose.unit === 'reps' ? suggestNext(bySession, e.equipment as string[], range(dose.target), safe) : null;
    const last = own[0];
    if (suggestion && last && (last.session.feedback?.pain || (last.session.endedAt && Date.now() - last.session.endedAt.getTime() > 14 * 86400000))) {
      const step = loadStep(e.equipment as string[]);
      suggestion = { ...suggestion, weightKg: step ? Math.max(0, Math.floor(last.weightKg * .9 / step) * step) : 0, note: 'REDUCE' };
    }
    return [e.id, { suggestion, bestE1rm: best || null, bestReps: own.reduce((m, s) => Math.max(m, s.reps), 0) || null }];
  }));
}
// Personal record check for a just-logged set against all of the user's other sets of that exercise.
export async function detectPr(userId: string, exerciseId: string, setId: string, weightKg: number, reps: number) {
  const others = await prisma.workoutSet.findMany({ where: { exerciseId, id: { not: setId }, completed: true, kind: { not: 'warmup' }, session: { userId } }, select: { weightKg: true, reps: true } });
  if (!others.length) return null;
  const now = e1rm(weightKg, reps), best = others.reduce((m, s) => Math.max(m, e1rm(s.weightKg, s.reps) ?? 0), 0);
  if (now && now > best) return { type: 'e1rm' as const, value: now, previous: best || null };
  if (weightKg === 0 && reps > Math.max(...others.filter(s => s.weightKg === 0).map(s => s.reps), 0)) return { type: 'reps' as const, value: reps, previous: Math.max(...others.map(s => s.reps)) };
  return null;
}

// Progress overview from real completed sets: weekly volume, sets per muscle this week (10–20 hard sets/week is a common
// hypertrophy target, Schoenfeld 2017), a 12-week training calendar, e1RM trends and personal records.
export async function progressOverview(userId: string, now = new Date()) {
  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  const tz = profile?.timezone ?? 'Asia/Yangon';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const since = new Date(now.getTime() - 84 * 86400000);
  const sessions = await prisma.workoutSession.findMany({ where: { userId, status: 'completed', endedAt: { gte: since } }, include: { sets: { where: { completed: true, kind: { not: 'warmup' } }, include: { exercise: { select: { id: true, name: true, primaryMuscles: true } } } } }, orderBy: { endedAt: 'asc' } });
  const today = day(now), dayMs = 86400000;
  const calendar = Array.from({ length: 84 }, (_, i) => { const d = day(new Date(now.getTime() - (83 - i) * dayMs)); const ss = sessions.filter(s => day(s.endedAt!) === d); return { day: d, count: ss.length, sessions: ss.map(s => ({ id: s.id, completionPct: s.completionPct, sets: s.sets.length })) }; });
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(now.getTime() - (7 - i) * 7 * dayMs), start = new Date(end.getTime() - 7 * dayMs);
    const inWeek = sessions.filter(s => s.endedAt! > start && s.endedAt! <= end);
    return { week: day(end), workouts: inWeek.length, sets: inWeek.reduce((n, s) => n + s.sets.length, 0), volumeKg: Math.round(inWeek.reduce((n, s) => n + s.sets.reduce((m, x) => m + x.reps * x.weightKg, 0), 0)) };
  });
  const weekStart = new Date(now.getTime() - 7 * dayMs);
  const setsPerMuscle: Record<string, number> = {};
  for (const s of sessions.filter(x => x.endedAt! > weekStart)) for (const x of s.sets) for (const m of x.exercise.primaryMuscles as string[]) setsPerMuscle[m] = (setsPerMuscle[m] ?? 0) + 1;
  const all = sessions.flatMap(s => s.sets.map(x => ({ ...x, day: day(s.endedAt!) })));
  const counts = new Map<string, number>(); all.forEach(x => counts.set(x.exerciseId, (counts.get(x.exerciseId) ?? 0) + 1));
  const top = [...counts.entries()].filter(([id]) => all.some(x => x.exerciseId === id && x.weightKg > 0)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  const trends = top.map(id => {
    const byDay = new Map<string, number>();
    for (const x of all.filter(y => y.exerciseId === id)) { const v = e1rm(x.weightKg, x.reps); if (v) byDay.set(x.day, Math.max(byDay.get(x.day) ?? 0, v)); }
    return { exerciseId: id, name: all.find(x => x.exerciseId === id)!.exercise.name, points: [...byDay.entries()].map(([d, v]) => ({ day: d, e1rm: v })) };
  });
  const allSets = await prisma.workoutSet.findMany({ where: { completed: true, kind: { not: 'warmup' }, session: { userId, status: 'completed' } }, include: { exercise: { select: { name: true } } } });
  const best = new Map<string, { exerciseId: string; name: string; e1rm: number | null; reps: number; weightKg: number }>();
  for (const x of allSets) {
    const v = e1rm(x.weightKg, x.reps), cur = best.get(x.exerciseId);
    if (!cur || (v ?? 0) > (cur.e1rm ?? 0) || (!v && !cur.e1rm && x.reps > cur.reps)) best.set(x.exerciseId, { exerciseId: x.exerciseId, name: x.exercise.name, e1rm: v, reps: x.reps, weightKg: x.weightKg });
  }
  return { today, calendar, weeks, setsPerMuscle, target: { min: 10, max: 20 }, trends, records: [...best.values()].sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0)).slice(0, 8), totalWorkouts: sessions.length };
}
