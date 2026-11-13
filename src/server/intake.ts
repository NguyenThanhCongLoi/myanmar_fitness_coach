import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError, profileSchema } from './validation';
import { bodyPreferencesSchema } from '@/shared/body-preferences';
import { civilDay } from './streak';
import { startingStep } from '@/shared/training-profile';

export const intakeInput = profileSchema.extend({
  heightCm: z.number().min(120).max(230), weightKg: z.number().min(30).max(250),
  age: z.number().int().min(18).max(90), sex: z.enum(['male', 'female', 'unspecified']),
  activityLevel: z.enum(['sedentary', 'light', 'active']), trainingLocation: z.enum(['home', 'gym']),
  sessionMinutes: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(45)]),
  weightGoal: z.enum(['lose', 'maintain', 'gain']), bodyPreferences: bodyPreferencesSchema,
  screening: profileSchema.shape.screening.unwrap(), healthClearance: z.boolean(),
}).strict();
export async function saveIntake(userId: string, raw: unknown) {
  const { weightKg, age, ...body } = intakeInput.parse(raw);
  const bmi = weightKg / (body.heightCm / 100) ** 2;
  if (body.weightGoal === 'lose' && bmi < 18.5) throw new ApiError(400, 'GOAL_BMI_TOO_LOW');
  const needsReview = body.screening.heart || body.screening.chestPain || body.screening.dizziness || body.screening.pregnancy;
  if (needsReview && !body.healthClearance) throw new ApiError(400, 'HEALTH_REVIEW_REQUIRED');
  const screened = Object.values(body.screening).some(Boolean);
  const equipment = body.trainingLocation === 'home' ? ['body weight'] : [...new Set(['body weight', ...body.equipment])];
  const weekdays = ({1:[0],2:[0,3],3:[0,2,4],4:[0,1,3,5],5:[0,1,2,4,5],6:[0,1,2,3,4,5]} as Record<number,number[]>)[body.daysPerWeek];
  const data = { ...body, equipment, birthYear: new Date().getUTCFullYear() - age, intakeVersion: 1,
    onboarded: true, program: 'personal', planWeek: 1,
    planStep: startingStep(body.experience, { age, screened, activityLevel: body.activityLevel }) };
  // All answers, baseline measurement and calendar commit together; failed validation writes nothing.
  return prisma.$transaction(async tx => {
    const previous = await tx.fitnessProfile.findUnique({where:{userId}});
    const profile = await tx.fitnessProfile.upsert({ where: { userId }, create: { userId, ...data }, update: {...data, planWeek: previous?.planWeek ?? 1} });
    await tx.bodyMeasurement.create({ data: { userId, weightKg, ...(body.bodyPreferences.waistCm ? { waistCm: body.bodyPreferences.waistCm } : {}) } });
    await tx.gameState.upsert({ where: { userId }, create: { userId, weekdays, scheduleChosen: true, weeklyGoal: body.daysPerWeek, timezone: body.timezone, cursor: civilDay(new Date(), body.timezone) }, update: { weekdays, scheduleChosen: true, weeklyGoal: body.daysPerWeek } });
    // Previous progression baselines must not silently override a freshly reviewed intake.
    await tx.aiMemory.deleteMany({ where: { userId, key: { startsWith: 'plan:' } } });
    return profile;
  });
}
