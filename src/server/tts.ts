import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prisma } from '@/shared/lib/prisma';
import { z } from 'zod';
import { ApiError } from './validation';
import { doseFor, type Level } from '@/shared/dose';
import { voiceLine, type VoiceKey } from '@/locales/workout-voice';

// Server-only TTS through owner-configured OpenAI-compatible gateways: TTS_* = Myanmar voice, TTS_EN_* = English voice (env / Modal Secret).
// Audio is cached by content hash so each script is synthesized once; keys never reach the browser.
type Step = { en: string; my: string | null };
const MY_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
const myNumber = (n: number) => String(n).replace(/\d/g, d => MY_DIGITS[Number(d)]);
export type VoiceLang = 'my' | 'en';
const discoveredModel: Record<VoiceLang, string | null> = { my: null, en: null };
const recent = new Map<string, number[]>();
// Internal id for the deploy-time warm-up only; never a real user and never reachable from a request.
const WARM_USER = '__voice_warmup__';

function cfg(lang: VoiceLang) { const p = lang === 'en' ? 'TTS_EN_' : 'TTS_'; return { base: process.env[p + 'BASE_URL'], key: process.env[p + 'API_KEY'], voice: process.env[p + 'VOICE'], model: process.env[p + 'MODEL'] }; }
export function ttsConfigured(lang: VoiceLang = 'my') { const c = cfg(lang); return Boolean(c.base && c.key && c.voice); }
export const voiceStatus = () => ({ my: ttsConfigured('my'), en: ttsConfigured('en') });
function endpoint(p: string, lang: VoiceLang) { const base = cfg(lang).base!.replace(/\/$/, ''); return base.endsWith('/v1') ? base + p : base + '/v1' + p; }
function cacheDir() { return process.env.TTS_CACHE_DIR || (existsSync('/data') ? '/data/tts-cache' : path.join(tmpdir(), 'tts-cache')); }
async function model(lang: VoiceLang) {
  const c = cfg(lang);
  if (c.model) return c.model;
  if (discoveredModel[lang]) return discoveredModel[lang]!;
  const response = await fetch(endpoint('/models', lang), { headers: { Authorization: `Bearer ${c.key}` }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new ApiError(502, 'VOICE_UNAVAILABLE');
  const ids: string[] = ((await response.json()).data ?? []).map((m: { id: string }) => m.id);
  discoveredModel[lang] = ids.find(id => id.includes('tts')) ?? ids[0] ?? null;
  if (!discoveredModel[lang]) throw new ApiError(502, 'VOICE_UNAVAILABLE');
  return discoveredModel[lang]!;
}
export const langParam = (v: unknown): VoiceLang => v === 'en' ? 'en' : 'my';

// Coach-style Myanmar script: name, short intro, numbered steps, safety close. Text comes only from stored, reviewed-as-provisional steps.
export function coachScript(name: string, steps: Step[], step?: number) {
  const list = steps.map((s, i) => ({ n: i + 1, text: s.my })).filter(s => s.text);
  if (!list.length) return '';
  if (step) { const s = list.find(x => x.n === step); return s ? `အဆင့် ${myNumber(s.n)}။ ${s.text}` : ''; }
  return [`${name}။`, 'ကျွန်ုပ်တို့ အတူတူ တစ်ဆင့်ချင်း လုပ်ကြရအောင်။', ...list.map(s => `အဆင့် ${myNumber(s.n)}။ ${s.text}`), 'အသက်ကို ပုံမှန်ရှူပါ။ နာကျင်မှု ရှိလာရင် ချက်ချင်း ရပ်ပါ။ ကောင်းပါတယ်၊ ဆက်လုပ်ကြရအောင်။'].join(' ');
}

function coachScriptEn(name: string, steps: Step[], step?: number) {
  const list = steps.map((x, i) => ({ n: i + 1, text: x.en })).filter(x => x.text);
  if (!list.length) return '';
  if (step) { const x = list.find(y => y.n === step); return x ? `Step ${x.n}. ${x.text}` : ''; }
  return [`${name}.`, "Let's go through it together, one step at a time.", ...list.map(x => `Step ${x.n}. ${x.text}`), 'Keep breathing steadily. If anything hurts, stop right away. Good, let\'s continue.'].join(' ');
}
export async function exerciseSpeech(userId: string, exerciseId: string, step?: number, lang: VoiceLang = 'my') {
  if (!ttsConfigured(lang)) throw new ApiError(503, 'VOICE_NOT_CONFIGURED');
  const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId }, include: { translations: { where: { locale: 'my-MM' } } } });
  if (!exercise) throw new ApiError(404, 'NOT_FOUND');
  const text = lang === 'en'
    ? coachScriptEn(exercise.name.split('—')[0].trim(), exercise.steps as Step[], step)
    : coachScript((exercise.translations[0]?.name ?? exercise.name).split('—').pop()!.trim(), exercise.steps as Step[], step).normalize('NFC');
  if (!text) throw new ApiError(404, 'NO_STEPS');
  return synthesize(userId, text, lang);
}

