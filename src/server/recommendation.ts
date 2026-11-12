import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { FOCUS_GROUPS, LOCATION_EQUIPMENT, type FocusGroup } from './sequencer';
import { civilDay, weekday } from './streak';

// Deterministic, explainable next-workout recommendation from REAL completed work and optional check-ins.
// Load numbers are relative training-exposure indicators, not medical or physiological measurements.
const HALF_LIFE_HOURS = 36, WINDOW_DAYS = 7;
const GROUPS = Object.keys(FOCUS_GROUPS) as FocusGroup[];
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
export type MuscleLoad = { muscle: string; load: number; level: 'none' | 'low' | 'moderate' | 'high'; lastTrainedHoursAgo: number | null };
export type Reason = { code: string; group?: FocusGroup; muscles?: string[]; hours?: number; value?: string };
export type Recommendation = {
  kind: 'train' | 'recovery'; focus: FocusGroup | 'all'; location: 'home' | 'gym'; difficulty: 'beginner' | 'intermediate' | 'advanced';
  suggestedMinutes: number; reasons: Reason[]; groupLoad: Record<FocusGroup, number>; muscles: MuscleLoad[]; newUser: boolean; plannedRestDay: boolean;
};
const level = (load: number): MuscleLoad['level'] => load <= 0.05 ? 'none' : load < 1 ? 'low' : load < 2.5 ? 'moderate' : 'high';

export async function analyzeRecentMuscleLoad(userId: string, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86400000);
  const [sessions, feedback] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId, status: 'completed', endedAt: { gte: since } }, include: { sets: { include: { exercise: { select: { primaryMuscles: true, secondaryMuscles: true } } } } }, orderBy: { endedAt: 'desc' } }),
    prisma.workoutFeedback.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const load = new Map<string, number>(), last = new Map<string, number>();
  for (const session of sessions) {
    const hours = (now.getTime() - (session.endedAt ?? session.startedAt).getTime()) / 3600000;
    const decay = Math.pow(0.5, hours / HALF_LIFE_HOURS);
    for (const set of session.sets) {
      if (!set.completed) continue;
      // Every completed set counts for all primary (1.0) and secondary (0.5) muscles of the exercise.
      for (const [muscles, weight] of [[list(set.exercise.primaryMuscles), 1], [list(set.exercise.secondaryMuscles), 0.5]] as const) for (const m of muscles) {
        load.set(m, (load.get(m) ?? 0) + weight * decay);
        last.set(m, Math.min(last.get(m) ?? Infinity, hours));
      }
    }
  }
  // Reported soreness raises a muscle's recent load so it is deprioritized (self-report, not diagnosis).
  for (const f of feedback) { const hours = (now.getTime() - f.createdAt.getTime()) / 3600000; if (hours < 72) for (const m of list(f.soreMuscles)) load.set(m, (load.get(m) ?? 0) + 2 * Math.pow(0.5, hours / HALF_LIFE_HOURS)); }
  const muscles: MuscleLoad[] = [...new Set([...Object.values(FOCUS_GROUPS).flat(), ...load.keys()])].map(m => ({ muscle: m, load: Math.round((load.get(m) ?? 0) * 100) / 100, level: level(load.get(m) ?? 0), lastTrainedHoursAgo: last.has(m) ? Math.round(last.get(m)!) : null }));
  const groupLoad = Object.fromEntries(GROUPS.map(g => [g, Math.round(Math.max(...FOCUS_GROUPS[g].map(m => load.get(m) ?? 0)) * 100) / 100])) as Record<FocusGroup, number>;
  return { sessions: sessions.length, muscles, groupLoad, feedback: feedback.slice(0, 5).map(f => ({ sessionId: f.sessionId, difficulty: f.difficulty, soreMuscles: list(f.soreMuscles), pain: f.pain, nextPreference: f.nextPreference, createdAt: f.createdAt })) };
}

