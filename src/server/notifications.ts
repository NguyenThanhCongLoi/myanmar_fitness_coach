import { prisma } from '@/shared/lib/prisma';
import { z } from 'zod';
import * as webpush from 'web-push';
import { addDay, civilDay, localMinute, quietNow, weekday, weekOf } from './streak';
import { gameSummary } from './gamification';
import { persistDatabase } from './durability';
import en from '@/locales/game-en';
import my from '@/locales/game-my';
export const notificationSchema=z.object({enabled:z.boolean(),reminders:z.boolean(),milestones:z.boolean(),summaries:z.boolean(),restMessages:z.boolean(),reminderMinute:z.number().int().min(0).max(1439),quietStart:z.number().int().min(0).max(1439),quietEnd:z.number().int().min(0).max(1439)}).strict();
export function pushConfigured(){return Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY);}
export const pushSubscriptionSchema=z.object({endpoint:z.string().url().max(2048).refine(value=>{
  const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='fcm.googleapis.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'));
}),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)}).strict()}).strict();
export function noticeText(type:string,locale:string){
  const t=locale==='my-MM'?my:en;
  return type==='training'?{title:t.notificationTraining,body:t.notificationTrainingBody}:type==='rest'?{title:t.notificationRest,body:t.notificationRestBody}:type==='weekly'?{title:t.notificationWeekly,body:t.notificationWeeklyBody}:{title:t.notificationMilestone,body:t.notificationMilestoneBody};
}
export async function notificationState(userId:string){
  const preferences=await prisma.notificationPreference.upsert({where:{userId},create:{userId},update:{}});
  const jobs=await prisma.notificationJob.findMany({where:{userId,status:'delivered'},orderBy:{deliveredAt:'desc'},take:100});
  const items=await Promise.all(jobs.map(async job=>{
    if(job.type!=='weekly')return {...job,summary:null};
    const week=weekOf(addDay(job.day,-7));
    const days=await prisma.gameDay.findMany({where:{userId,week},orderBy:{day:'asc'}});
    return {...job,summary:{week,count:days.filter(d=>d.kind==='complete').length,goal:days[0]?.weeklyGoal??0}};
  }));
  const state=await prisma.gameState.findUnique({where:{userId}});
  return {preferences,items,timezone:state?.timezone??'Asia/Yangon',pushAvailable:pushConfigured(),publicKey:pushConfigured()?process.env.VAPID_PUBLIC_KEY:null};
}
export async function saveNotificationPreferences(userId:string,raw:unknown){
  const data=notificationSchema.parse(raw);
  return prisma.$transaction(async tx=>{
    const pref=await tx.notificationPreference.upsert({where:{userId},create:{userId,...data},update:{...data,...(!data.enabled?{pushEnabled:false}:{})}});
    if(!data.enabled){await tx.notificationJob.updateMany({where:{userId,status:'pending'},data:{status:'cancelled',pushState:'cancelled'}});await tx.pushDevice.deleteMany({where:{userId}});}
    return pref;
  });
}
export async function subscribePush(userId:string,raw:unknown){
  const subscription=pushSubscriptionSchema.parse(raw);
  return prisma.$transaction(async tx=>{
    // An endpoint cannot be moved to another account by guessing its URL.
    const existing=await tx.pushDevice.findUnique({where:{endpoint:subscription.endpoint}});
    if(existing&&existing.userId!==userId)throw new Error('Endpoint already registered');
    if(await tx.pushDevice.count({where:{userId}})>=5&&!existing)throw new Error('Device limit');
    await tx.pushDevice.upsert({where:{endpoint:subscription.endpoint},create:{userId,endpoint:subscription.endpoint,subscription},update:{subscription}});
    await tx.notificationPreference.upsert({where:{userId},create:{userId,enabled:true,pushEnabled:true},update:{enabled:true,pushEnabled:true}});
    return {subscribed:true};
  });
}
export async function unsubscribePush(userId:string,endpoint:string){
  await prisma.pushDevice.deleteMany({where:{userId,endpoint}});
  if(!await prisma.pushDevice.count({where:{userId}}))await prisma.notificationPreference.updateMany({where:{userId},data:{pushEnabled:false}});
  return {unsubscribed:true};
}
export async function tickUser(userId:string,now=new Date(),sendPush=false) {
  const pref=await prisma.notificationPreference.findUnique({where:{userId}});
  if(!pref?.enabled)return;
  const summary=await gameSummary(userId,now),today=summary.today,minute=localMinute(now,summary.state.timezone);
  await prisma.notificationPreference.update({where:{userId},data:{checkedAt:now}});
  if(quietNow(minute,pref.quietStart,pref.quietEnd))return;
  if(minute>=pref.reminderMinute){
    const kind=summary.mission.kind;
    const type=kind==='open'&&pref.reminders?'training':['rest','recovery','transition'].includes(kind)&&pref.restMessages?'rest':null;
    if(type)await prisma.notificationJob.upsert({where:{userId_key:{userId,key:type+':'+today}},create:{userId,key:type+':'+today,type,day:today},update:{}});
    if(weekday(today)===0&&pref.summaries)await prisma.notificationJob.upsert({where:{userId_key:{userId,key:'weekly:'+today}},create:{userId,key:'weekly:'+today,type:'weekly',day:today},update:{}});
  }
  const jobs=await prisma.notificationJob.findMany({where:{userId,status:'pending'},orderBy:{createdAt:'asc'},take:10});
  for(const job of jobs){
    const allowed=job.type==='milestone'?pref.milestones:job.type==='training'?pref.reminders:job.type==='weekly'?pref.summaries:pref.restMessages;
    if(!allowed||(job.type!=='milestone'&&job.day!==today)) {await prisma.notificationJob.update({where:{id:job.id},data:{status:'cancelled',pushState:'cancelled'}});continue;}
    const recent=await prisma.notificationJob.count({where:{userId,status:'delivered',deliveredAt:{gte:new Date(now.getTime()-86400000)}}});
    if(recent>=2)break;
    await prisma.notificationJob.updateMany({where:{id:job.id,status:'pending'},data:{status:'delivered',deliveredAt:now}});
  }
  // Commit inbox + per-device delivery claims BEFORE external sends. Unknown outcomes are not retried.
  if(!sendPush||!pref.pushEnabled||!pushConfigured())return;
  const pending=await prisma.notificationJob.findMany({where:{userId,status:'delivered',pushState:'pending'},take:2,orderBy:{deliveredAt:'asc'}});
  const devices=await prisma.pushDevice.findMany({where:{userId}}),profile=await prisma.fitnessProfile.findUnique({where:{userId}});
  for(const job of pending){
    const allowed=job.type==='milestone'?pref.milestones:job.type==='training'?pref.reminders:job.type==='weekly'?pref.summaries:pref.restMessages;
    if(!allowed){await prisma.notificationJob.update({where:{id:job.id},data:{pushState:'cancelled'}});continue;}
    if(job.deliveredAt&&now.getTime()-job.deliveredAt.getTime()>86400000){await prisma.notificationJob.update({where:{id:job.id},data:{pushState:'expired'}});continue;}
    for(const device of devices){
      if(await prisma.pushDelivery.findUnique({where:{jobId_deviceId:{jobId:job.id,deviceId:device.id}}}))continue;
      const claim=await prisma.pushDelivery.create({data:{jobId:job.id,deviceId:device.id}});
      await persistDatabase();
      try{
        const text=noticeText(job.type,profile?.locale??'my-MM');
        await webpush.sendNotification(device.subscription as unknown as webpush.PushSubscription,JSON.stringify({...text,id:job.id,url:'/?view=inbox'}),{vapidDetails:{subject:process.env.BETTER_AUTH_URL!,publicKey:process.env.VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!},TTL:3600,timeout:8000,urgency:'normal'});
        await prisma.pushDelivery.update({where:{id:claim.id},data:{status:'sent'}});
      }catch(error){
        const status=(error as {statusCode?:number}).statusCode;
        await prisma.pushDelivery.update({where:{id:claim.id},data:{status:status===410||status===404?'expired':'failed_or_unknown'}});
        if(status===410||status===404)await prisma.pushDevice.deleteMany({where:{id:device.id,userId}});
      }
    }
    await prisma.notificationJob.update({where:{id:job.id},data:{pushState:'processed'}});
    await persistDatabase();
  }
}
let ticking=false;
export async function tickNotifications(now=new Date()){
  if(ticking)return {busy:true};ticking=true;
  try{const users=await prisma.notificationPreference.findMany({where:{enabled:true},orderBy:{checkedAt:'asc'},take:50});const deadline=Date.now()+120000;let checked=0;for(const user of users){if(Date.now()>deadline)break;await tickUser(user.userId,now,true);checked++;}await persistDatabase();return {checked};}
  finally{ticking=false;}
}