// ---------- PT session + coach message voice ----------
const SPLIT_MY: Record<string, string> = { push: 'ရင်ဘတ်၊ ပခုံးနှင့် Triceps', pull: 'ကျောနှင့် Biceps', legs: 'ခြေထောက်နှင့် တင်ပါး', core: 'Core နှင့် ဝမ်းဗိုက်', full: 'တစ်ကိုယ်လုံး', upper: 'ခန္ဓာကိုယ် အပေါ်ပိုင်း', lower: 'ခြေထောက်နှင့် Core' };
const myRange = (v: string) => v.split('–').map(x => burmeseNumberWords(Number(x))).join(' မှ ');
async function synthesize(userId: string, text: string, lang: VoiceLang = 'my', cachedOnly=false) {
  if (!ttsConfigured(lang)) throw new ApiError(503, 'VOICE_NOT_CONFIGURED');
  const c = cfg(lang);
  if(cachedOnly&&!c.model&&!discoveredModel[lang])throw new ApiError(404,'VOICE_NOT_CACHED');
  const [voice, modelId] = [c.voice!, cachedOnly?(c.model||discoveredModel[lang])!:await model(lang)];
  const input = lang === 'my' ? speakableBurmese(text) : text;
  // Myanmar keys keep the original v2 format so existing cached audio stays valid.
  const key = createHash('sha256').update(`${lang === 'my' ? 'v2' : 'en1'}\n${modelId}\n${voice}\n${input}`).digest('hex');
  const file = path.join(cacheDir(), `${key}.mp3`);
  try { return { audio: await readFile(file), cached: true }; } catch { /* not cached */ }
  if(cachedOnly)throw new ApiError(404,'VOICE_NOT_CACHED');
  // Only uncached synthesis counts against a small per-user rate limit.
  const now = Date.now(), times = (recent.get(userId) ?? []).filter(t => now - t < 60000);
  if (userId !== WARM_USER && times.length >= 10) throw new ApiError(429, 'PLEASE_WAIT');
  if (userId !== WARM_USER) recent.set(userId, [...times, now]);
  let response: Response;
  try {
    response = await fetch(endpoint('/audio/speech', lang), { method: 'POST', headers: { Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, voice, input, response_format: 'mp3' }), signal: AbortSignal.timeout(120000), cache: 'no-store' });
  } catch { throw new ApiError(502, 'VOICE_UNAVAILABLE'); }
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('audio')) throw new ApiError(502, 'VOICE_UNAVAILABLE');
  const audio = Buffer.from(await response.arrayBuffer());
  await mkdir(cacheDir(), { recursive: true }); await writeFile(file, audio);
  return { audio, cached: false };
}
const SPLIT_EN: Record<string, string> = { push: 'chest, shoulders and triceps', pull: 'back and biceps', legs: 'legs and glutes', core: 'core and abs', full: 'full body', upper: 'upper body', lower: 'legs and core' };
const MOTIVATION_EN = ['Good, keep going.', 'Breathe steadily.', 'Keep your form clean.', 'Halfway there, strong work.', 'Just a little more.', 'You can do this.', 'Slow and controlled.', 'Excellent, just like that.'];
// The PT script is assembled on the server from stored exercises/steps and the user's level; the client only sends ids.
export async function sessionSpeech(userId: string, raw: unknown) {
  const input = z.object({ split: z.enum(['push', 'pull', 'legs', 'core', 'full', 'upper', 'lower']), exerciseIds: z.array(z.string().max(100)).min(1).max(6), lang: z.enum(['my', 'en']).optional() }).strict().parse(raw);
  const [profile, rows] = await Promise.all([prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.exercise.findMany({ where: { id: { in: input.exerciseIds } }, include: { translations: { where: { locale: 'my-MM' } } } })]);
  if (rows.length !== input.exerciseIds.length) throw new ApiError(400, 'UNKNOWN_EXERCISE');
  const level = (profile?.experience ?? 'beginner') as Level;
  if (input.lang === 'en') {
    const en = [`Hello! Today we train ${SPLIT_EN[input.split]} together. Start with about five minutes of easy warm-up.`];
    input.exerciseIds.forEach((id, i) => {
      const e = rows.find(r => r.id === id)!; const g = (e.guidance ?? {}) as { perSide?: boolean };
      const d = doseFor({ tracking: e.tracking, equipment: e.equipment as string[], tags: e.tags as string[] }, level, !!g.perSide);
      const cue = (e.steps as Step[])[0]?.en ?? '';
      en.push(`Exercise ${i + 1}: ${e.name.split('—')[0].trim()}. ${d.sets} sets of ${d.target} ${d.unit === 'reps' ? 'reps' : 'seconds'}${d.perSide ? ' each side' : ''}. ${d.restSeconds !== '0' ? `Rest ${d.restSeconds} seconds between sets.` : ''} ${cue}`);
    });
    en.push('Finish by stretching gently and drinking water. Form comes before weight. If anything hurts, stop. You have got this.');
    return synthesize(userId, en.join(' '), 'en');
  }
  const ordinal = ['ပထမ', 'ဒုတိယ', 'တတိယ', 'စတုတ္ထ', 'ပဉ္စမ', 'ဆဋ္ဌမ'];
  const parts = [`မင်္ဂလာပါ။ ဒီနေ့ ${SPLIT_MY[input.split]} ကို အတူတူ လေ့ကျင့်ကြမယ်။ အရင်ဆုံး ငါးမိနစ်လောက် ပေါ့ပါးစွာ ကြိုတင်လှုပ်ရှားပါ။`];
  input.exerciseIds.forEach((id, i) => {
    const e = rows.find(r => r.id === id)!;
    const name = (e.translations[0]?.name ?? e.name).split('—').pop()!.trim();
    const g = (e.guidance ?? {}) as { perSide?: boolean };
    const d = doseFor({ tracking: e.tracking, equipment: e.equipment as string[], tags: e.tags as string[] }, level, !!g.perSide);
    const unit = d.unit === 'reps' ? 'ကြိမ်' : 'စက္ကန့်';
    const cue = (e.steps as { my: string | null }[])[0]?.my ?? '';
    parts.push(`${ordinal[i]} လေ့ကျင့်ခန်း — ${name}။ ${myNumber(Number(d.sets))} အကျော့၊ တစ်ကျော့လျှင် ${myRange(d.target)} ${unit}${d.perSide ? '၊ တစ်ဖက်စီ' : ''}။ ${d.restSeconds !== '0' ? `အကျော့ကြား ${myRange(d.restSeconds)} စက္ကန့် အနားယူပါ။` : ''} ${cue}`);
  });
  parts.push('နောက်ဆုံးမှာ ကြွက်သားတွေကို ဖြည်းဖြည်း ဆန့်ပြီး ရေသောက်ပါ။ ပုံစံမှန်ကို အလေးချိန်ထက် ဦးစားပေးပါ။ နာကျင်မှု ရှိလာရင် ချက်ချင်း ရပ်ပါ။ အားပေးနေပါတယ်။');
  return synthesize(userId, parts.join(' ').normalize('NFC'));
}
// Read an AI Coach answer aloud: owner-checked, Burmese text only (the configured voice is Burmese), bounded length.
export async function messageSpeech(userId: string, messageId: string) {
  const message = await prisma.aiMessage.findFirst({ where: { id: messageId, role: 'assistant', conversation: { userId } } });
  if (!message) throw new ApiError(404, 'NOT_FOUND');
  const text = message.content.replace(/[*#_`>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500).normalize('NFC');
  return synthesize(userId, text, /[က-႟]/.test(text) ? 'my' : 'en');
}

// Burmese TTS reads digits poorly (measured: digit-heavy sentences were not recognised as Burmese), so numbers are spoken as words.
const WORD = ['သုည', 'တစ်', 'နှစ်', 'သုံး', 'လေး', 'ငါး', 'ခြောက်', 'ခုနစ်', 'ရှစ်', 'ကိုး'];
export function burmeseNumberWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 9999) return String(n);
  if (n < 10) return WORD[n];
  const parts: [number, string, string][] = [[1000, 'ထောင်', 'ထောင့်'], [100, 'ရာ', 'ရာ့'], [10, 'ဆယ်', 'ဆယ့်']];
  let rest = n, out = '';
  for (const [unit, plain, joined] of parts) {
    const d = Math.floor(rest / unit); rest %= unit;
    if (d) out += (d === 1 && unit === 10 && !out ? '' : WORD[d]) + (rest ? joined : plain);
  }
  return out + (rest ? WORD[rest] : '');
}
const MY_TO_ASCII = (s: string) => s.replace(/[၀-၉]/g, d => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(d)));
export function speakableBurmese(text: string) {
  return text.replace(/[0-9၀-၉]+/g, m => burmeseNumberWords(Number(MY_TO_ASCII(m)))).replace(/[–-](?=\s*[က-႟])/g, ' မှ ');
}

