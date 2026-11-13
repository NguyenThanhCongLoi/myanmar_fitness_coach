import {getPlan} from './plan';
import {eligibleExercises} from '@/shared/workout-policy';
import {recommendFor} from '@/shared/program';
import {progressionFor} from './progression';
import {trimToMinutes,minutesFor} from '@/shared/plan';
import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { buildWeek, bmiOf, secondsFor, type DaySplit } from '@/shared/plan';
import { readBodyPreferences, focusMuscles } from '@/shared/body-preferences';
import { startingStep } from '@/shared/training-profile';
import type { Level } from '@/shared/dose';

export async function previewQuickWorkout(userId: string, raw: unknown) {
  const input = z.object({ focus: z.enum(['all','upper','legs','core','cardio']), minutes: z.union([z.literal(15),z.literal(20),z.literal(30)]), location: z.enum(['home','gym']), exerciseId:z.string().max(100).optional(), single:z.boolean().optional() }).strict().parse(raw);
  const [profile, measurement, all] = await Promise.all([prisma.fitnessProfile.findUnique({where:{userId}}),
    prisma.bodyMeasurement.findFirst({where:{userId},orderBy:{recordedAt:'desc'}}), prisma.exercise.findMany()]);
  if (!profile?.onboarded || profile.intakeVersion !== 1) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  const main=await getPlan(userId,input.location);
  const selectedStep=main.adaptive.todayChoice?.lighter?Math.max(0,main.step-1):main.step;
  const body = readBodyPreferences(profile.bodyPreferences), screening = profile.screening as Record<string,boolean>;
  if ((screening.heart || screening.chestPain || screening.dizziness || screening.pregnancy) && !profile.healthClearance) throw new ApiError(400,'HEALTH_REVIEW_REQUIRED');
  const factors = {age: profile.birthYear ? new Date().getUTCFullYear()-profile.birthYear : null, goal:profile.goal, weightGoal:profile.weightGoal, activityLevel:profile.activityLevel, screened:Object.values(screening).some(Boolean),fatigue:main.tired};
  const lowImpact = factors.screened || (factors.age ?? 0)>=65;
  let library = all.map(e=>({...e,equipment:e.equipment as string[],primaryMuscles:e.primaryMuscles as string[],secondaryMuscles:e.secondaryMuscles as string[],tags:e.tags as string[],guidance:e.guidance as {perSide?:boolean;home?:unknown[]}}))
;
  library=eligibleExercises(library,profile,input.location);
  if(input.exerciseId){
    const base=library.find(e=>e.id===input.exerciseId);
    if(!base)throw new ApiError(422,'NO_EXERCISE_MATCH');
    const rank=['beginner','intermediate','advanced'];
    if(rank.indexOf(base.difficulty)>rank.indexOf(profile.experience))throw new ApiError(422,'NO_EXERCISE_MATCH');
    const rec=recommendFor(base,library,input.location,profile.experience as Level);
    const ids=new Set([base.id,...(input.single?[]:[...rec.sameMuscle,...rec.complementary].map(x=>x.id))]);
    library=library.filter(e=>ids.has(e.id)).map(e=>e.id===input.exerciseId?{...e,tags:e.tags.filter(t=>t!=='warmup'&&t!=='cooldown')}:e); // Explicit Try includes preparation moves; automatic strength selection still excludes them.
  }
  const day = buildWeek({program:'personal',daysPerWeek:1,library,location:input.location,step:selectedStep,bmi:bmiOf(measurement?.weightKg,profile.heightCm),week:profile.planWeek,sessionMinutes:input.minutes,lowImpact,priorityMuscles:focusMuscles(body),factors,splitOverride:input.focus==='all'?'full':input.focus as DaySplit})[0];
  if(input.exerciseId && day){const base=library.find(e=>e.id===input.exerciseId)!;const anchor=buildWeek({program:'personal',daysPerWeek:1,library:[base],location:input.location,step:selectedStep,bmi:null,week:profile.planWeek,sessionMinutes:input.minutes,factors})[0]?.items[0];if(!anchor)throw new ApiError(422,'NO_EXERCISE_MATCH');day.items=trimToMinutes([anchor,...day.items.filter(i=>i.id!==input.exerciseId)],input.minutes);day.minutes=minutesFor(day.items);}
  if(input.location==='gym'&&day?.items.length){const loads=await progressionFor(userId,day.items.map(i=>i.id));day.items=day.items.map(i=>({...i,weightKg:(main.adaptive.decision.change!=='same'&&loads[i.id]?.suggestion?.note==='ADD_LOAD')?Math.max(0,...(loads[i.id]?.suggestion?.previous??[]).map(s=>s.weightKg)):loads[i.id]?.suggestion?.weightKg??0}));day.items=trimToMinutes(day.items,input.minutes);day.minutes=minutesFor(day.items);}
  if (!day?.items.length) throw new ApiError(422,'NO_EXERCISE_MATCH');
  return {...day,seconds:secondsFor(day.items),requestedMinutes:input.minutes,location:input.location};
}
