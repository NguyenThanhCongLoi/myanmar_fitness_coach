import {expect,test,afterAll} from 'vitest';
import {prisma} from '../src/shared/lib/prisma';
import {syncDays,grantWorkoutCredit,gameSummary,updateGameSettings} from '../src/server/gamification';
import {createPlan,startSession,finishSession,logSet} from '../src/server/services';
import {notificationState,saveNotificationPreferences,tickUser,pushSubscriptionSchema} from '../src/server/notifications';
const prefix='game-test-'+Date.now();
afterAll(async()=>{await prisma.user.deleteMany({where:{id:{startsWith:prefix}}});await prisma.$disconnect();});
async function user(suffix:string){const id=prefix+suffix;await prisma.user.create({data:{id,name:'Test',email:id+'@example.test'}});return id;}
test('auto freeze consumes once, missed days recover, and timezone changes preserve snapshots',async()=>{
 const id=await user('freeze');
 await prisma.$transaction(tx=>syncDays(tx,id,new Date('2026-11-02T12:00:00Z')));
 await prisma.$transaction(tx=>syncDays(tx,id,new Date('2026-11-05T12:00:00Z')));
 expect((await prisma.gameState.findUniqueOrThrow({where:{userId:id}})).shields).toBe(0);
 expect(await prisma.gameDay.count({where:{userId:id,kind:'protected'}})).toBe(2);
 await prisma.$transaction(tx=>syncDays(tx,id,new Date('2026-11-05T12:00:00Z')));
 expect((await prisma.gameState.findUniqueOrThrow({where:{userId:id}})).shields).toBe(0);
 await prisma.$transaction(tx=>syncDays(tx,id,new Date('2026-11-07T12:00:00Z')));
 expect(await prisma.gameDay.count({where:{userId:id,kind:'missed'}})).toBe(1);
 const old=await prisma.gameDay.findMany({where:{userId:id},orderBy:{day:'asc'}});
 await updateGameSettings(id,{timezone:'America/New_York',weekdays:[0,2,4],weeklyGoal:3,protectionEnabled:true,recoveryDays:2},new Date('2026-11-07T12:00:00Z'));
 await prisma.$transaction(tx=>syncDays(tx,id,new Date('2026-11-09T12:00:00Z')));
 for(const d of old)expect((await prisma.gameDay.findUniqueOrThrow({where:{id:d.id}})).timezone).toBe(d.timezone);
 await expect(updateGameSettings(id,{timezone:'Asia/Tokyo',weekdays:[0],weeklyGoal:1,protectionEnabled:true,recoveryDays:0},new Date('2026-11-09T13:00:00Z'))).rejects.toMatchObject({code:'TIMEZONE_COOLDOWN'});
});
test('verified completion, no duplicate XP, no reward from app opens or backdated sessions',async()=>{
 const id=await user('credit'),other=await user('other'),exercise=await prisma.exercise.findFirstOrThrow();
 const plan=await createPlan(id,{name:'My plan',goal:'A steady habit',weeks:1,days:[{name:'Day one',week:1,weekday:0,exercises:[{exerciseId:exercise.id,sets:2,reps:5,restSeconds:30,targetKg:0}]}]});
 const session=await startSession(id,plan.days[0].id);
 await logSet(id,session.id,{exerciseId:exercise.id,setIndex:0,reps:5,weight:0,unit:'kg',restSeconds:30});
 const first=await prisma.$transaction(tx=>grantWorkoutCredit(tx,id,session.id));expect(first.awarded).toBe(false);
 await logSet(id,session.id,{exerciseId:exercise.id,setIndex:1,reps:5,weight:0,unit:'kg',restSeconds:30});
 // Fixtures change only synthetic server timestamps; the HTTP API exposes no date override.
 await prisma.workoutSession.update({where:{id:session.id},data:{startedAt:new Date(Date.now()-120000)}});
 const finish=await finishSession(id,session.id,'');expect(finish.reward.awarded).toBe(true);
 const duplicate=await finishSession(id,session.id,'');expect(duplicate.reward.awarded).toBe(false);
 const concurrent=await Promise.allSettled([finishSession(id,session.id,''),finishSession(id,session.id,'')]);
 expect(concurrent.some(result=>result.status==='fulfilled')).toBe(true);
 expect(await prisma.workoutCredit.count({where:{userId:id}})).toBe(1);
 expect((await gameSummary(id)).xp).toBe(50);expect((await gameSummary(id)).xp).toBe(50);expect((await gameSummary(other)).xp).toBe(0);
 expect(await prisma.achievement.count({where:{userId:id,key:'first'}})).toBe(1);
 const next=await startSession(id,plan.days[0].id);
 for(const setIndex of [0,1])await logSet(id,next.id,{exerciseId:exercise.id,setIndex,reps:5,weight:0,unit:'kg',restSeconds:30});
 await prisma.workoutSession.update({where:{id:next.id},data:{startedAt:new Date(Date.now()-72*3600000)}});
 expect((await finishSession(id,next.id,'')).reward.awarded).toBe(false);
 const sameDay=await startSession(id,plan.days[0].id);
 for(const setIndex of [0,1])await logSet(id,sameDay.id,{exerciseId:exercise.id,setIndex,reps:5,weight:0,unit:'kg',restSeconds:30});
 await prisma.workoutSession.update({where:{id:sameDay.id},data:{startedAt:new Date(Date.now()-120000)}});
 expect((await finishSession(id,sameDay.id,'')).reward.awarded).toBe(false);
});
test('notification opt-in, quiet hours, deduplication, rate limit and unsubscribe',async()=>{
 const id=await user('notice'),now=new Date('2026-11-10T12:00:00Z');
 expect((await notificationState(id)).preferences.enabled).toBe(false);
 await saveNotificationPreferences(id,{enabled:true,reminders:true,milestones:true,summaries:true,restMessages:true,reminderMinute:0,quietStart:0,quietEnd:1439});
 await tickUser(id,now);expect((await notificationState(id)).items).toHaveLength(0);
 await saveNotificationPreferences(id,{enabled:true,reminders:true,milestones:true,summaries:true,restMessages:true,reminderMinute:0,quietStart:0,quietEnd:0});
 await tickUser(id,now);await tickUser(id,now);
 // 18:30 Yangon on a planned rest day: one rest message + one water nudge (no water logged), each deduplicated per day
 const first=(await notificationState(id)).items as {type:string}[];expect(first.filter(x=>x.type!=='water')).toHaveLength(1);expect(first.filter(x=>x.type==='water')).toHaveLength(1);expect(first).toHaveLength(2);
 await prisma.notificationJob.createMany({data:[1,2,3].map(n=>({userId:id,key:'milestone-test-'+n,type:'milestone',day:'2026-11-10'}))});
 await tickUser(id,now);expect((await notificationState(id)).items).toHaveLength(3); // at most 3 per day
 await saveNotificationPreferences(id,{enabled:false,reminders:true,milestones:true,summaries:true,restMessages:true,reminderMinute:0,quietStart:0,quietEnd:0});
 expect(await prisma.notificationJob.count({where:{userId:id,status:'pending'}})).toBe(0);
 expect(pushSubscriptionSchema.safeParse({endpoint:'https://127.0.0.1/push',keys:{auth:'a'.repeat(22),p256dh:'a'.repeat(87)}}).success).toBe(false);
});
test('weekly summary contains real previous-week credit counts',async()=>{
 const id=await user('weekly'),monday=new Date('2026-11-16T12:00:00Z');
 await prisma.$transaction(tx=>syncDays(tx,id,new Date('2026-11-09T12:00:00Z')));
 await prisma.gameDay.updateMany({where:{userId:id,day:'2026-11-09'},data:{kind:'complete'}});
 await saveNotificationPreferences(id,{enabled:true,reminders:false,milestones:false,summaries:true,restMessages:false,reminderMinute:0,quietStart:0,quietEnd:0});
 await tickUser(id,monday);
 const inbox=await notificationState(id);
 expect(inbox.items.find(item=>item.type==='weekly')?.summary).toEqual({week:'2026-11-09',count:1,goal:3});
});
