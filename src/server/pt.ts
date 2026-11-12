import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { civilDay, weekday } from './streak';
import { recommendTrainingFocus } from './recommendation';
import { nutritionGuidance, pickSession, recommendFor, weeklyPlan, type Goal, type Split } from '@/shared/program';
import type { Level } from '@/shared/dose';

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
async function library() {
  return (await prisma.exercise.findMany()).map(e => ({ id: e.id, canonicalId: e.canonicalId, name: e.name, primaryMuscles: strings(e.primaryMuscles), secondaryMuscles: strings(e.secondaryMuscles), equipment: strings(e.equipment), difficulty: e.difficulty, tags: strings(e.tags), tracking: e.tracking, guidance: e.guidance as { home?: unknown[]; perSide?: boolean } }));
}

// "Personal trainer for today": planned split for today's weekday, overridden by real recovery signals
// (planned rest day, pain report, high recent load) from the deterministic recommendation engine.
import { z } from 'zod';
export const readinessInput = z.object({ sleep: z.number().int().min(1).max(5), energy: z.number().int().min(1).max(5), soreness: z.number().int().min(1).max(5) }).strict();
export const readinessScore = (r: { sleep: number; energy: number; soreness: number }) => Math.round((r.sleep + r.energy + (6 - r.soreness)) / 3 * 10) / 10;
export async function saveReadiness(userId: string, raw: unknown, now = new Date()) {
  const input = readinessInput.parse(raw);
  const p = await prisma.fitnessProfile.findUnique({ where: { userId } });
  const day = civilDay(now, p?.timezone ?? 'Asia/Yangon');
  const row = await prisma.readinessCheck.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, ...input }, update: input });
  return { ...row, score: readinessScore(row) };
}
export async function todaySession(userId: string, location: 'home' | 'gym', now = new Date(), anyway = false) {
  const [profile, game, lib, measurement] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.gameState.findUnique({ where: { userId } }), library(),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } }),
  ]);
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const level = profile.experience as Level;
  const today = weekday(civilDay(now, game?.timezone ?? profile.timezone));
  const week = weeklyPlan((game?.weekdays as number[] | undefined) ?? [], profile.daysPerWeek);
  const planned = week[today].split;
  // Next planned split (used when the user chooses to train on a rest day).
  const nextSplit = [1, 2, 3, 4, 5, 6, 7].map(i => week[(today + i) % 7].split).find(Boolean) ?? 'full';
  const signal = await recommendTrainingFocus(userId, { location }, now);
  const check = await prisma.readinessCheck.findUnique({ where: { userId_day: { userId, day: civilDay(now, game?.timezone ?? profile.timezone) } } });
  const score = check ? readinessScore(check) : null;
  // Readiness only lowers load: low score = one set fewer per exercise; very low = recovery day.
  const pain = signal.reasons.some(r => r.code === 'PAIN_REPORTED');
  const suggestedRecovery = signal.kind === 'recovery' || !planned || (score !== null && score <= 1.7);
  const override = anyway && suggestedRecovery && !pain;
  const recovery = suggestedRecovery && !override;
  const split: Split | null = recovery ? null : (planned ?? nextSplit) as Split;
  // 4 build weeks + 1 lighter (deload) week, counted from the first completed workout (RP / Alpha-style blocks).
  const first = await prisma.workoutSession.findFirst({ where: { userId, status: 'completed' }, orderBy: { endedAt: 'asc' }, select: { endedAt: true } });
  const weekInBlock = first?.endedAt ? Math.floor((now.getTime() - first.endedAt.getTime()) / (7 * 86400000)) % 5 + 1 : 1;
  const deload = weekInBlock === 5;
  // Any "yes" in the pre-exercise screening keeps sessions at beginner level until a professional clears the user.
  const screened = Object.values((profile.screening ?? {}) as Record<string, boolean>).some(Boolean);
  const effectiveLevel: Level = screened ? 'beginner' : signal.difficulty === 'beginner' && level !== 'beginner' ? 'beginner' : level;
  const exercises = split ? pickSession(split, lib.filter(e => !screened || !e.tags.includes('jumping')), location, effectiveLevel) : [];
  return {
    weekday: today, split, recovery, anyway: override, canTrainAnyway: suggestedRecovery && !pain, scheduleChosen: game?.scheduleChosen ?? false, weekdays: (game?.weekdays as number[] | undefined) ?? [], reasons: [...signal.reasons, ...(score !== null && score <= 2.4 ? [{ code: 'LOW_READINESS' }] : []), ...(deload ? [{ code: 'DELOAD_WEEK' }] : []), ...(screened ? [{ code: 'SCREENING_CAUTION' }] : [])], level: effectiveLevel, weekInBlock, deload, readiness: check ? { ...check, score } : null,
    exercises: exercises.map(x => ({ id: x.exercise.id, name: (x.exercise as unknown as { name: string }).name, sets: (score !== null && score <= 2.4) || deload || override ? String(Math.max(1, Number(x.dose.sets) - 1)) : x.dose.sets, target: x.dose.target, unit: x.dose.unit, restSeconds: x.dose.restSeconds, perSide: x.dose.perSide })),
    nutrition: nutritionGuidance(measurement?.weightKg ?? null, profile.goal as Goal),
  };
}
export async function exerciseRecommendations(userId: string, exerciseId: string, location: 'home' | 'gym') {
  const [profile, lib] = await Promise.all([prisma.fitnessProfile.findUnique({ where: { userId } }), library()]);
  const exercise = lib.find(e => e.id === exerciseId);
  if (!exercise) throw new ApiError(404, 'UNKNOWN_EXERCISE');
  const r = recommendFor(exercise, lib, location, (profile?.experience ?? 'beginner') as Level);
  const name = (id: string) => lib.find(e => e.id === id)?.name;
  return { ...r, sameMuscle: r.sameMuscle.map(x => ({ ...x, name: name(x.id) })), complementary: r.complementary.map(x => ({ ...x, name: name(x.id) })) };
}
