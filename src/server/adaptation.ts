import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { assessTraining, type WeekCheck } from '@/shared/adaptation';
import { civilDay, addDay } from './streak';
import { readinessScore } from './pt';
import { energySummary } from './energy';
import { ApiError } from './validation';

const minutes = z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(45)]);
const checkInput = z.object({ energy: z.number().int().min(1).max(5), sleep: z.number().int().min(1).max(5), soreness: z.number().int().min(1).max(5), preference: z.enum(['lighter', 'same', 'harder']), minutes });
const keyFor = (program: string, week: number) => `plan:v2:${program}:${week}`;
export async function adaptiveWeek(userId: string, input: { program: string; week: number; step: number; planned: number; screened: boolean }, now = new Date()) {
  const key = keyFor(input.program, input.week);
  const baseRow = await prisma.aiMemory.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, content: JSON.stringify({ step: input.step, planned: input.planned }) }, update: {} });
  const base = z.object({ step: z.number().int().min(0).max(8), planned: z.number().int().min(1).max(6) }).parse(JSON.parse(baseRow.content));
  const p = await prisma.fitnessProfile.findUniqueOrThrow({ where: { userId } });
  const today = civilDay(now, p.timezone), start = addDay(today, -6), first = (input.week - 1) * base.planned + 1;
  const [all, ready, waters, latest, reviewRow, todayRow, energy, painStop] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId, programKey: input.program, programDay: { gte: first, lt: first + base.planned }, status: 'completed' }, include: { feedback: true }, orderBy: { endedAt: 'asc' }, take: 100 }),
    prisma.readinessCheck.findUnique({ where: { userId_day: { userId, day: today } } }),
    prisma.waterLog.findMany({ where: { userId, day: { gte: start, lte: today } } }),
    prisma.workoutSession.findFirst({ where: { userId, status: 'completed' }, orderBy: { endedAt: 'desc' }, select: { endedAt: true } }),
    prisma.aiMemory.findUnique({ where: { userId_key: { userId, key: `${key}:review` } } }),
    prisma.aiMemory.findUnique({ where: { userId_key: { userId, key: `plan:today:${today}` } } }),
    energySummary(userId),
    prisma.workoutSession.findFirst({ where: { userId, status: 'abandoned', note: 'quit:pain', endedAt: { gte: baseRow.createdAt } }, select: { id: true } }),
  ]);
  const unique = new Map(all.map(s => [s.programDay!, s]));
  const sessions = [...unique.values()];
  let review: WeekCheck | null = null; if (reviewRow) { const result = checkInput.safeParse(JSON.parse(reviewRow.content)); if (result.success) review = result.data; }
  let todayChoice: { minutes: 10 | 20 | 30 | 45; lighter: boolean } | null = null;
  if (todayRow) { const result = z.object({ minutes, lighter: z.boolean() }).safeParse(JSON.parse(todayRow.content)); if (result.success) todayChoice = result.data; }
  const waterDays = [...new Set(waters.map(w => w.day))];
  const waterAvg = waterDays.length ? waterDays.reduce((n, d) => n + waters.filter(w => w.day === d).reduce((m, w) => m + w.ml, 0), 0) / waterDays.length : null;
  const logged = energy.daily.filter(d => d.logged);
  const intakeAvg = logged.length ? logged.reduce((n, d) => n + d.intake, 0) / logged.length : null;
  // Self-reported food/water can only block an increase. Missing logs never imply poor recovery.
  const fuelLow = logged.length >= 3 && !!energy.targetIntake && intakeAvg! < energy.targetIntake * .7;
  const waterLow = waterDays.length >= 3 && waterAvg! < 750;
  const daysAway = latest?.endedAt ? Math.floor((now.getTime() - latest.endedAt.getTime()) / 86400000) : 0;
  const decision = assessTraining({ baseStep: base.step, planned: base.planned, screened: input.screened, painReported: !!painStop, sessions: sessions.map(s => ({ pct: s.completionPct, difficulty: s.feedback?.difficulty, technique: s.feedback?.technique, pain: s.feedback?.pain, nextPreference: s.feedback?.nextPreference, stopReason: s.note.startsWith('quit:') ? s.note.slice(5) : undefined })), readinessLow: !!ready && readinessScore(ready) <= 2.4, daysAway, review, fuelLow, waterLow });
  return { base, decision, review, todayChoice, latestSession: sessions.at(-1) ?? null, data: { foodDays: logged.length, waterDays: waterDays.length, avgKcal: intakeAvg === null ? null : Math.round(intakeAvg), avgWaterMl: waterAvg === null ? null : Math.round(waterAvg), daysAway }, startedAt: baseRow.createdAt };
}

