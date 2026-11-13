import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { intakeInput, saveIntake } from '../src/server/intake';
import { previewQuickWorkout } from '../src/server/quick-workout';
import { getPlan } from '../src/server/plan';
import { HOME_VIDEO_IDS, availableAt, hasCollectionVideo } from '../src/shared/exercise-place';
import { DEFAULT_BODY_PREFERENCES } from '../src/shared/body-preferences';
import { restFor, startingStep } from '../src/shared/training-profile';
import { secondsFor } from '../src/shared/plan';
const prefix = `intake-${Date.now()}`;
afterAll(async()=>{await prisma.user.deleteMany({where:{id:{startsWith:prefix}}});await prisma.$disconnect();});
const input = {locale:'en',goal:'general_fitness',experience:'beginner',equipment:['body weight'],daysPerWeek:3,
  limitations:'',weightUnit:'kg',distanceUnit:'km',timezone:'Asia/Yangon',heightCm:170,weightKg:70,age:30,sex:'unspecified',
  activityLevel:'sedentary',trainingLocation:'home',sessionMinutes:20,weightGoal:'maintain',bodyPreferences:DEFAULT_BODY_PREFERENCES,
  screening:{heart:false,chestPain:false,dizziness:false,joint:false,medication:false,pregnancy:false,other:false},healthClearance:false};
test('intake requires demographics, explicit screening and bounded values, never a caller userId',()=>{
  for(const key of ['age','heightCm','weightKg','sex','activityLevel','screening']) {const v={...input} as Record<string,unknown>;delete v[key];expect(intakeInput.safeParse(v).success).toBe(false);}
  for(const patch of [{age:16},{heightCm:0},{weightKg:0},{userId:'another'}])expect(intakeInput.safeParse({...input,...patch}).success).toBe(false);
});
test('19 real Home clips, no dumbbells/bench/legacy animation can leak into Home',async()=>{
  const all=await prisma.exercise.findMany();
  const rows=all.map(e=>({...e,equipment:e.equipment as string[]}));
  const home=rows.filter(e=>availableAt(e,'home')&&hasCollectionVideo(e));
  expect(home.map(e=>e.id).sort()).toEqual([...HOME_VIDEO_IDS].sort());
  expect(availableAt({id:'core-165',equipment:['body weight']},'home')).toBe(false);
  for(const e of rows.filter(e=>e.equipment.includes('dumbbell'))){expect(availableAt(e,'home')).toBe(false);expect(availableAt(e,'gym')).toBe(true);}
  expect(home.some(e=>availableAt(e,'gym'))).toBe(false);
});
test('age/activity/goal change the starting workload and recovery, with a real two-side duration',()=>{
  expect(startingStep('advanced',{age:70,activityLevel:'active'})).toBe(0);
  expect(startingStep('advanced',{activityLevel:'sedentary'})).toBe(0);
  expect(startingStep('intermediate',{activityLevel:'active'})).toBe(2);
  expect(restFor({equipment:[]},'home',{activityLevel:'active'},4)).toBe(10);
  expect(restFor({equipment:[]},'home',{activityLevel:'sedentary'},0)).toBe(30);
  expect(restFor({equipment:['machine']},'gym',{goal:'build_strength'},2)).toBe(150);
  expect(restFor({equipment:['machine']},'gym',{goal:'build_muscle'},2)).toBe(90);
  expect(restFor({id:'gym-leg-press',equipment:['machine']},'gym',{goal:'build_muscle'},2)).toBe(120);
  expect(secondsFor([{id:'curated-bird-dog',sets:1,target:20,unit:'seconds',rest:10,perSide:true}])).toBe(60);
});
test('one atomic owner-scoped intake creates a real baseline and different Home/Gym plans',async()=>{
  const a=prefix+'a',b=prefix+'b';await prisma.user.createMany({data:[a,b].map(id=>({id,name:'Disposable',email:id+'@example.test'}))});
  await expect(saveIntake(a,{...input,weightGoal:'lose',weightKg:35})).rejects.toMatchObject({code:'GOAL_BMI_TOO_LOW'});
  await expect(saveIntake(a,{...input,screening:{...input.screening,heart:true}})).rejects.toMatchObject({code:'HEALTH_REVIEW_REQUIRED'});
  expect(await prisma.fitnessProfile.findUnique({where:{userId:a}})).toBeNull();
  await saveIntake(a,input);
  const saved=await prisma.fitnessProfile.findUniqueOrThrow({where:{userId:a}});
  expect(saved).toMatchObject({heightCm:170,sex:'unspecified',intakeVersion:1,trainingLocation:'home',planStep:0});
  expect(saved.birthYear).toBe(new Date().getUTCFullYear()-30);
  expect(await prisma.bodyMeasurement.count({where:{userId:a}})).toBe(1);
  expect(await prisma.bodyMeasurement.count({where:{userId:b}})).toBe(0);
  // The removed protected-area question must not leave a hidden required answer.
  await saveIntake(a,{...input,screening:{...input.screening,joint:true},bodyPreferences:{...DEFAULT_BODY_PREFERENCES,protectedAreas:[]}});
  expect((await prisma.fitnessProfile.findUniqueOrThrow({where:{userId:a}})).screening).toMatchObject({joint:true});
  const jointPlan=await getPlan(a,'home');
  expect(jointPlan.days.every(d=>d.items.every(i=>i.rest>=30))).toBe(true);
  await saveIntake(a,input);
  const plan=await getPlan(a,'home');expect(plan.days.length).toBe(3);
  expect(plan.days.flatMap(d=>d.items).every(i=>(HOME_VIDEO_IDS as readonly string[]).includes(i.id))).toBe(true);
  const home=await previewQuickWorkout(a,{focus:'all',minutes:15,location:'home'});
  const gym=await previewQuickWorkout(a,{focus:'all',minutes:15,location:'gym'});
  expect(home.seconds).toBeLessThanOrEqual(900);expect(gym.seconds).toBeLessThanOrEqual(900);
  expect(home.items.every(i=>(HOME_VIDEO_IDS as readonly string[]).includes(i.id))).toBe(true);
  const equipment=await prisma.exercise.findMany({where:{id:{in:gym.items.map(i=>i.id)}}});
  expect(equipment.length).toBeGreaterThan(0);expect(equipment.every(e=>availableAt({id:e.id,equipment:e.equipment as string[]},'gym'))).toBe(true);
  await expect(previewQuickWorkout(b,{focus:'all',minutes:15,location:'home'})).rejects.toMatchObject({code:'COMPLETE_PROFILE_FIRST'});
  await expect(saveIntake(a,{...input,userId:b})).rejects.toThrow();
  await saveIntake(b,{...input,trainingLocation:'gym',age:66,experience:'advanced',activityLevel:'active',goal:'build_strength'});
  const gymDefault=await getPlan(b,null);
  expect(gymDefault.location).toBe('gym');
  expect(gymDefault.step).toBe(0);
  const gymIds=gymDefault.days.flatMap(d=>d.items.map(i=>i.id));
  const gymCatalog=await prisma.exercise.findMany({where:{id:{in:gymIds}}});
  expect(gymIds.length).toBeGreaterThan(0);
  expect(gymCatalog.every(e=>availableAt({id:e.id,equipment:e.equipment as string[]},'gym')&&hasCollectionVideo({id:e.id,equipment:e.equipment as string[],videoUrl:e.videoUrl}))).toBe(true);
  expect(gymDefault.days.every(d=>d.minutes<=20&&d.items.every(i=>i.rest>=150))).toBe(true);
});
