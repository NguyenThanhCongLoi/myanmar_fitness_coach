import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { civilDay } from './streak';
import { adaptAfterSession, buildWeek, bmiBand, bmiOf, muscleBalance, nextStep, placeOf, programSplits, stageOf, startStep, MAX_STEP, PROGRAMS, type Adapt, type ProgramKey } from '@/shared/plan';
import { doneBalance } from './balance';
import { readinessScore } from './pt';
import { addDay, weekday } from './streak';
import { energySummary } from './energy';
import { workoutKcal } from '@/shared/energy';
import type { Level } from '@/shared/dose';

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
async function library() {
  return (await prisma.exercise.findMany()).map(e => ({ id: e.id, name: e.name, primaryMuscles: strings(e.primaryMuscles), secondaryMuscles: strings(e.secondaryMuscles), equipment: strings(e.equipment),
    difficulty: e.difficulty, tags: strings(e.tags), tracking: e.tracking, guidance: (e.guidance ?? {}) as { home?: unknown[]; perSide?: boolean }, thumbnailUrl: e.thumbnailUrl, videoUrl: e.videoUrl }));
}

// The user's programme, one week at a time: when every day of the week is done, its completion % and feedback
// decide next week's step (up / same / down). Location comes from the client (home/gym switch).
export async function getPlan(userId: string, rawLocation: unknown) {
  const location = rawLocation === 'gym' ? 'gym' : 'home';
  const [profile, weight, lib, game] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' }, select: { weightKg: true } }), library(),
    prisma.gameState.findUnique({ where: { userId }, select: { weekdays: true } })]);
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const program = (PROGRAMS as readonly string[]).includes(profile.program) ? profile.program as ProgramKey : 'personal';
  const screened = Object.values((profile.screening ?? {}) as Record<string, boolean>).some(Boolean);
  const level: Level = screened ? 'beginner' : profile.experience as Level;
  const n = programSplits(program, profile.daysPerWeek, location).length;
  let week = profile.planWeek, step = profile.planStep < 0 ? Math.min(screened ? 2 : 8, startStep(level)) : profile.planStep;
  if (profile.planStep < 0) await prisma.fitnessProfile.update({ where: { userId }, data: { planStep: step } });
  const sessions = await prisma.workoutSession.findMany({ where: { userId, status: 'completed', programKey: program, programDay: { not: null } }, select: { id: true, programDay: true, completionPct: true, endedAt: true }, orderBy: { endedAt: 'asc' } });
  // Evaluate every finished session once (newest last): heavier / same / lighter from completion %, felt difficulty and pain.
  const evalMem = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key: 'plan:eval' } } });
  type LastAdapt = Adapt & { sessionId: string; pct: number | null; difficulty: string | null; lastAt: number };
  let lastAdapt: LastAdapt | null = null;
  try { lastAdapt = evalMem ? JSON.parse(evalMem.content) : null; } catch { lastAdapt = null; }
  let lastAt = lastAdapt?.lastAt ?? 0, changed = false;
  const pendingEval = sessions.filter(x => x.endedAt && x.endedAt.getTime() > lastAt);
  if (pendingEval.length) {
    const fbs = await prisma.workoutFeedback.findMany({ where: { sessionId: { in: pendingEval.map(x => x.id) } }, select: { sessionId: true, difficulty: true, pain: true } });
    for (const x of pendingEval) {
      const f = fbs.find(y => y.sessionId === x.id);
      // give the user a few minutes for the 2-tap feedback, but only on the newest session (an older one was skipped)
      if (!f && x === pendingEval.at(-1) && Date.now() - x.endedAt!.getTime() < 10 * 60000) break;
      const a = adaptAfterSession(step, { pct: x.completionPct, difficulty: f?.difficulty, pain: f?.pain }, screened);
      step = a.step; lastAt = x.endedAt!.getTime(); changed = true;
      lastAdapt = { ...a, sessionId: x.id, pct: x.completionPct, difficulty: f?.difficulty ?? null, lastAt };
    }
    if (changed && lastAdapt) {
      await prisma.fitnessProfile.update({ where: { userId }, data: { planStep: step } });
      const content = JSON.stringify(lastAdapt);
      await prisma.aiMemory.upsert({ where: { userId_key: { userId, key: 'plan:eval' } }, create: { userId, key: 'plan:eval', content }, update: { content } });
    }
  }
  const byDay = new Map<number, { pct: number | null; id: string; endedAt: Date | null }>();
  for (const x of sessions) byDay.set(x.programDay!, { pct: x.completionPct, id: x.id, endedAt: x.endedAt });
  let lastChange: { week: number; avg: number; change: 'up' | 'same' | 'down' } | null = null;
  // advance (possibly several weeks if the user caught up offline)
  for (let guard = 0; guard < 52; guard++) {
    const first = (week - 1) * n + 1, days = Array.from({ length: n }, (_, i) => first + i);
    if (!days.every(d => byDay.has(d))) break;
    const fb = await prisma.workoutFeedback.findMany({ where: { sessionId: { in: days.map(d => byDay.get(d)!.id) } }, select: { sessionId: true, difficulty: true, pain: true } });
    const r = nextStep(step, days.map(d => { const s = byDay.get(d)!; const f = fb.find(x => x.sessionId === s.id); return { pct: s.pct, difficulty: f?.difficulty, pain: f?.pain }; }), screened);
    // per-session adaptation already moved the step during the week; the weekly roll only adds a gentle step up after a strong week
    const weekly = r.change === 'up' && r.avg >= 90 ? Math.min(screened ? 3 : MAX_STEP, step + 1) : step;
    lastChange = { week, avg: r.avg, change: weekly > step ? 'up' : r.change === 'down' ? 'down' : 'same' }; step = weekly; week += 1;
    await prisma.fitnessProfile.update({ where: { userId }, data: { planWeek: week, planStep: step } });
    await prisma.aiMemory.upsert({ where: { userId_key: { userId, key: 'plan:last' } }, create: { userId, key: 'plan:last', content: JSON.stringify(lastChange) }, update: { content: JSON.stringify(lastChange) } });
  }
  if (!lastChange) { const m = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key: 'plan:last' } } }); if (m) try { lastChange = JSON.parse(m.content); } catch { /* ignore */ } }
  const bmi = bmiOf(weight?.weightKg, profile.heightCm);
  const limits = (profile.limitations ?? '').toLowerCase();
  const check = await prisma.readinessCheck.findUnique({ where: { userId_day: { userId, day: civilDay(new Date(), profile.timezone) } } });
  const readiness = check ? readinessScore(check) : null, tired = readiness !== null && readiness <= 2.4;
  const days = buildWeek({ program, daysPerWeek: profile.daysPerWeek, library: lib, location, step: tired ? Math.max(0, step - 1) : step, bmi, week, sessionMinutes: profile.sessionMinutes, lowImpact: screened || /knee|ဒူး/.test(limits) });
  const byId = new Map(lib.map(e => [e.id, e]));
  // user swaps ("replace X with Y") per programme + place; skipped when the target is missing, wrong place or already in that day
  const swaps = await readSwaps(userId, program, location);
  for (const d of days) d.items = d.items.map(i => { const to = swaps[i.id], e = to ? byId.get(to) : null;
    return e && (location === 'gym' || placeOf(e) === 'home') && !d.items.some(x => x.id === to) ? { ...i, id: e.id, swappedFrom: i.id } : i; });
  const current = days.find(d => !byDay.has(d.day))?.day ?? null;
  const balance = { plan: muscleBalance(days.flatMap(d => d.items.map(i => ({ id: i.id, sets: i.sets }))), lib).issues, done: (await doneBalance(userId)).issues };
  const kg = weight?.weightKg ?? 65;
  const pastWeeks = Array.from({ length: week - 1 }, (_, i) => i + 1).map(w => {
    const ds = Array.from({ length: n }, (_, i) => (w - 1) * n + i + 1).map(d => byDay.get(d)).filter(Boolean) as { pct: number | null }[];
    return { week: w, done: ds.length, avg: ds.length ? Math.round(ds.reduce((a, x) => a + (x.pct ?? 0), 0) / ds.length) : 0 };
  });
  return {
    program, location, level, bmi, band: bmiBand(bmi), heightCm: profile.heightCm, weightKg: weight?.weightKg ?? null, daysPerWeek: n,
    week, step, stage: stageOf(step), deload: week % 4 === 0 && step > 0, lastChange, pastWeeks, sessionMinutes: profile.sessionMinutes,
    nickname: profile.nickname, balance, lastAdapt, readiness, tired, current, completed: days.filter(d => byDay.has(d.day)).length, total: days.length,
    trainingWeekdays: (game?.weekdays as number[] | undefined) ?? [],
    days: days.map(d => ({ ...d, kcal: workoutKcal(d.minutes, kg), done: byDay.has(d.day), pct: byDay.get(d.day)?.pct ?? null, doneOn: byDay.get(d.day)?.endedAt ?? null,
      thumb: d.items.map(i => byId.get(i.id)?.thumbnailUrl).find(Boolean) ?? null })),
  };
}