export async function saveTodayChoice(userId: string, raw: unknown) {
  const value = z.object({ minutes, lighter: z.boolean() }).strict().parse(raw);
  const p = await prisma.fitnessProfile.findUnique({ where: { userId } }); if (!p?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const key = `plan:today:${civilDay(new Date(), p.timezone)}`, content = JSON.stringify(value);
  await prisma.aiMemory.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, content }, update: { content } }); return value;
}

export async function saveWeekReview(userId: string, raw: unknown) {
  const value = checkInput.extend({ expectedWeek: z.number().int().min(1).max(520), finishWeek: z.boolean() }).strict().parse(raw);
  const p = await prisma.fitnessProfile.findUnique({ where: { userId } }); if (!p?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const key = `${keyFor(p.program, value.expectedWeek)}:review`;
  const previous = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key } } });
  if (p.planWeek !== value.expectedWeek) { if (previous && p.planWeek > value.expectedWeek) return { saved: true, advanced: true }; throw new ApiError(409, 'STALE_REVIEW'); }
  const { expectedWeek, finishWeek, ...review } = value;
  // Use the stable day count recorded at the start of the week.
  const { programSplits } = await import('@/shared/plan');
  const state = await adaptiveWeek(userId, { program: p.program, week: p.planWeek, step: Math.max(0, p.planStep), planned: programSplits(p.program as 'personal', p.daysPerWeek, 'gym').length, screened: Object.values(p.screening as Record<string, boolean>).some(Boolean) });
  const ss = await prisma.workoutSession.findMany({ where: { userId, programKey: p.program, programDay: { gte: (p.planWeek - 1) * state.base.planned + 1, lte: p.planWeek * state.base.planned }, status: 'completed' }, include: { feedback: true }, orderBy: { endedAt: 'asc' }, take: 100 });
  const unique = [...new Map(ss.map(s => [s.programDay!, s])).values()];
  const decision = assessTraining({ baseStep: state.base.step, planned: state.base.planned, screened: Object.values(p.screening as Record<string, boolean>).some(Boolean), sessions: unique.map(s => ({ pct: s.completionPct, difficulty: s.feedback?.difficulty, technique: s.feedback?.technique, pain: s.feedback?.pain, nextPreference: s.feedback?.nextPreference, stopReason: s.note.startsWith('quit:') ? s.note.slice(5) : undefined })), review, painReported: state.decision.reasons.includes('pain'), readinessLow: state.decision.reasons.includes('recovery'), daysAway: state.data.daysAway, fuelLow: state.decision.reasons.includes('fuel'), waterLow: state.decision.reasons.includes('water') });
  const content = JSON.stringify({ ...review, decision, closed: finishWeek });
  await prisma.$transaction(async tx => {
    const changed = await tx.fitnessProfile.updateMany({ where: { userId, planWeek: expectedWeek, program: p.program }, data: { ...(finishWeek ? { planWeek: expectedWeek + 1, planStep: decision.step } : {}), sessionMinutes: review.minutes } });
    if (!changed.count) throw new ApiError(409, 'STALE_REVIEW');
    await tx.aiMemory.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, content }, update: { content } });
    if (finishWeek) { const last = JSON.stringify({ week: expectedWeek, avg: decision.avg ?? 0, change: decision.change, reasons: decision.reasons }); await tx.aiMemory.upsert({ where: { userId_key: { userId, key: 'plan:last' } }, create: { userId, key: 'plan:last', content: last }, update: { content: last } }); }
  });
  return { saved: true, advanced: finishWeek, decision };
}
