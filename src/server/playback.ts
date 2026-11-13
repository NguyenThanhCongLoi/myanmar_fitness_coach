import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import type { PlaybackProgress } from '@/shared/workout-contracts';

const progressSchema = z.object({version:z.literal(1), prescriptionId:z.string().min(1).max(100),setIndex:z.number().int().min(0).max(7),phase:z.enum(['ready','work','rest']),remaining:z.number().int().min(0).max(600),restTotal:z.number().int().min(0).max(600),gymElapsed:z.number().int().min(0).max(1200),paused:z.boolean(),reps:z.number().int().min(1).max(600),kg:z.number().min(0).max(400),rir:z.number().int().min(0).max(5).nullable(),activeSeconds:z.number().int().min(0).max(86400),sequence:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)}).strict();
const keyOf = (id:string)=>`playback:${id}`;
export async function readPlayback(userId:string,id:string) {
  if(!await prisma.workoutSession.findFirst({where:{id,userId},select:{id:true}}))throw new ApiError(404,'NOT_FOUND');
  const row=await prisma.aiMemory.findUnique({where:{userId_key:{userId,key:keyOf(id)}}});
  if(!row)return null;
  try { return progressSchema.parse(JSON.parse(row.content)); } catch { return null; }
}
export async function savePlayback(userId:string,id:string,raw:unknown) {
  const input=progressSchema.parse(raw);
  return prisma.$transaction(async tx=>{
    const session=await tx.workoutSession.findFirst({where:{id,userId},include:{prescriptions:true}});
    if(!session)throw new ApiError(404,'NOT_FOUND');
    if(!['active','paused'].includes(session.status))throw new ApiError(409,'WORKOUT_ENDED');
    const p=session.prescriptions.find(p=>p.id===input.prescriptionId&&!p.skipped);
    if(!p||input.setIndex>=p.sets)throw new ApiError(400,'INVALID_SET');
    const row=await tx.aiMemory.findUnique({where:{userId_key:{userId,key:keyOf(id)}}});
    const previous=row?JSON.parse(row.content) as PlaybackProgress:null;
    if(previous&&previous.sequence>=input.sequence)return previous;
    // The checkpoint records observed active seconds, never credits unobserved time on reload.
    await tx.aiMemory.upsert({where:{userId_key:{userId,key:keyOf(id)}},create:{userId,key:keyOf(id),content:JSON.stringify(input)},update:{content:JSON.stringify(input)}});
    return input;
  });
}
