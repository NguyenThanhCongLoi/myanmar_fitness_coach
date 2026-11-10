import { PrismaClient } from '@prisma/client';
import exercises from './exercises.json';
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
  console.log(JSON.stringify({ seeded: exercises.length, mediaImported: 0, provisionalMyanmar: Object.keys(translations).length }));
}
main().finally(() => prisma.$disconnect());