// ---------- Guided-player script (locales/workout-voice.ts): countdown, go, switch sides, rest, get ready, complete ----------
export const WORKOUT_CUES = ['starts', 'go', 'side', 'relax', 'ready', 'count', 'complete', 'encourage'] as const;
export type WorkoutCue = typeof WORKOUT_CUES[number];
const CUE_KEY: Record<Exclude<WorkoutCue, 'count'>, VoiceKey> = { starts: 'startsIn', go: 'go', side: 'switchSide', relax: 'rest', ready: 'getReady', complete: 'done', encourage:'encourage' };
async function workoutCueText(kind: WorkoutCue, lang: VoiceLang, exerciseId?: string, n?: number) {
  if (kind === 'count') { if (!n || n < 1) throw new ApiError(400, 'INVALID_INPUT'); return String(n); }
  let name = '';
  if (kind === 'starts' || kind === 'ready') {
    if (!exerciseId) throw new ApiError(400, 'INVALID_INPUT');
    const e = await prisma.exercise.findUnique({ where: { id: exerciseId }, include: { translations: { where: { locale: 'my-MM' } } } });
    if (!e) throw new ApiError(404, 'NOT_FOUND');
    name = lang === 'en' ? e.name.split('—')[0].trim() : (e.translations[0]?.name ?? e.name).split('—').pop()!.trim();
  }
  return voiceLine(lang, CUE_KEY[kind], { name });
}