export const recommendInput = z.object({ location: z.enum(['home', 'gym']).default('home') }).strict();
export async function recommendTrainingFocus(userId: string, raw: unknown = {}, now = new Date()): Promise<Recommendation> {
  const { location } = recommendInput.parse(raw);
  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const [analysis, game, catalog, total] = await Promise.all([
    analyzeRecentMuscleLoad(userId, now), prisma.gameState.findUnique({ where: { userId } }), prisma.exercise.findMany({ select: { equipment: true, primaryMuscles: true, tags: true } }),
    prisma.workoutSession.count({ where: { userId, status: 'completed' } }),
  ]);
  const zone = game?.timezone ?? profile.timezone, today = civilDay(now, zone);
  const plannedRestDay = !!game && !(game.weekdays as number[]).includes(weekday(today));
  const equipment = new Set<string>([...LOCATION_EQUIPMENT[location]]);
  const eligible = (g: FocusGroup) => catalog.some(e => list(e.equipment).every(x => equipment.has(x)) && !list(e.tags).some(t => t === 'warmup' || t === 'cooldown') && list(e.primaryMuscles).some(m => (FOCUS_GROUPS[g] as readonly string[]).includes(m)));
  const latest = analysis.feedback[0];
  const levels = ['beginner', 'intermediate', 'advanced'] as const;
  let difficulty = profile.experience as typeof levels[number];
  const reasons: Reason[] = [];
  // Never raise intensity automatically; only lower it on "too hard", pain or an "easier" request.
  if (latest && (latest.difficulty === 'too_hard' || latest.nextPreference === 'easier' || latest.pain)) { difficulty = levels[Math.max(0, levels.indexOf(difficulty) - 1)]; reasons.push({ code: 'LOWER_AFTER_FEEDBACK' }); }
  if (latest?.pain) reasons.push({ code: 'PAIN_REPORTED' });
  if (total === 0) {
    return { kind: 'train', focus: 'all', location, difficulty: 'beginner', suggestedMinutes: 10, reasons: [{ code: 'NEW_USER_TEMPLATE' }, ...(plannedRestDay ? [{ code: 'REST_DAY_OPTIONAL' }] : [])], groupLoad: analysis.groupLoad, muscles: analysis.muscles, newUser: true, plannedRestDay };
  }
  const ranked = GROUPS.filter(eligible).sort((a, b) => analysis.groupLoad[a] - analysis.groupLoad[b] || GROUPS.indexOf(a) - GROUPS.indexOf(b));
  const tired = GROUPS.filter(g => analysis.groupLoad[g] >= 2.5);
  for (const g of tired) {
    const hours = Math.min(...FOCUS_GROUPS[g].map(m => analysis.muscles.find(x => x.muscle === m)?.lastTrainedHoursAgo ?? Infinity));
    reasons.push({ code: 'DEPRIORITIZED_RECENT_LOAD', group: g, hours: Number.isFinite(hours) ? hours : undefined });
  }
  const sore = latest?.soreMuscles ?? [];
  if (sore.length) reasons.push({ code: 'SORENESS_REPORTED', muscles: sore });
  const allHigh = ranked.length > 0 && ranked.every(g => analysis.groupLoad[g] >= 2.5);
  if (plannedRestDay || allHigh || latest?.pain) {
    reasons.unshift({ code: plannedRestDay ? 'PLANNED_REST_DAY' : allHigh ? 'HIGH_OVERALL_LOAD' : 'PAIN_RECOVERY' });
    return { kind: 'recovery', focus: 'all', location, difficulty: 'beginner', suggestedMinutes: 10, reasons, groupLoad: analysis.groupLoad, muscles: analysis.muscles, newUser: false, plannedRestDay };
  }
  const focus: FocusGroup | 'all' = ranked.length ? ranked[0] : 'all';
  if (focus !== 'all') reasons.unshift({ code: analysis.groupLoad[focus] === 0 ? 'NOT_TRAINED_RECENTLY' : 'LOWEST_RECENT_LOAD', group: focus });
  return { kind: 'train', focus, location, difficulty, suggestedMinutes: Math.min(30, Math.max(10, profile.daysPerWeek >= 4 ? 20 : 15)), reasons, groupLoad: analysis.groupLoad, muscles: analysis.muscles, newUser: false, plannedRestDay };
}

export const feedbackInput = z.object({
  difficulty: z.enum(['too_easy', 'right', 'too_hard']), soreMuscles: z.array(z.string().max(40)).max(12).default([]),
  pain: z.boolean().default(false), limitation: z.string().trim().max(300).default(''), nextPreference: z.enum(['keep', 'easier', 'harder']).default('keep'),
  technique: z.enum(['good', 'needs_work', 'unknown']).default('unknown'),
}).strict();
export async function saveFeedback(userId: string, sessionId: string, raw: unknown) {
  const input = feedbackInput.parse(raw);
  const session = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId, status: 'completed' } });
  if (!session) throw new ApiError(404, 'NOT_FOUND');
  const data = { ...input, limitation: input.limitation.normalize('NFC') };
  return prisma.workoutFeedback.upsert({ where: { sessionId }, create: { userId, sessionId, ...data }, update: data });
}
