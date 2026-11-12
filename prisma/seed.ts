import { PrismaClient } from '@prisma/client';
import exercises from './exercises.json';
import catalog from './exercise-catalog.json';
import stepsEn from './exercise-steps.json';
import stepsMy from './exercise-steps-my.json';
import media from './exercise-media.json';
import wgerMedia from './exercise-media-wger.json';
import guidanceEn from './exercise-guidance.json';
import guidanceMy from './exercise-guidance-my.json';
import mistakesMy from './exercise-mistakes-my.json';
type MediaEntry = { videoUrl?: string; thumbnailUrl?: string; mediaSource?: string; license?: string; page?: string; variationNote?: string; steps: Record<string, { image: string; credit: string }> };
const prisma = new PrismaClient();
// Provisional language samples, never certified native-quality exercise instruction.
const translations: Record<string, { name: string; instructions: string }> = {
  'dataset-0662': { name: 'Push-up — ဒိုက်ထိုးခြင်း', instructions: 'လက်များကို ပခုံးအကျယ်ခန့် ထားပြီး ကိုယ်ကို တစ်ဖြောင့်တည်း ထိန်းပါ။ တံတောင်ဆစ်ကို ကွေး၍ ကိုယ်ကို ဖြည်းဖြည်းချပြီး ပြန်တွန်းတင်ပါ။ နာကျင်ပါက ရပ်ပါ။' },
  'dataset-0276': { name: 'Dead bug — ကိုယ်လယ်ပိုင်း လေ့ကျင့်ခန်း', instructions: 'ပက်လက်လှန်၍ ဒူးနှင့်လက်များကို မြှောက်ထားပါ။ ဆန့်ကျင်ဘက်လက်နှင့်ခြေကို ဖြည်းဖြည်းဆန့်ပြီး ပြန်ယူပါ။ ခါးကို မကော့ပါနှင့်။' },
  'dataset-3013': { name: 'Glute bridge — တင်ပါးမြှောက်ခြင်း', instructions: 'ဒူးကွေးပြီး ခြေထောက်ကို မြေပြင်တွင် ထားပါ။ တင်ပါးကို ဖြည်းဖြည်းမြှောက်ပြီး ပြန်ချပါ။ ခါးကို လွန်ကဲစွာ မကော့ပါနှင့်။' },
  'core-157': { name: 'Barbell reverse lunges — နောက်ဆုတ်ခြေလှမ်း', instructions: 'ဘားကို ပခုံးနောက်တွင် ထိန်းထားပြီး ခြေတစ်ဖက် နောက်သို့ ဆုတ်ပါ။ ဒူးကို ဖြည်းဖြည်းကွေးပြီး မူလအနေအထားသို့ ပြန်ထပါ။ ဘားမပါဘဲ လှုပ်ရှားမှုကို အရင်လေ့လာပါ။' },
};
async function main() {
  for (const exercise of exercises) {
    await prisma.exercise.upsert({ where: { id: exercise.id }, create: exercise, update: {} });
    const translation = translations[exercise.id];
    if (translation) await prisma.exerciseTranslation.upsert({ where: { exerciseId_locale: { exerciseId: exercise.id, locale: 'my-MM' } },
      create: { exerciseId: exercise.id, locale: 'my-MM', ...translation, reviewStatus: 'provisional' }, update: {} });
  }
  for(const entry of catalog){
    const {id,...base}=entry;
    // Real-person demo clips from wger (CC BY-SA 4.0) replace older clips; step illustrations are kept.
    const base0=(media as Record<string,MediaEntry>)[id], w=(wgerMedia as Record<string,Partial<MediaEntry>>)[id];
    const m:MediaEntry|undefined=w?{...(base0??{steps:{}}),...w,variationNote:'',steps:base0?.steps??{}} as MediaEntry:base0, en=(stepsEn as Record<string,string[]>)[id]??[], my=(stepsMy as Record<string,{name:string;steps:string[]}>)[id];
    // Demo media: licence-checked Wikimedia Commons sources (attribution shown in UI); technique NOT coach-reviewed (mediaStatus).
    const mediaFields=m?.videoUrl?{videoUrl:m.videoUrl,thumbnailUrl:m.thumbnailUrl??null,mediaType:'video',mediaLicenseStatus:'verified',mediaStatus:'demo_unreviewed',mediaSource:`${m.mediaSource}${m.variationNote?` [${m.variationNote}]`:''} ${m.page}`}:{};
    const steps=en.map((text,i)=>({en:text,my:my?.steps[i]??null,image:m?.steps[String(i+1)]?.image??null,credit:m?.steps[String(i+1)]?.credit??null}));
    const g=(guidanceEn as Record<string,{perSide:boolean;home:string[];gym:string[]}>)[id], gm=(guidanceMy as Record<string,{home:string[];gym:string[]}>)[id];
    const pair=(en:string[],my?:string[])=>en.map((text,i)=>({en:text,my:my?.[i]??null}));
    const mistakes=pair(base.commonMistakes,(mistakesMy as Record<string,{mistakes:string[]}>)[id]?.mistakes);
    const guidance=g?{perSide:g.perSide,home:pair(g.home,gm?.home),gym:pair(g.gym,gm?.gym),mistakes}:{mistakes};
    const data={...base,...mediaFields,steps,guidance};
    await prisma.exercise.upsert({where:{id},create:{id,...data,normalizedName:data.name.toLowerCase(),muscles:data.primaryMuscles,source:'mingalar-curation',sourceId:data.canonicalId,sourceUrl:'',dataLicense:'Original curated text',attribution:'Mingalar Fit curated movement metadata'},update:{...data,muscles:data.primaryMuscles}});
    if(my)await prisma.exerciseTranslation.upsert({where:{exerciseId_locale:{exerciseId:id,locale:'my-MM'}},create:{exerciseId:id,locale:'my-MM',name:my.name,instructions:my.steps.join(' '),reviewStatus:'provisional'},update:{name:my.name,instructions:my.steps.join(' '),reviewStatus:'provisional'}});
  }
  console.log(JSON.stringify({seeded:catalog.length,demoVideos:new Set([...Object.keys(media as Record<string,MediaEntry>).filter(k=>(media as Record<string,MediaEntry>)[k].videoUrl),...Object.keys(wgerMedia)]).size,steps:Object.keys(stepsEn).length,provisionalMyanmar:Object.keys(translations).length}));
}
main().finally(() => prisma.$disconnect());
