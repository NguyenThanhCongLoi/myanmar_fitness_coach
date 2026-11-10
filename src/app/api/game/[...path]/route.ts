import { z } from 'zod';
import { requiredUser } from '@/server/auth';
import { prisma } from '@/shared/lib/prisma';
import { gameSummary, updateGameSettings } from '@/server/gamification';
import { notificationState, saveNotificationPreferences, subscribePush, unsubscribePush, tickUser } from '@/server/notifications';
import { persistDatabase } from '@/server/durability';
import { ApiError } from '@/server/validation';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function handler(request:Request,context:{params:Promise<{path:string[]}>}){
  try{
    const write=request.method==='POST';
    if(write&&request.headers.get('origin')&&request.headers.get('origin')!==process.env.BETTER_AUTH_URL)throw new ApiError(403,'INVALID_ORIGIN');
    const user=await requiredUser(request),route=(await context.params).path.join('/');
    let body:unknown={};
    if(write){const raw=await request.text();if(raw.length>16384)throw new ApiError(413,'REQUEST_TOO_LARGE');try{body=JSON.parse(raw);}catch{throw new ApiError(400,'INVALID_INPUT');}}
    let result:unknown;
    if(!write&&route==='summary')result=await gameSummary(user.id);
    else if(write&&route==='settings')result=await updateGameSettings(user.id,body);
    else if(!write&&route==='notifications'){await tickUser(user.id);result=await notificationState(user.id);}
    else if(write&&route==='notifications/preferences')result=await saveNotificationPreferences(user.id,body);
    else if(write&&route==='notifications/read'){z.object({}).strict().parse(body);result=await prisma.notificationJob.updateMany({where:{userId:user.id,status:'delivered',readAt:null},data:{readAt:new Date()}});}
    else if(write&&route==='push/subscribe')result=await subscribePush(user.id,body);
    else if(write&&route==='push/unsubscribe')result=await unsubscribePush(user.id,z.object({endpoint:z.string().max(2048)}).strict().parse(body).endpoint);
    else throw new ApiError(404,'NOT_FOUND');
    await persistDatabase();
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({error:'INVALID_INPUT'},{status:400});
    if(error instanceof ApiError)return Response.json({error:error.code},{status:error.status});
    return Response.json({error:'REQUEST_FAILED'},{status:503});
  }
}
export const GET=handler;export const POST=handler;