const swapKey = (program: string, location: string) => `plan:swaps:${program}:${location}`;
async function readSwaps(userId: string, program: string, location: string): Promise<Record<string, string>> {
  const m = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key: swapKey(program, location) } } });
  try { const v = m ? JSON.parse(m.content) : {}; return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
/** Replace one exercise of the user's programme with another (or undo with to=null). Owner-scoped; validated against the library. */
export async function swapExercise(userId: string, raw: unknown) {
  const b = z.object({ from: z.string().min(1).max(80), to: z.string().min(1).max(80).nullable(), location: z.enum(['home', 'gym']) }).strict().parse(raw);
  const profile = await prisma.fitnessProfile.findUnique({ where: { userId }, select: { program: true, onboarded: true } });
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  if (b.to) {
    const e = await prisma.exercise.findUnique({ where: { id: b.to }, select: { equipment: true } });
    if (!e) throw new ApiError(404, 'NOT_FOUND');
    if (b.location === 'home' && placeOf({ equipment: strings(e.equipment) }) === 'gym') throw new ApiError(400, 'SWAP_NOT_ALLOWED');
  }
  const swaps = await readSwaps(userId, profile.program, b.location);
  if (b.to && b.to !== b.from) swaps[b.from] = b.to; else delete swaps[b.from];
  if (Object.keys(swaps).length > 40) throw new ApiError(400, 'TOO_MANY_SWAPS');
  const key = swapKey(profile.program, b.location), content = JSON.stringify(swaps);
  await prisma.aiMemory.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, content }, update: { content } });
  return getPlan(userId, b.location);
}

