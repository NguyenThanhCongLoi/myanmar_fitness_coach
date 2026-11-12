import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { z } from 'zod';
import { ApiError } from './validation';
import { addDay, calculateStreak, civilDay, flameTier, weekOf, weekday } from './streak';
type Tx=Prisma.TransactionClient;
export const timezoneSchema=z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}});
export const gameSettingsSchema=z.object({timezone:timezoneSchema,weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(6).refine(x=>new Set(x).size===x.length),weeklyGoal:z.number().int().min(1).max(6),protectionEnabled:z.boolean(),recoveryDays:z.number().int().min(0).max(30).default(0)}).strict().refine(x=>x.weeklyGoal<=x.weekdays.length);

export async function syncDays(tx:Tx,userId:string,now=new Date()) {
  const profile=await tx.fitnessProfile.findUnique({where:{userId}});
  let state=await tx.gameState.findUnique({where:{userId}});
  if(!state) {
    const zone=profile?.timezone??'Asia/Yangon';
    state=await tx.gameState.create({data:{userId,timezone:zone,cursor:civilDay(now,zone),weekdays:[0,2,4],weeklyGoal:Math.min(3,profile?.daysPerWeek??3)}});
  }
  // Catch up under the old zone before activating a delayed zone change.
  const today=civilDay(now,state.timezone);
  let day=state.cursor;
  for(let count=0;day<=today&&count<4000;day=addDay(day,1),count++) {
    const planned=(state.weekdays as number[]).includes(weekday(day));
    let existing=await tx.gameDay.findUnique({where:{userId_day:{userId,day}}});
    if(!existing)existing=await tx.gameDay.create({data:{userId,day,week:weekOf(day),timezone:state.timezone,planned,weeklyGoal:state.weeklyGoal,kind:state.recoveryUntil&&day<=state.recoveryUntil?'recovery':planned?'open':'rest'}});
    if(day<today&&existing.kind==='open') {
      const protect=state.protectionEnabled&&state.shields>0;
      await tx.gameDay.update({where:{id:existing.id},data:{kind:protect?'protected':'missed'}});
      if(protect)state=await tx.gameState.update({where:{userId},data:{shields:{decrement:1}}});
    }
  }
  state=await tx.gameState.update({where:{userId},data:{cursor:today>state.cursor?today:state.cursor}});
  if(state.pendingTimezone&&state.timezoneEffectiveAt&&state.timezoneEffectiveAt<=now) {
    const nextToday=civilDay(now,state.pendingTimezone);
    state=await tx.gameState.update({where:{userId},data:{timezone:state.pendingTimezone,pendingTimezone:null,timezoneEffectiveAt:null,lastTimezoneChange:now,cursor:nextToday>state.cursor?nextToday:state.cursor}});
    await tx.gameDay.upsert({where:{userId_day:{userId,day:nextToday}},create:{userId,day:nextToday,week:weekOf(nextToday),timezone:state.timezone,planned:false,weeklyGoal:state.weeklyGoal,kind:'transition'},update:{}});
    await tx.fitnessProfile.updateMany({where:{userId},data:{timezone:state.timezone}});
  }
  return state;
}
export async function gameSummary(userId:string,now=new Date()) {
  return prisma.$transaction(async tx=>{
    const state=await syncDays(tx,userId,now),today=civilDay(now,state.timezone);
    const days=await tx.gameDay.findMany({where:{userId},orderBy:{day:'asc'}});
    const streak=calculateStreak(days,today);
    const week=weekOf(today),weeklyGoal=days.find(d=>d.week===week)?.weeklyGoal??state.weeklyGoal;
    const calendar=Array.from({length:7},(_,i)=>{
      const day=addDay(week,i);return days.find(d=>d.day===day)??{day,week,planned:(state.weekdays as number[]).includes(i),kind:state.recoveryUntil&&day<=state.recoveryUntil?'recovery':(state.weekdays as number[]).includes(i)?'open':'rest',weeklyGoal:state.weeklyGoal};
    });
    const credits=await tx.workoutCredit.aggregate({where:{userId},_sum:{xp:true},_count:true});
    const completedWeek=days.filter(d=>d.week===week&&d.kind==='complete').length;
    const activePlan=await tx.workoutPlan.findFirst({where:{userId,status:'active'},orderBy:{createdAt:'desc'},include:{days:{where:{weekday:weekday(today)},orderBy:{order:'asc'},take:1}}});
    return {state,today,streak,tier:flameTier(streak.current).key,xp:credits._sum.xp??0,totalCredits:credits._count,completedWeek,weeklyGoal,calendar,achievements:await tx.achievement.findMany({where:{userId},orderBy:{createdAt:'desc'}}),mission:{kind:calendar.find(d=>d.day===today)?.kind??'open',dayId:activePlan?.days[0]?.id??null,planName:activePlan?.name??null}};
  },{timeout:20000});
}
export async function updateGameSettings(userId:string,raw:unknown,now=new Date()) {
  const input=gameSettingsSchema.parse(raw);
  return prisma.$transaction(async tx=>{
    const state=await syncDays(tx,userId,now);
    if(input.timezone!==state.timezone&&state.lastTimezoneChange&&now.getTime()-state.lastTimezoneChange.getTime()<7*86400000)throw new ApiError(409,'TIMEZONE_COOLDOWN');
    if(input.recoveryDays)await tx.gameDay.updateMany({where:{userId,day:civilDay(now,state.timezone),kind:'open'},data:{kind:'recovery'}});
    // Existing calendar snapshots never change; schedule changes affect unmaterialized days only.
    return tx.gameState.update({where:{userId},data:{weekdays:input.weekdays,scheduleChosen:true,weeklyGoal:input.weeklyGoal,protectionEnabled:input.protectionEnabled,recoveryUntil:input.recoveryDays?addDay(civilDay(now,state.timezone),input.recoveryDays-1):null,...(input.timezone!==state.timezone?{pendingTimezone:input.timezone,timezoneEffectiveAt:new Date(now.getTime()+86400000)}:{pendingTimezone:null,timezoneEffectiveAt:null})}});
  });
}
type CreditSession={mode:string;creditTargetSets:number;playerPlan:unknown;playerIndex:number;sets:{exerciseId:string;setIndex:number;completed:boolean;reps:number}[];prescriptions:{exerciseId:string;sets:number;skipped:boolean}[];phaseLogs:{kind:string;status:string}[];day:{exercises:{exerciseId:string;sets:number}[]}};
// Follow Along: routine finished and >=80% of exercise phases actually completed (timed or with logged reps).
// Free/plan workouts: >=80% of the prescribed sets actually logged with reps; skipped exercises still count in the target.
export function workCompleted(session:CreditSession){
  if(session.mode==='follow'){
    const routine=session.playerPlan as {phases:{kind:string}[];criteria?:{minimumFraction?:number}}|null;
    if(!routine)return false;
    const planned=routine.phases.filter(p=>p.kind==='exercise').length,done=session.phaseLogs.filter(p=>p.kind==='exercise'&&p.status==='completed').length;
    return planned>0&&session.playerIndex>=routine.phases.length&&done>=Math.ceil(planned*(routine.criteria?.minimumFraction??0.8));
  }
  const items=session.prescriptions.length?session.prescriptions:session.day.exercises.map(p=>({...p,skipped:false}));
  const target=session.creditTargetSets||items.reduce((n,p)=>n+p.sets,0);
  const logged=items.filter(p=>!p.skipped).reduce((n,p)=>n+Array.from({length:p.sets},(_,i)=>session.sets.some(s=>s.exerciseId===p.exerciseId&&s.setIndex===i&&s.completed&&s.reps>0)).filter(Boolean).length,0);
  return target>0&&logged>=Math.ceil(target*0.8);
}
export async function grantWorkoutCredit(tx:Tx,userId:string,sessionId:string,now=new Date()) {
  const state=await syncDays(tx,userId,now),today=civilDay(now,state.timezone);
  const session=await tx.workoutSession.findFirstOrThrow({where:{id:sessionId,userId},include:{sets:true,prescriptions:true,phaseLogs:true,day:{include:{exercises:true}}}});
  // Server-observed start/completion and actually completed work, never caller dates, planned work or app opens.
  const complete=workCompleted(session);
  const elapsed=now.getTime()-session.startedAt.getTime();
  if(session.status!=='completed'||!complete||elapsed<60000||elapsed>48*3600000)return {awarded:false,xp:0,reason:'criteria'};
  if(await tx.workoutCredit.findUnique({where:{sessionId}})||await tx.workoutCredit.findUnique({where:{userId_day:{userId,day:today}}}))return {awarded:false,xp:0,reason:'already_credited'};
  // A workout begun before a zone switch keeps its old zone and earns no shifted-day reward.
  if(session.creditTimezone!==state.timezone)return {awarded:false,xp:0,reason:'timezone_transition'};
  const last=await tx.workoutCredit.findFirst({where:{userId},orderBy:{createdAt:'desc'}});
  if(last&&last.timezone!==state.timezone&&now.getTime()-last.createdAt.getTime()<20*3600000)return {awarded:false,xp:0,reason:'timezone_transition'};
  await tx.workoutCredit.create({data:{userId,sessionId,day:today,timezone:state.timezone,xp:50,createdAt:now}});
  await tx.gameDay.upsert({where:{userId_day:{userId,day:today}},create:{userId,day:today,week:weekOf(today),timezone:state.timezone,planned:true,weeklyGoal:state.weeklyGoal,kind:'complete'},update:{kind:'complete'}});
  const days=await tx.gameDay.findMany({where:{userId}}),streak=calculateStreak(days,today);
  const total=await tx.workoutCredit.count({where:{userId}}),unlocked:string[]=[];
  const keys=['first',...(total>=5?['five']:[]),...([7,14,30,60].filter(n=>streak.current>=n).map(n=>'streak'+n))];
  const thisWeek=days.filter(d=>d.week===weekOf(today)).sort((a,b)=>a.day.localeCompare(b.day));
  if(thisWeek.filter(d=>d.kind==='complete').length>=(thisWeek[0]?.weeklyGoal??state.weeklyGoal))keys.push('week:'+weekOf(today));
  for(const key of keys){
    if(await tx.achievement.findUnique({where:{userId_key:{userId,key}}}))continue;
    await tx.achievement.create({data:{userId,key}});unlocked.push(key);
    if(key.startsWith('week:')&&state.shields<2)await tx.gameState.update({where:{userId},data:{shields:Math.min(2,state.shields+1)}});
    await tx.notificationJob.upsert({where:{userId_key:{userId,key:'achievement:'+key}},create:{userId,key:'achievement:'+key,type:'milestone',day:today},update:{}});
  }
  return {awarded:true,xp:50,unlocked,streak:streak.current};
}

// User picks training days directly (Today card). Weekly goal is clamped to the chosen days; profile days/week follows.
export const scheduleSchema=z.object({weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(6).refine(x=>new Set(x).size===x.length)}).strict();
export async function updateSchedule(userId:string,raw:unknown,now=new Date()){
  const input=scheduleSchema.parse(raw);const weekdays=[...input.weekdays].sort((a,b)=>a-b);
  return prisma.$transaction(async tx=>{
    const state=await syncDays(tx,userId,now);
    await tx.fitnessProfile.updateMany({where:{userId},data:{daysPerWeek:weekdays.length}});
    return tx.gameState.update({where:{userId},data:{weekdays,scheduleChosen:true,weeklyGoal:Math.min(state.weeklyGoal,weekdays.length)}});
  });
}
