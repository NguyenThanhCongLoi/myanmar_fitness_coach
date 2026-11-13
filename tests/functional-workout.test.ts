import {afterAll,expect,test} from 'vitest';
import {prisma} from '../src/shared/lib/prisma';
import {saveIntake} from '../src/server/intake';
import {previewQuickWorkout} from '../src/server/quick-workout';
import {createTraining} from '../src/server/training';
import {readPlayback,savePlayback} from '../src/server/playback';
import {DEFAULT_BODY_PREFERENCES} from '../src/shared/body-preferences';
import {blockRest} from '../src/shared/workout-timing';
const prefix=`functional-${Date.now()}`;
afterAll(async()=>{await prisma.user.deleteMany({where:{id:{startsWith:prefix}}});});
const intake={locale:'en',goal:'general_fitness',experience:'beginner',equipment:['body weight'],daysPerWeek:3,limitations:'',weightUnit:'kg',distanceUnit:'km',timezone:'Asia/Yangon',heightCm:170,weightKg:70,age:30,sex:'unspecified',activityLevel:'active',trainingLocation:'home',sessionMinutes:20,weightGoal:'maintain',bodyPreferences:DEFAULT_BODY_PREFERENCES,screening:{heart:false,chestPain:false,dizziness:false,joint:false,medication:false,pregnancy:false,other:false},healthClearance:false};
test('quick and recommended plans share equipment/ability rules and exact duration choices',async()=>{
  const id=prefix+'plan';await prisma.user.create({data:{id,name:'Disposable',email:id+'@example.test'}});await saveIntake(id,intake);
  for(const minutes of [15,20,30]){const p=await previewQuickWorkout(id,{focus:'all',location:'home',minutes});expect(p.seconds).toBeLessThanOrEqual(minutes*60);expect(p.items.length).toBeGreaterThan(0);}
  await expect(previewQuickWorkout(id,{focus:'all',location:'home',minutes:10})).rejects.toThrow();
  await expect(createTraining(id,'free',{name:'Missing location must not bypass gear',exercises:[{exerciseId:'gym-leg-press',sets:1,reps:10,restSeconds:90,targetKg:0}]})).rejects.toMatchObject({code:'EXERCISE_LOCATION_MISMATCH'});
  const single=await previewQuickWorkout(id,{focus:'all',location:'home',minutes:15,exerciseId:'curated-bird-dog',single:true});
  const warmup=await previewQuickWorkout(id,{focus:'all',location:'home',minutes:15,exerciseId:'vid-arm-circles',single:true});expect(warmup.items.map(i=>i.id)).toEqual(['vid-arm-circles']);
  expect(single.items).toHaveLength(1);expect(single.items[0].perSide).toBe(true);
  await expect(previewQuickWorkout(id,{focus:'all',location:'gym',minutes:15})).rejects.toMatchObject({code:'NO_EXERCISE_MATCH'});
  await saveIntake(id,{...intake,trainingLocation:'gym',equipment:['machine']});
  const gym=await previewQuickWorkout(id,{focus:'all',location:'gym',minutes:20});
  const records=await prisma.exercise.findMany({where:{id:{in:gym.items.map(i=>i.id)}}});
  expect(records.every(e=>(e.equipment as string[]).every(q=>q==='machine'||q==='body weight'))).toBe(true);
  expect((await prisma.fitnessProfile.findUniqueOrThrow({where:{userId:id}})).equipment).toEqual(['body weight','machine']);
});
test('checkpoint is owner isolated, rejects fabricated steps, ignores stale retries',async()=>{
  const a=prefix+'a',b=prefix+'b';await prisma.user.createMany({data:[a,b].map(id=>({id,name:'Disposable',email:id+'@example.test'}))});await saveIntake(a,intake);
  const s=await createTraining(a,'free',{requestId:'functional-start-2026',name:'Bird pair',location:'home',exercises:[{exerciseId:'curated-bird-dog',sets:2,reps:20,restSeconds:10,targetKg:0,timed:true}]});
  const retry=await createTraining(a,'free',{requestId:'functional-start-2026',name:'Bird pair',location:'home',exercises:[{exerciseId:'curated-bird-dog',sets:2,reps:20,restSeconds:10,targetKg:0,timed:true}]});expect(retry.id).toBe(s.id);
  const value={version:1,prescriptionId:s.prescriptions[0].id,setIndex:0,phase:'work',remaining:12,restTotal:10,gymElapsed:0,paused:true,reps:20,kg:0,rir:null,activeSeconds:18,sequence:2};
  await savePlayback(a,s.id,value);expect(await readPlayback(a,s.id)).toMatchObject(value);
  await savePlayback(a,s.id,{...value,sequence:1,remaining:19});expect((await readPlayback(a,s.id))?.remaining).toBe(12);
  await expect(readPlayback(b,s.id)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(savePlayback(b,s.id,value)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(savePlayback(a,s.id,{...value,setIndex:7,sequence:3})).rejects.toMatchObject({code:'INVALID_SET'});
  await expect(createTraining(b,'free',{name:'Missing side',location:'home',exercises:[{exerciseId:'curated-bird-dog',sets:1,reps:20,restSeconds:10,timed:true}]})).rejects.toMatchObject({code:'INVALID_SET'});
});
test('rest includes bounded set fatigue, transition and round allowances',()=>{
  expect(blockRest(10,0,true,false)).toBe(10);expect(blockRest(15,2,true,true,true)).toBe(40);
  expect(blockRest(120,2,false,false)).toBe(130);expect(blockRest(590,6,false,true)).toBe(600);
});