// Daily score for the last 7 days: workout 50% + water 25% + food 25%. A planned rest day counts the workout part as done.
export async function dayScores(userId: string, now = new Date()) {
  const [profile, game, weight, user] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.gameState.findUnique({ where: { userId }, select: { weekdays: true } }),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' }, select: { weightKg: true } }), prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })]);
  const zone = profile?.timezone ?? 'Asia/Yangon', today = civilDay(now, zone), days = Array.from({ length: 7 }, (_, i) => addDay(today, i - 6));
  const since = new Date(now.getTime() - 8 * 86400000);
  const [sessions, water, food] = await Promise.all([
    prisma.workoutSession.findMany({ where: { userId, status: 'completed', endedAt: { gte: since } }, select: { endedAt: true, completionPct: true } }),
    prisma.waterLog.findMany({ where: { userId, day: { in: days } }, select: { day: true, ml: true } }),
    prisma.foodLog.findMany({ where: { userId, day: { in: days } }, select: { day: true, kcal: true } })]);
  let kcalTarget = 2000; try { kcalTarget = (await energySummary(userId)).targetIntake ?? 2000; } catch { /* profile incomplete */ }
  const planned = (game?.weekdays as number[] | undefined) ?? [];
  const joined = user ? civilDay(user.createdAt, zone) : today;
  const rows = days.map(day => {
    if (day < joined) return { day, score: null, workout: null, water: null, food: null, rest: false };
    const ses = sessions.filter(x => x.endedAt && civilDay(x.endedAt, zone) === day);
    const rest = !planned.includes(weekday(day));
    const workout = ses.length ? Math.max(...ses.map(x => x.completionPct ?? 100)) : rest ? 100 : 0;
    const ml = water.filter(w => w.day === day).reduce((a, w) => a + w.ml, 0);
    const waterPct = Math.min(100, Math.round(ml / waterTargetMl(weight?.weightKg ?? null, ses.length > 0) * 100));
    const kcal = food.filter(f => f.day === day).reduce((a, f) => a + f.kcal, 0);
    const foodPct = kcal === 0 ? 0 : kcal <= kcalTarget * 1.1 ? Math.min(100, Math.round(kcal / kcalTarget * 100)) : Math.max(0, Math.round(100 - (kcal - kcalTarget * 1.1) / kcalTarget * 200));
    return { day, score: Math.round(workout * 0.5 + waterPct * 0.25 + foodPct * 0.25), workout, water: waterPct, food: foodPct, rest };
  });
  return { today, days: rows, kcalTarget };
}

