import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { availableAt, hasCollectionVideo } from '@/shared/exercise-place';
import { buildWeek, bmiOf, secondsFor, type DaySplit } from '@/shared/plan';
import { readBodyPreferences, focusMuscles } from '@/shared/body-preferences';
import { startingStep } from '@/shared/training-profile';
import type { Level } from '@/shared/dose';

export async function previewQuickWorkout(userId: string, raw: unknown) {
  const input = z.object({ focus: z.enum(['all','upper','legs','core','cardio']), minutes: z.number().int().min(5).max(45), location: z.enum(['home','gym']) }).strict().parse(raw);
  const [profile, measurement, all] = await Promise.all([prisma.fitnessProfile.findUnique({where:{userId}}),
    prisma.bodyMeasurement.findFirst({where:{userId},orderBy:{recordedAt:'desc'}}), prisma.exercise.findMany()]);
  if (!profile?.onboarded || profile.intakeVersion !== 1) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const body = readBodyPreferences(profile.bodyPreferences), screening = profile.screening as Record<string,boolean>;
  if ((screening.heart || screening.chestPain || screening.dizziness || screening.pregnancy) && !profile.healthClearance) throw new ApiError(400,'HEALTH_REVIEW_REQUIRED');
  const factors = {age: profile.birthYear ? new Date().getUTCFullYear()-profile.birthYear : null, goal:profile.goal, weightGoal:profile.weightGoal, activityLevel:profile.activityLevel, screened:Object.values(screening).some(Boolean)};
  const protectedTags: Record<string,string[]> = {knees:['jumping','knee-loaded'],back:['back-loaded'],shoulders:['overhead'],wrists:['wrist-loaded']};
  const avoided = new Set(body.protectedAreas.flatMap(a=>protectedTags[a]));
  const lowImpact = factors.screened || (factors.age ?? 0)>=65;
  const library = all.map(e=>({...e,equipment:e.equipment as string[],primaryMuscles:e.primaryMuscles as string[],secondaryMuscles:e.secondaryMuscles as string[],tags:e.tags as string[],guidance:e.guidance as {perSide?:boolean;home?:unknown[]}}))
    .filter(e=>availableAt(e,input.location)&&hasCollectionVideo(e)&&!e.tags.some(t=>avoided.has(t)||(lowImpact&&t==='jumping')));
  const day = buildWeek({program:'personal',daysPerWeek:1,library,location:input.location,step:Math.max(0,profile.planStep < 0 ? startingStep(profile.experience as Level,factors):profile.planStep),bmi:bmiOf(measurement?.weightKg,profile.heightCm),week:profile.planWeek,sessionMinutes:input.minutes,lowImpact,priorityMuscles:focusMuscles(body),factors,splitOverride:input.focus==='all'?'full':input.focus as DaySplit})[0];
  if (!day?.items.length) throw new ApiError(422,'NO_EXERCISE_MATCH');
  return {...day,seconds:secondsFor(day.items),requestedMinutes:input.minutes,location:input.location};
}
