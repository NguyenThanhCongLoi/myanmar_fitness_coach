import { timingSafeEqual } from 'node:crypto';
import { tickNotifications } from '@/server/notifications';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
  const expected=process.env.NOTIFICATION_CRON_TOKEN;
  const received=request.headers.get('authorization')??'';
  const target='Bearer '+expected;
  if(!expected||Buffer.byteLength(received)!==Buffer.byteLength(target)||!timingSafeEqual(Buffer.from(received),Buffer.from(target)))return Response.json({error:'UNAUTHORIZED'},{status:401});
  try{return Response.json(await tickNotifications());}catch{return Response.json({error:'STORAGE_UNAVAILABLE'},{status:503});}
}