const prefsInput = z.object({ trainTime: z.enum(['morning', 'midday', 'evening']).optional(), activityLevel: z.enum(['sedentary', 'light', 'active']).optional(), sessionMinutes: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(45)]).optional(),
  nickname: z.string().trim().max(30).optional() }).strict();
export async function savePrefs(userId: string, raw: unknown) {
  const input = prefsInput.parse(raw);
  await prisma.fitnessProfile.updateMany({ where: { userId }, data: { ...input, ...(input.nickname !== undefined ? { nickname: input.nickname.normalize('NFC') } : {}) } });
  // In-app reminders at the user's usual training time (7:00 / 12:00 / 18:00); push stays opt-in.
  if (input.trainTime) {
    const reminderMinute = { morning: 7 * 60, midday: 12 * 60, evening: 18 * 60 }[input.trainTime];
    await prisma.notificationPreference.upsert({ where: { userId }, create: { userId, enabled: true, reminders: true, reminderMinute }, update: { reminderMinute } });
  }
  return input;
}

export async function setProgram(userId: string, raw: unknown) {
  const { program } = z.object({ program: z.enum(PROGRAMS) }).strict().parse(raw);
  await prisma.fitnessProfile.updateMany({ where: { userId }, data: { program, planWeek: 1, ...(program === 'four_day' ? { daysPerWeek: 4 } : program === 'gym_beginner' ? { daysPerWeek: 3 } : {}) } });
  return { program };
}

