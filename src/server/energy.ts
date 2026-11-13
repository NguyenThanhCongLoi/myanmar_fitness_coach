import { doneBalance } from './balance';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { addDay, civilDay } from './streak';
import { ACTIVITIES, activityKcal, baseline, bmr, intakeTarget, projection, workoutKcal, type Body, type WeightGoal } from '@/shared/energy';
import { nutritionGuidance, type Goal } from '@/shared/program';

const bodyInput = z.object({ heightCm: z.number().min(120).max(230).nullable(), birthYear: z.number().int().min(1930).max(new Date().getUTCFullYear() - 13).nullable(),
  sex: z.enum(['male', 'female', 'unspecified']).nullable(), goalWeightKg: z.number().min(30).max(250).nullable(), weightGoal: z.enum(['lose', 'maintain', 'gain']) }).strict();
const foodInput = z.object({ meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']), description: z.string().trim().min(1).max(120), kcal: z.number().int().min(1).max(3000), proteinG: z.number().min(0).max(200).default(0) , source: z.enum(['manual', 'photo', 'ai']).default('manual')}).strict();
const activityInput = z.object({ kind: z.enum(Object.keys(ACTIVITIES) as [keyof typeof ACTIVITIES, ...(keyof typeof ACTIVITIES)[]]), minutes: z.number().int().min(1).max(600) }).strict();

async function context(userId: string) {
  const [profile, m] = await Promise.all([prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } })]);
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const body: Body = { weightKg: m?.weightKg ?? null, heightCm: profile.heightCm, birthYear: profile.birthYear, sex: profile.sex };
  return { profile, body, today: civilDay(new Date(), profile.timezone) };
}
export async function saveBody(userId: string, raw: unknown) {
  const input = bodyInput.parse(raw);
  // a goal weight below a healthy BMI (18.5) is refused, e.g. 35 kg at 170 cm (BMI ~12)
  const height = input.heightCm ?? (await prisma.fitnessProfile.findUnique({ where: { userId }, select: { heightCm: true } }))?.heightCm ?? null;
  if (height && input.goalWeightKg && input.goalWeightKg / (height / 100) ** 2 < 18.5) throw new ApiError(400, 'GOAL_BMI_TOO_LOW');
  return prisma.fitnessProfile.update({ where: { userId }, data: { ...input, sex: input.sex === 'unspecified' ? null : input.sex } });
}
export async function logFood(userId: string, raw: unknown) {
  const input = foodInput.parse(raw); const { today } = await context(userId);
  return prisma.foodLog.create({ data: { userId, day: today, ...input, description: input.description.normalize('NFC') } });
}
export async function logActivity(userId: string, raw: unknown) {
  const input = activityInput.parse(raw); const { today, body } = await context(userId);
  return prisma.activityLog.create({ data: { userId, day: today, kind: input.kind, minutes: input.minutes, kcal: activityKcal(input.kind, input.minutes, body.weightKg ?? 70) } });
}
export async function deleteLog(userId: string, raw: unknown) {
  const { kind, id } = z.object({ kind: z.enum(['food', 'activity']), id: z.string().max(40) }).strict().parse(raw);
  const r = kind === 'food' ? await prisma.foodLog.deleteMany({ where: { id, userId } }) : await prisma.activityLog.deleteMany({ where: { id, userId } });
  if (!r.count) throw new ApiError(404, 'NOT_FOUND');
  return { deleted: true };
}
// 7-day energy picture from the user's own logs and completed workouts.
export async function energySummary(userId: string) {
  const { profile, body, today } = await context(userId);
  const days = Array.from({ length: 7 }, (_, i) => addDay(today, i - 6));
  const since = new Date(Date.now() - 8 * 86400000);
  const [foods, acts, sessions] = await Promise.all([
    prisma.foodLog.findMany({ where: { userId, day: { in: days } }, orderBy: { createdAt: 'asc' } }),
    prisma.activityLog.findMany({ where: { userId, day: { in: days } }, orderBy: { createdAt: 'asc' } }),
    prisma.workoutSession.findMany({ where: { userId, status: 'completed', endedAt: { gte: since } }, select: { startedAt: true, endedAt: true, totalPausedMs: true } }),
  ]);
  const w = body.weightKg ?? 70, base = baseline(body, (profile as { activityLevel?: 'sedentary' | 'light' | 'active' }).activityLevel ?? 'light'), goal = profile.weightGoal as WeightGoal;
  const daily = days.map(day => {
    const intake = foods.filter(f => f.day === day).reduce((n, f) => n + f.kcal, 0);
    const protein = foods.filter(f => f.day === day).reduce((n, f) => n + f.proteinG, 0);
    const activity = acts.filter(a => a.day === day).reduce((n, a) => n + a.kcal, 0);
    const workout = sessions.filter(s => civilDay(s.endedAt!, profile.timezone) === day).reduce((n, s) => n + workoutKcal(Math.max(0, (s.endedAt!.getTime() - s.startedAt.getTime() - s.totalPausedMs) / 60000), w), 0);
    const out = base === null ? null : base + activity + workout;
    return { day, intake, protein: Math.round(protein), activity, workout, out, balance: out === null || intake === 0 ? null : intake - out, logged: intake > 0 };
  });
  const loggedDays = daily.filter(d => d.balance !== null);
  const avg = loggedDays.length ? Math.round(loggedDays.reduce((n, d) => n + d.balance!, 0) / loggedDays.length) : null;
  const todayRow = daily[6];
  return {
    today, body, bmr: bmr(body), baseline: base, weightGoal: goal, goalWeightKg: profile.goalWeightKg,
    // under 18: no calorie targets (growing bodies need individual advice)
    targetIntake: body.birthYear && new Date().getFullYear() - body.birthYear < 18 ? null : intakeTarget(body, goal, todayRow.activity + todayRow.workout), protein: nutritionGuidance(body.weightKg, profile.goal as Goal).proteinG,
    daily, avgBalance: avg, loggedDays: loggedDays.length, projection: avg === null ? null : projection(avg, body.weightKg, profile.goalWeightKg),
    foodsToday: foods.filter(f => f.day === today), activitiesToday: acts.filter(a => a.day === today),
    missing: [...(!body.weightKg ? ['weight'] : []), ...(!body.heightCm ? ['height'] : []), ...(!body.birthYear ? ['birthYear'] : [])],
  };
}
// Proactive coach insights from real data (shown in AI Coach; also available to the model as a tool). Codes are localized in the UI.
export async function coachInsights(userId: string) {
  const e = await energySummary(userId);
  const game = await prisma.gameState.findUnique({ where: { userId } });
  const weekCount = await prisma.workoutCredit.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } });
  const out: { code: string; values?: Record<string, string | number> }[] = [];
  if (e.missing.length) out.push({ code: 'ADD_BODY_DATA' });
  out.push({ code: 'WORKOUTS_WEEK', values: { done: weekCount, goal: game?.weeklyGoal ?? 3 } });
  const t = e.daily[6];
  if (e.targetIntake && t.logged) out.push({ code: t.intake > e.targetIntake ? 'INTAKE_ABOVE' : 'INTAKE_WITHIN', values: { intake: t.intake, target: e.targetIntake } });
  if (!t.logged) out.push({ code: 'LOG_FOOD' });
  if (e.protein && t.logged && t.protein < e.protein[0]) out.push({ code: 'PROTEIN_LOW', values: { protein: t.protein, min: e.protein[0] } });
  if (e.projection?.weeksToGoal) out.push({ code: 'GOAL_PROJECTION', values: { weekly: e.projection.weeklyKg, weeks: e.projection.weeksToGoal } });
  else if (e.projection && e.goalWeightKg && e.loggedDays >= 3) out.push({ code: 'GOAL_OFF_TRACK', values: { weekly: e.projection.weeklyKg } });
  // muscle balance of the last 7 days of training (too much arms/abs, a big group skipped)
  for (const i of (await doneBalance(userId)).issues) out.push(i);
  return out;
}