// ---------- In-workout PT cues (fixed templates + stored exercise data only) ----------
export const MOTIVATION_MY = ['ကောင်းတယ်၊ ဆက်လုပ်ပါ။', 'အသက်ကို ပုံမှန်ရှူပါ။', 'ပုံစံမှန်ကို ထိန်းထားပါ။', 'တစ်ဝက် ရောက်ပါပြီ၊ အားကောင်းတယ်။', 'နောက်ဆုံး အနည်းငယ်ပဲ ကျန်တော့တယ်။', 'သင် လုပ်နိုင်ပါတယ်။', 'ဖြည်းဖြည်းနဲ့ ထိန်းချုပ်ပါ။', 'အရမ်းတော်ပါတယ်၊ ဒီအတိုင်းပဲ။'];
const MUSCLE_MY: Record<string, string> = { chest: 'ရင်ဘတ်', 'upper-back': 'ကျောအပေါ်ပိုင်း', 'lower-back': 'ခါး', trapezius: 'ပခုံးကြော', 'front-deltoids': 'ပခုံးရှေ့', 'back-deltoids': 'ပခုံးနောက်', biceps: 'လက်မောင်းရှေ့', triceps: 'လက်မောင်းနောက်', forearm: 'လက်ဖျံ', quadriceps: 'ပေါင်ရှေ့', hamstring: 'ပေါင်နောက်', gluteal: 'တင်ပါး', calves: 'ခြေသလုံး', abs: 'ဝမ်းဗိုက်', obliques: 'ဝမ်းဗိုက်ဘေး', adductor: 'ပေါင်အတွင်း', abductors: 'ပေါင်အပြင်' };
export async function cueSpeech(userId: string, raw: unknown) {
  const q = z.object({ kind: z.enum(['next', 'motivate', 'done', 'rest', 'finish', 'pr', ...WORKOUT_CUES]), exerciseId: z.string().max(100).optional(), n: z.coerce.number().int().min(0).max(9).optional(), lang: z.enum(['my', 'en']).optional(), cachedOnly:z.enum(['1']).optional() }).strict().parse(raw);
  if (q.kind === 'motivate' && (q.n ?? 0) > 7) throw new ApiError(400, 'INVALID_INPUT');
  if ((WORKOUT_CUES as readonly string[]).includes(q.kind)) { const lang = q.lang === 'en' ? 'en' : 'my'; return synthesize(userId, (await workoutCueText(q.kind as WorkoutCue, lang, q.exerciseId, q.n)).normalize('NFC'), lang, q.cachedOnly==='1'); }
  if (q.lang === 'en') return synthesize(userId, await cueTextEn(userId, q), 'en');
  let text = '';
  if (q.kind === 'motivate') text = MOTIVATION_MY[q.n ?? 0];
  else if (q.kind === 'done') text = 'ပြီးပါပြီ၊ တော်လိုက်တာ။ ခဏ အနားယူပြီး ရေနည်းနည်း သောက်ပါ။';
  else if (q.kind === 'rest') text = 'အနားယူချိန်ပါ။ အသက်ကို ဖြည်းဖြည်း ရှူပါ။';
  else if (q.kind === 'pr') text = 'ကိုယ်ပိုင် စံချိန်သစ် ရပါပြီ။ အရမ်းတော်ပါတယ်။ ဒီအားနဲ့ ဆက်သွားကြမယ်။';
  else if (q.kind === 'finish') text = 'ဒီနေ့ လေ့ကျင့်မှု ပြီးဆုံးပါပြီ။ ဂုဏ်ယူပါတယ်။ ဆန့်ထုတ်ပြီး ရေသောက်ဖို့ မမေ့ပါနဲ့။';
  else {
    if (!q.exerciseId) throw new ApiError(400, 'INVALID_INPUT');
    const [profile, e] = await Promise.all([prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.exercise.findUnique({ where: { id: q.exerciseId }, include: { translations: { where: { locale: 'my-MM' } } } })]);
    if (!e) throw new ApiError(404, 'NOT_FOUND');
    const name = (e.translations[0]?.name ?? e.name).split('—').pop()!.trim();
    const muscles = (e.primaryMuscles as string[]).map(m => MUSCLE_MY[m]).filter(Boolean).join('နှင့် ');
    const d = doseFor({ tracking: e.tracking, equipment: e.equipment as string[], tags: e.tags as string[] }, (profile?.experience ?? 'beginner') as Level, !!(e.guidance as { perSide?: boolean })?.perSide);
    const cue = (e.steps as { my: string | null }[])[0]?.my ?? '';
    text = `နောက်တစ်ခု — ${name}။ ${muscles ? `${muscles} ကို လေ့ကျင့်မယ်။` : ''} ${myRange(d.sets)} အကျော့၊ ${myRange(d.target)} ${d.unit === 'reps' ? 'ကြိမ်' : 'စက္ကန့်'}။ ${cue}`;
  }
  return synthesize(userId, text.normalize('NFC'));
}
async function cueTextEn(userId: string, q: { kind: string; exerciseId?: string; n?: number }) {
  if (q.kind === 'motivate') return MOTIVATION_EN[q.n ?? 0];
  if (q.kind === 'done') return 'Done, great job. Rest a moment and sip some water.';
  if (q.kind === 'rest') return 'Rest time. Breathe slowly.';
  if (q.kind === 'pr') return 'New personal record! Fantastic work.';
  if (q.kind === 'finish') return 'Workout complete. Proud of you. Stretch and drink water.';
  if (!q.exerciseId) throw new ApiError(400, 'INVALID_INPUT');
  const [profile, e] = await Promise.all([prisma.fitnessProfile.findUnique({ where: { userId } }), prisma.exercise.findUnique({ where: { id: q.exerciseId } })]);
  if (!e) throw new ApiError(404, 'NOT_FOUND');
  const d = doseFor({ tracking: e.tracking, equipment: e.equipment as string[], tags: e.tags as string[] }, (profile?.experience ?? 'beginner') as Level, !!(e.guidance as { perSide?: boolean })?.perSide);
  return `Next: ${e.name.split('—')[0].trim()}. ${d.sets} sets of ${d.target} ${d.unit === 'reps' ? 'reps' : 'seconds'}. ${(e.steps as Step[])[0]?.en ?? ''}`;
}
// Spoken post-workout summary built from the user's own completed session.
export async function summarySpeech(userId: string, sessionId: string, lang: VoiceLang = 'my') {
  const s = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId, status: 'completed' }, include: { sets: true } });
  if (!s) throw new ApiError(404, 'NOT_FOUND');
  const minutes = Math.max(1, Math.round(((s.endedAt?.getTime() ?? Date.now()) - s.startedAt.getTime() - s.totalPausedMs) / 60000));
  const exercises = new Set(s.sets.map(x => x.exerciseId)).size, reps = s.sets.reduce((n, x) => n + x.reps, 0);
  if (lang === 'en') return synthesize(userId, `You trained for ${minutes} minutes: ${exercises} exercises, ${s.sets.length} sets${reps ? `, ${reps} reps in total` : ''}. Great work. Eat a meal with protein and rest well.`, 'en');
  const text = `ဒီနေ့ ${minutes} မိနစ် လေ့ကျင့်ခဲ့ပါတယ်။ လေ့ကျင့်ခန်း ${exercises} မျိုး၊ အကျော့ ${s.sets.length} ကျော့${reps ? `၊ စုစုပေါင်း ${reps} ကြိမ်` : ''} ပြီးခဲ့ပါတယ်။ အရမ်းတော်ပါတယ်။ ပရိုတင်း ပါတဲ့ အစာ စားပြီး ကောင်းကောင်း အနားယူပါ။`;
  return synthesize(userId, text);
}