// ---------- Water ----------
// Daily target: ~35 ml per kg body weight (common guidance for healthy adults), +500 ml on a day with a completed workout.
// Height does not change water needs directly; it is only used for BMI elsewhere.
export function waterTargetMl(weightKg: number | null, workedOut: boolean) {
  const base = Math.round(((weightKg ?? 60) * 35) / 50) * 50;
  return Math.min(5000, Math.max(1500, base + (workedOut ? 500 : 0)));
}
async function tz(userId: string) { return (await prisma.fitnessProfile.findUnique({ where: { userId }, select: { timezone: true } }))?.timezone ?? 'Asia/Yangon'; }
export async function waterSummary(userId: string, now = new Date()) {
  const zone = await tz(userId), today = civilDay(now, zone);
  const since = new Date(now.getTime() - 8 * 86400000);
  const [logs, weight, workout] = await Promise.all([
    prisma.waterLog.findMany({ where: { userId, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' }, select: { weightKg: true } }),
    prisma.workoutSession.findFirst({ where: { userId, status: 'completed', endedAt: { gte: new Date(now.getTime() - 36 * 3600000) } }, select: { endedAt: true }, orderBy: { endedAt: 'desc' } }),
  ]);
  const workedOut = !!workout?.endedAt && civilDay(workout.endedAt, zone) === today;
  const todayLogs = logs.filter(l => l.day === today);
  const week = Array.from({ length: 7 }, (_, i) => { const d = civilDay(new Date(now.getTime() - (6 - i) * 86400000), zone); return { day: d, ml: logs.filter(l => l.day === d).reduce((n, l) => n + l.ml, 0) }; });
  return { day: today, totalMl: todayLogs.reduce((n, l) => n + l.ml, 0), targetMl: waterTargetMl(weight?.weightKg ?? null, workedOut), weightKg: weight?.weightKg ?? null, workedOut,
    entries: todayLogs.map(l => ({ id: l.id, ml: l.ml, at: l.createdAt })).reverse(), week };
}
export async function addWater(userId: string, raw: unknown, now = new Date()) {
  const { ml } = z.object({ ml: z.number().int().min(50).max(1500) }).strict().parse(raw);
  await prisma.waterLog.create({ data: { userId, ml, day: civilDay(now, await tz(userId)) } });
  return waterSummary(userId, now);
}
export async function undoWater(userId: string, now = new Date()) {
  const zone = await tz(userId);
  const last = await prisma.waterLog.findFirst({ where: { userId, day: civilDay(now, zone) }, orderBy: { createdAt: 'desc' } });
  if (last) await prisma.waterLog.delete({ where: { id: last.id } });
  return waterSummary(userId, now);
}

// ---------- Streak board (Target tab): training, water, food logging, meal photos ----------
export const MILESTONES = [3, 7, 14, 30, 60, 100];
const nextMilestone = (n: number) => MILESTONES.find(m => m > n) ?? n + 30;
function streakOf(flags: boolean[]) { // flags oldest → today; today may still be open, so a missing today does not break it
  let cur = 0; for (let i = flags.length - 1; i >= 0; i--) { if (flags[i]) cur++; else if (i === flags.length - 1) continue; else break; }
  let best = 0, run = 0; for (const f of flags) { run = f ? run + 1 : 0; best = Math.max(best, run); }
  return { current: cur, best, next: nextMilestone(cur) };
}
export async function streakBoard(userId: string, now = new Date()) {
  const [profile, weight, game] = await Promise.all([prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' }, select: { weightKg: true } }), prisma.gameState.findUnique({ where: { userId }, select: { weekdays: true } })]);
  const zone = profile?.timezone ?? 'Asia/Yangon', today = civilDay(now, zone);
  const days = Array.from({ length: 90 }, (_, i) => addDay(today, i - 89));
  const since = new Date(now.getTime() - 91 * 86400000);
  const [water, food, sessions] = await Promise.all([
    prisma.waterLog.findMany({ where: { userId, day: { in: days } }, select: { day: true, ml: true } }),
    prisma.foodLog.findMany({ where: { userId, day: { in: days } }, select: { day: true, kcal: true, source: true } }),
    prisma.workoutSession.findMany({ where: { userId, status: 'completed', endedAt: { gte: since } }, select: { endedAt: true, completionPct: true } })]);
  let kcalTarget = 2000; try { kcalTarget = (await energySummary(userId)).targetIntake ?? 2000; } catch { /* profile incomplete */ }
  const planned = (game?.weekdays as number[] | undefined) ?? [];
  const rows = days.map(day => {
    const ml = water.filter(w => w.day === day).reduce((a, w) => a + w.ml, 0);
    const workedOut = sessions.some(x => x.endedAt && civilDay(x.endedAt, zone) === day);
    const wt = waterTargetMl(weight?.weightKg ?? null, workedOut);
    const meals = food.filter(f => f.day === day), kcal = meals.reduce((a, f) => a + f.kcal, 0);
    const pcts = sessions.filter(x => x.endedAt && civilDay(x.endedAt, zone) === day).map(x => x.completionPct ?? 100);
    return { day, waterPct: Math.min(100, Math.round(ml / wt * 100)), meals: meals.length, photos: meals.filter(f => f.source === 'photo').length,
      kcalPct: Math.round(kcal / kcalTarget * 100), workoutPct: pcts.length ? Math.max(...pcts) : null, planned: planned.includes(weekday(day)) };
  });
  const water30 = streakOf(rows.map(r => r.waterPct >= 100));
  const meals30 = streakOf(rows.map(r => r.meals >= 2));
  const photos30 = streakOf(rows.map(r => r.photos >= 1));
  // training: planned days must be trained (≥ 60%); rest days never break the chain
  const trainingFlags = rows.filter(r => r.planned || r.workoutPct !== null).map(r => (r.workoutPct ?? 0) >= 60);
  const training = streakOf(trainingFlags);
  return { today, kcalTarget, grid: rows.slice(-35), streaks: { training, water: water30, meals: meals30, photos: photos30 }, milestones: MILESTONES };
}
