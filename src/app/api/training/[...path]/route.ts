import {readPlayback,savePlayback} from '@/server/playback';
import {z} from 'zod';
import {allowedAppOrigin} from '@/server/origins';
import {saveIntake} from '@/server/intake';
import {previewQuickWorkout} from '@/server/quick-workout';
import {requiredUser} from '@/server/auth';
import {prisma} from '@/shared/lib/prisma';
import {createTraining,previewRoutine,trainingAction} from '@/server/training';
import {recommendTrainingFocus,saveFeedback} from '@/server/recommendation';
import {cueSpeech,exerciseSpeech,langParam,messageSpeech,reportSpeech,sessionSpeech,summarySpeech,ttsConfigured,voiceStatus} from '@/server/tts';
import {dailyMotivation,parseFood,parseMealPhoto,parseSets,weeklyNarrative,weeklyReport} from '@/server/coach-extras';
import {coachInsights,deleteLog,energySummary,logActivity,logFood,saveBody} from '@/server/energy';
import {exerciseRecommendations,saveReadiness,todaySession} from '@/server/pt';
import {progressionFor,progressOverview} from '@/server/progression';
import {getSession} from '@/server/services';
import {persistDatabase} from '@/server/durability';
import {recordClientEvents,setAnalyticsOptOut,trackRoute} from '@/server/analytics';
import {addWater,dayScores,getPlan,getPrefs,savePrefs,setProgram,streakBoard,undoWater,waterSummary,swapExercise} from '@/server/plan';
import {ApiError} from '@/server/validation';
import {saveTodayChoice,saveWeekReview} from '@/server/adaptation';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handler(request:Request,context:{params:Promise<{path:string[]}>}){
 try{
  const user=await requiredUser(request),path=(await context.params).path,key=path.join('/'),write=request.method==='POST';
  if(write&&!allowedAppOrigin(request.headers.get('origin')))throw new ApiError(403,'INVALID_ORIGIN');
  let body:unknown;
  if(write){const raw=await request.text();if(raw.length>(key==='energy/photo'?1_500_000:65536))throw new ApiError(413,'REQUEST_TOO_LARGE');try{body=JSON.parse(raw);}catch{throw new ApiError(400,'INVALID_INPUT');}}
  let result:unknown;
  if(!write&&((path[0]==='tts'&&(path[1]==='cue'||path[1]==='summary'||path[1]==='report'))&&path.length<=3)){
   const q=Object.fromEntries(new URL(request.url).searchParams);
   const {audio,cached}=path[1]==='cue'?await cueSpeech(user.id,q):path[1]==='report'?await reportSpeech(user.id,decodeURIComponent(path[2]??'').slice(0,40)):await summarySpeech(user.id,(path[2]??'').slice(0,40),langParam(q.lang));
   if(!cached)await persistDatabase();
   return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400','Content-Length':String(audio.length)}});
  }
  if((write&&key==='tts/session')||(!write&&path[0]==='tts'&&path[1]==='message'&&path.length===3)){
   const {audio,cached}=write?await sessionSpeech(user.id,body):await messageSpeech(user.id,path[2].slice(0,100));
   if(!cached)await persistDatabase();
   return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400','Content-Length':String(audio.length)}});
  }
  if(!write&&key==='tts/status')return Response.json(voiceStatus(),{headers:{'Cache-Control':'no-store'}});
  if(!write&&path[0]==='tts'&&path.length===2){
   const step=Number(new URL(request.url).searchParams.get('step')??0)||undefined;
   if(step!==undefined&&(!Number.isInteger(step)||step<1||step>12))throw new ApiError(400,'INVALID_INPUT');
   const {audio,cached}=await exerciseSpeech(user.id,path[1].slice(0,100),step,langParam(new URL(request.url).searchParams.get('lang')));
   // Newly synthesized audio lives on the Volume; commit before acknowledging, like any other write.
   if(!cached)await persistDatabase();
   return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400','Content-Length':String(audio.length)}});
  }
  const place=(new URL(request.url).searchParams.get('location')==='gym'?'gym':'home') as 'home'|'gym';
  if(!write&&key==='progression'){const sp=new URL(request.url).searchParams;result=await progressionFor(user.id,(sp.get('ids')??'').split(',').filter(Boolean).slice(0,20).map(x=>x.slice(0,100)),sp.get('exclude')?.slice(0,40));}
  else if(!write&&key==='report')result=await weeklyReport(user.id);
  else if(!write&&key==='plan'){result=await getPlan(user.id,new URL(request.url).searchParams.get('location'));await persistDatabase();}
  else if(write&&key==='plan/today')result=await saveTodayChoice(user.id,body);
  else if(write&&key==='plan/review')result=await saveWeekReview(user.id,body);
  else if(write&&key==='plan/swap')result=await swapExercise(user.id,body);
  else if(write&&key==='program')result=await setProgram(user.id,body);
  else if(!write&&key==='day-scores')result=await dayScores(user.id);
  else if(!write&&key==='streaks')result=await streakBoard(user.id);
  else if(write&&key==='prefs')result=await savePrefs(user.id,body);
  else if(!write&&key==='prefs')result=await getPrefs(user.id);
  else if(write&&key==='energy/photo')result=await parseMealPhoto(body);
  else if(!write&&key==='water')result=await waterSummary(user.id);
  else if(write&&key==='water')result=await addWater(user.id,body);
  else if(write&&key==='water/undo')result=await undoWater(user.id);
  else if(write&&key==='events')result=await recordClientEvents(user.id,body,request);
  else if(write&&key==='analytics-pref')result=await setAnalyticsOptOut(user.id,body);
  else if(!write&&key==='motivation'){const m=await dailyMotivation(user.id,new URL(request.url).searchParams.get('locale')??'my-MM');if(m.generated)await persistDatabase();result={line:m.line};}
  else if(write&&key==='report/narrative')result=await weeklyNarrative(user.id,z.object({locale:z.enum(['my-MM','en'])}).strict().parse(body).locale);
  else if(write&&key==='parse/sets')result=await parseSets(user.id,body);
  else if(write&&key==='energy/parse-food')result=await parseFood(user.id,body);
  else if(!write&&key==='progress')result=await progressOverview(user.id);
  else if(write&&key==='readiness')result=await saveReadiness(user.id,body);
  else if(!write&&key==='energy')result=await energySummary(user.id);
  else if(!write&&key==='insights')result=await coachInsights(user.id);
  else if(write&&key==='energy/body')result=await saveBody(user.id,body);
  else if(write&&key==='energy/food')result=await logFood(user.id,body);
  else if(write&&key==='energy/activity')result=await logActivity(user.id,body);
  else if(write&&key==='energy/delete')result=await deleteLog(user.id,body);
  else if(!write&&key==='today')result=await todaySession(user.id,place,new Date(),new URL(request.url).searchParams.get('anyway')==='1');
  else if(!write&&path[0]==='recommend'&&path.length===2)result=await exerciseRecommendations(user.id,path[1].slice(0,100),place);
  else if(!write&&key==='voice')result={configured:ttsConfigured(),locales:[...(ttsConfigured('my')?['my-MM']:[]),...(ttsConfigured('en')?['en']:[])]};
  else if(!write&&key==='exercises')result=await prisma.exercise.findMany({include:{translations:true,favorites:{where:{userId:user.id},select:{exerciseId:true}}},orderBy:{name:'asc'},take:100});
  else if(!write&&path[0]==='sessions'&&path.length===2)result={...await getSession(user.id,path[1]),serverNow:new Date().toISOString()};
  else if(!write&&key==='recommendation')result=await recommendTrainingFocus(user.id,{location:new URL(request.url).searchParams.get('location')??'home'});
  else if(write&&path[0]==='sessions'&&path[2]==='feedback'&&path.length===3)result=await saveFeedback(user.id,path[1],body);
  else if(path[0]==='sessions'&&path[2]==='playback'&&path.length===3)result=write?await savePlayback(user.id,path[1],body):await readPlayback(user.id,path[1]);
  else if(write&&key==='intake')result=await saveIntake(user.id,body);
  else if(write&&key==='quick-plan')result=await previewQuickWorkout(user.id,body);
  else if(write&&key==='free')result=await createTraining(user.id,'free',body);
  else if(write&&key==='preview')result=await previewRoutine(user.id,body);
  else if(write&&key==='follow')result=await createTraining(user.id,'follow',body);
  else if(write&&path[0]==='sessions'&&path[2]==='action'&&path.length===3)result={...await trainingAction(user.id,path[1],body),serverNow:new Date().toISOString()};
  else if(write&&key==='favorite'){
   const input=z.object({exerciseId:z.string(),favorite:z.boolean()}).strict().parse(body);
   if(!await prisma.exercise.findUnique({where:{id:input.exerciseId}}))throw new ApiError(404,'NOT_FOUND');
   result=input.favorite?await prisma.favoriteExercise.upsert({where:{userId_exerciseId:{userId:user.id,exerciseId:input.exerciseId}},create:{userId:user.id,exerciseId:input.exerciseId},update:{}}):await prisma.favoriteExercise.deleteMany({where:{userId:user.id,exerciseId:input.exerciseId}});
  }else throw new ApiError(404,'NOT_FOUND');
  if(write)await trackRoute(user.id,'training',path,request);
  if(write)await persistDatabase();
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof ApiError)return Response.json({error:error.code,details:error.details},{status:error.status});if(error instanceof z.ZodError)return Response.json({error:'INVALID_INPUT'},{status:400});return Response.json({error:'REQUEST_FAILED'},{status:503});}
}
export const GET=handler;export const POST=handler;