// Weekly report narrative read aloud (owner's own cached report, Burmese text only).
export async function reportSpeech(userId: string, key: string) {
  if (!/^report:\d{4}-\d{2}-\d{2}$/.test(key)) throw new ApiError(400, 'INVALID_INPUT');
  const m = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key } } });
  if (!m) throw new ApiError(404, 'NOT_FOUND');
  const text = m.content.replace(/[•*#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
  return synthesize(userId, text.normalize('NFC'), /[က-႟]/.test(text) ? 'my' : 'en');
}

// Pre-generate the fixed audio (cues + every exercise's full step script, Myanmar and English when configured)
// so the first tap plays instantly. Runs once in the background after server start; already cached files are skipped.
export async function warmVoices(log: (m: string) => void = () => {}) {
  const { persistDatabase } = await import('./durability');
  let made = 0;
  const run = async (fn: () => Promise<{ cached: boolean }>) => { try { const r = await fn(); if (!r.cached) { made++; if (made % 10 === 0) await persistDatabase(); } } catch { /* skip; tried again next start */ } };
  const exercises = await prisma.exercise.findMany({ select: { id: true } });
  for (const lang of ['my', 'en'] as const) {
    if (!ttsConfigured(lang)) continue;
    for (const kind of ['done', 'rest', 'pr', 'finish'] as const) await run(() => cueSpeech(WARM_USER, { kind, lang }));
    for (let n = 0; n < 8; n++) await run(() => cueSpeech(WARM_USER, { kind: 'motivate', n, lang }));
    for (const kind of ['go', 'side', 'relax', 'complete'] as const) await run(() => cueSpeech(WARM_USER, { kind, lang }));
    for (let n = 1; n <= 9; n++) await run(() => cueSpeech(WARM_USER, { kind: 'count', n, lang }));
    for (const e of exercises) for (const kind of ['starts', 'ready'] as const) await run(() => cueSpeech(WARM_USER, { kind, exerciseId: e.id, lang }));
    for (const e of exercises) await run(() => exerciseSpeech(WARM_USER, e.id, undefined, lang));
  }
  if (made) await persistDatabase();
  log(`voice warm-up: ${made} new clips`);
}
