import { z } from 'zod';

export const localeSchema = z.enum(['my-MM', 'en']);
export const profileSchema = z.object({
  locale: localeSchema,
  goal: z.enum(['general_fitness', 'build_strength', 'build_muscle', 'improve_endurance']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  equipment: z.array(z.enum(['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'])).min(1).max(7).refine(x => new Set(x).size === x.length),
  daysPerWeek: z.number().int().min(1).max(6),
  limitations: z.string().trim().max(1000).default(''),
  weightUnit: z.enum(['kg', 'lb']), distanceUnit: z.enum(['km', 'mi']),
  screening: z.object({ heart: z.boolean(), chestPain: z.boolean(), dizziness: z.boolean(), joint: z.boolean(), medication: z.boolean(), pregnancy: z.boolean(), other: z.boolean() }).strict().optional(),
  timezone: z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}).default('Asia/Yangon'),
}).strict();

const prescription = z.object({
  exerciseId: z.string().min(1).max(100), sets: z.number().int().min(1).max(8),
  reps: z.number().int().min(1).max(50), restSeconds: z.number().int().min(15).max(600),
  targetKg: z.number().min(0).max(400).default(0),
}).strict();
export const planSchema = z.object({
  name: z.string().trim().min(2).max(100), goal: z.string().trim().min(2).max(300),
  weeks: z.number().int().min(1).max(8),
  days: z.array(z.object({
    name: z.string().trim().min(1).max(100), week: z.number().int().min(1).max(8),
    weekday: z.number().int().min(0).max(6), exercises: z.array(prescription).min(1).max(8),
  }).strict()).min(1).max(24),
}).strict().superRefine((plan, context) => {
  const dates = plan.days.map(day => `${day.week}:${day.weekday}`);
  if (new Set(dates).size !== dates.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate training day' });
  if (plan.days.some(day => day.week > plan.weeks)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Day exceeds plan length' });
});
export type PlanInput = z.infer<typeof planSchema>;

export const setSchema = z.object({
  exerciseId: z.string().min(1).max(100), setIndex: z.number().int().min(0).max(7),
  reps: z.number().int().min(1).max(600), weight: z.number().min(0).max(900),
  unit: z.enum(['kg', 'lb']), restSeconds: z.number().int().min(10).max(600).default(60),
  rir: z.number().int().min(0).max(5).nullable().optional(),
  kind: z.enum(['normal', 'warmup', 'drop', 'failure']).default('normal'),
  seconds: z.number().int().min(0).max(3600).optional(),
}).strict().refine(value => toKg(value.weight, value.unit) <= 400, 'Weight exceeds POC input range');
export function toKg(value: number, unit: string) { return unit === 'lb' ? value * 0.45359237 : value; }
export function fromKg(value: number, unit: string) { return unit === 'lb' ? value / 0.45359237 : value; }

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: Record<string, unknown>) { super(code); }
}

export function yangonDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Yangon', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function workoutStreak(dates: Date[], now = new Date()) {
  const days = new Set(dates.map(yangonDay));
  const today = new Date(yangonDay(now) + 'T00:00:00Z');
  if (!days.has(today.toISOString().slice(0, 10))) today.setUTCDate(today.getUTCDate() - 1);
  let streak = 0;
  while (days.has(today.toISOString().slice(0, 10))) { streak++; today.setUTCDate(today.getUTCDate() - 1); }
  return streak;
}
