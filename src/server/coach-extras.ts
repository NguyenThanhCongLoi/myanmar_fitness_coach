import { z } from 'zod';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';
import { gatewayConfigured } from './agent';
import { energySummary } from './energy';
import { progressOverview, e1rm } from './progression';
import { gameSummary } from './gamification';
import { civilDay } from './streak';
import { FLAME_LIT_AT } from './streak';

// Plain JSON completion through the owner-configured gateway (no tools). Output is always validated before use.
async function llmJson(system: string, user: string, maxTokens = 900, image?: string): Promise<unknown> {
  if (!gatewayConfigured()) throw new ApiError(503, 'LLM_NOT_CONFIGURED');
  let response: Response;
  try {
    response = await fetch(`${process.env.LLM_BASE_URL!.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: (image && process.env.LLM_VISION_MODEL) || process.env.LLM_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: image ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: image } }] : user }], temperature: 0.2, max_tokens: maxTokens, response_format: { type: 'json_object' } }), signal: AbortSignal.timeout(60000), cache: 'no-store' });
  } catch { throw new ApiError(502, 'GATEWAY_UNAVAILABLE'); }
  if (!response.ok) throw new ApiError(image && response.status >= 400 && response.status < 500 ? 422 : 502, image && response.status >= 400 && response.status < 500 ? 'PHOTO_NOT_SUPPORTED' : 'GATEWAY_UNAVAILABLE');
  const text = (await response.json()).choices?.[0]?.message?.content ?? '';
  try { return JSON.parse(String(text).replace(/^```(json)?|```$/gm, '').trim()); } catch { throw new ApiError(502, 'GATEWAY_INVALID_RESPONSE'); }
}
const language = (locale: string) => (locale === 'my-MM' ? 'Myanmar Unicode (keep English exercise names)' : 'English');

// ---------- Weekly report: deterministic numbers + optional LLM narrative (cached per week) ----------
export async function weeklyReport(userId: string, now = new Date()) {
  const [o, e] = await Promise.all([progressOverview(userId, now), energySummary(userId).catch(() => null)]);
  const [thisWeek, lastWeek] = [o.weeks[7], o.weeks[6]];
  const since = new Date(now.getTime() - 7 * 86400000);
  const weekSets = await prisma.workoutSet.findMany({ where: { completed: true, loggedAt: { gte: since }, session: { userId, status: 'completed' } }, select: { id: true, exerciseId: true, reps: true, weightKg: true } });
  const older = await prisma.workoutSet.findMany({ where: { completed: true, loggedAt: { lt: since }, exerciseId: { in: [...new Set(weekSets.map(s => s.exerciseId))] }, session: { userId, status: 'completed' } }, select: { exerciseId: true, reps: true, weightKg: true } });
  const prs = [...new Set(weekSets.filter(s => { const v = e1rm(s.weightKg, s.reps); const prev = older.filter(o2 => o2.exerciseId === s.exerciseId).reduce((m, o2) => Math.max(m, e1rm(o2.weightKg, o2.reps) ?? 0), 0); return v && prev && v > prev; }).map(s => s.exerciseId))].length;
  const weights = await prisma.bodyMeasurement.findMany({ where: { userId, recordedAt: { gte: new Date(now.getTime() - 14 * 86400000) } }, orderBy: { recordedAt: 'asc' } });
  const under = Object.entries(o.setsPerMuscle).filter(([, n]) => n < 6).map(([m]) => m);
  const key = `report:${o.weeks[7].week}`;
  const cached = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key } } });
  return {
    key, week: thisWeek, previous: lastWeek, prs, muscles: o.setsPerMuscle, lowVolumeMuscles: under,
    weightChangeKg: weights.length >= 2 ? Math.round((weights.at(-1)!.weightKg - weights[0].weightKg) * 10) / 10 : null,
    avgIntake: e && e.loggedDays ? Math.round(e.daily.filter(d => d.logged).reduce((n, d) => n + d.intake, 0) / e.loggedDays) : null, targetIntake: e?.targetIntake ?? null,
    narrative: cached?.content ?? null,
  };
}
export async function weeklyNarrative(userId: string, locale: string) {
  const r = await weeklyReport(userId);
  if (r.narrative) return r;
  const out = z.object({ bullets: z.array(z.string().min(1).max(220)).min(2).max(6) }).parse(await llmJson(
    `You are a supportive personal trainer writing a weekly review in ${language(locale)}. Use ONLY the numbers given. 4-5 short bullets: what went well, one thing to improve, the plan for next week, one nutrition tip. Never invent numbers, never give medical advice, never push intensity for streaks. Return JSON {"bullets": string[]}.`,
    JSON.stringify({ week: r.week, previousWeek: r.previous, newRecords: r.prs, setsPerMuscle: r.muscles, lowVolumeMuscles: r.lowVolumeMuscles, weightChangeKg: r.weightChangeKg, avgIntakeKcal: r.avgIntake, targetIntakeKcal: r.targetIntake })));
  const content = out.bullets.map(b => `• ${b.normalize('NFC')}`).join('\n');
  await prisma.aiMemory.upsert({ where: { userId_key: { userId, key: r.key } }, create: { userId, key: r.key, content }, update: { content } });
  return { ...r, narrative: content };
}

// ---------- Natural-language logging (always previewed; the user confirms before anything is saved) ----------
export async function parseSets(userId: string, raw: unknown) {
  const { sessionId, text } = z.object({ sessionId: z.string().max(40), text: z.string().trim().min(2).max(400) }).strict().parse(raw);
  const session = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId, status: { in: ['active', 'paused'] } }, include: { prescriptions: { include: { exercise: { select: { id: true, name: true } } } } } });
  if (!session) throw new ApiError(404, 'NOT_FOUND');
  const choices = session.prescriptions.filter(p => !p.skipped).map(p => ({ id: p.exerciseId, name: p.exercise.name, sets: p.sets }));
  const out = await llmJson('Extract strength-training sets from the user text (English or Burmese). Only use exercise ids from the list. Return JSON {"sets":[{"exerciseId":string,"reps":int,"weightKg":number}]}; one entry per set (3x10 => three entries). Ignore anything else. If unsure, return {"sets":[]}.',
    JSON.stringify({ exercises: choices, text }), 600);
  const sets = z.object({ sets: z.array(z.object({ exerciseId: z.string(), reps: z.number().int().min(1).max(100), weightKg: z.number().min(0).max(400) })).max(20) }).parse(out).sets;
  return { sets: sets.filter(s => choices.some(c => c.id === s.exerciseId)) };
}
export async function parseFood(userId: string, raw: unknown) {
  const { text, locale } = z.object({ text: z.string().trim().min(2).max(300), locale: z.enum(['my-MM', 'en']) }).strict().parse(raw);
  const out = await llmJson(`Estimate calories and protein for the foods the user ate (Myanmar dishes are common). Return JSON {"items":[{"description":string in ${language(locale)},"kcal":int,"proteinG":number,"meal":"breakfast"|"lunch"|"dinner"|"snack"}]}. Use typical single portions; these are estimates. If the text is not food, return {"items":[]}.`, text, 600);
  const items = z.object({ items: z.array(z.object({ description: z.string().min(1).max(120), kcal: z.number().int().min(1).max(3000), proteinG: z.number().min(0).max(200), meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']) })).max(10) }).parse(out).items;
  return { items: items.map(i => ({ ...i, description: i.description.normalize('NFC') })), estimate: true };
}

// ---------- Daily motivation line (LLM, one per user per day per language, cached; deterministic slogan is the fallback) ----------
// Zawgyi-only code points / visual-order patterns: such output is rejected, never silently converted.
const ZAWGYI = /[\u105a\u1060-\u1097]|(^|[\s\u104a\u104b])[\u1031\u103b]|\u103a\u1037|^[\u102b-\u103e]/;
export function cleanMotivation(raw: unknown, locale: 'my-MM' | 'en') {
  if (typeof raw !== 'string') return null;
  const line = raw.normalize('NFC').replace(/[\r\n]+/g, ' ').replace(/^["'“”\s]+|["'“”\s]+$/g, '').trim();
  if (line.length < 4 || line.length > 180) return null;
  const burmese = /[\u1000-\u109f]/.test(line);
  if (locale === 'my-MM' && (!burmese || ZAWGYI.test(line))) return null;
  if (locale === 'en' && burmese) return null;
  if (/https?:|www\./i.test(line)) return null;
  return line;
}
const failed = new Map<string, number>();
export async function dailyMotivation(userId: string, rawLocale: string, now = new Date()) {
  const locale = rawLocale === 'en' ? 'en' : 'my-MM';
  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  const day = civilDay(now, profile?.timezone ?? 'Asia/Yangon');
  // v2: prompt keeps the user's name verbatim (v1 lines are replaced).
  const key = `motivation:v2:${day}:${locale}`;
  const hit = await prisma.aiMemory.findUnique({ where: { userId_key: { userId, key } } });
  if (hit) return { line: hit.content, generated: false };
  // Unconfigured gateway or a recent failure: the client shows its built-in slogan (no retries on every app open).
  if (!gatewayConfigured() || now.getTime() - (failed.get(key) ?? 0) < 30 * 60000) return { line: null, generated: false };
  const [game, user] = await Promise.all([gameSummary(userId, now), prisma.user.findUnique({ where: { id: userId }, select: { name: true } })]);
  const facts = {
    date: day, firstName: (profile?.nickname || (user?.name ?? '').split(' ')[0]).slice(0, 30), goal: profile?.goal ?? 'general_fitness',
    streakDays: game.streak.current, bestStreak: game.streak.longest, flameLit: game.streak.current >= FLAME_LIT_AT,
    daysUntilFlameLights: Math.max(0, FLAME_LIT_AT - game.streak.current), workoutsThisWeek: game.completedWeek, weeklyGoal: game.weeklyGoal,
    today: game.mission.kind,
  };
  const system = `You write ONE short, warm, encouraging line for a fitness app user, shown next to a friendly bee mascot.
Rules: max 20 words; positive and specific to the facts; no medical advice, diagnosis, weight-loss promises or body shaming; never pressure training on a rest/recovery day (today = rest, recovery, protected or transition) — then praise recovery; if the flame is not lit yet, encourage the next small step; no hashtags, no links, at most one emoji.
Name: if you address the user, write firstName exactly as given (Latin letters are fine inside Myanmar text) — never translate or transliterate it, and never use family words (mother, father, sister, brother, uncle, aunt) to address the user.
Write in ${locale === 'my-MM' ? 'Myanmar (Burmese) using standard Unicode only, natural spoken style; English fitness words are fine' : 'English'}.
Return JSON: {"line": "..."}`;
  try {
    const out = await llmJson(system, JSON.stringify(facts), 200) as { line?: unknown };
    const line = cleanMotivation(out?.line, locale);
    if (!line) throw new Error('invalid');
    await prisma.aiMemory.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, content: line }, update: { content: line } });
    // Keep only today's lines.
    await prisma.aiMemory.deleteMany({ where: { userId, AND: [{ key: { startsWith: 'motivation:' } }, { NOT: { key: { startsWith: `motivation:v2:${day}` } } }] } });
    return { line, generated: true };
  } catch {
    failed.set(key, now.getTime());
    return { line: null, generated: false };
  }
}

// ---------- Meal photo → estimated calories (preview only; the photo is never stored) ----------
const photoInput = z.object({ image: z.string().max(1_400_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/), locale: z.enum(['my-MM', 'en']).default('my-MM') }).strict();
export async function parseMealPhoto(raw: unknown) {
  const { image, locale } = photoInput.parse(raw);
  const system = `You estimate food from a photo for a fitness app in Myanmar. Identify each visible dish or drink, estimate the portion and its calories and protein.
Use typical Myanmar portions (e.g. one plate of rice ≈ 250 g ≈ 330 kcal; mohinga bowl ≈ 400 kcal; milk tea ≈ 120 kcal). If the photo shows no food, return an empty list.
Names in ${locale === 'my-MM' ? 'Myanmar (Burmese) Unicode, keep English food names people use' : 'English'}. Never give medical advice.
Return JSON: {"items":[{"name":"...","portion":"...","kcal":0,"proteinG":0}],"confidence":"low|medium|high"}`;
  const out = await llmJson(system, 'Estimate this meal.', 700, image) as { items?: unknown; confidence?: unknown };
  const items = (Array.isArray(out?.items) ? out.items : []).slice(0, 8).map(i => i as { name?: unknown; portion?: unknown; kcal?: unknown; proteinG?: unknown })
    .map(i => ({ description: String(i.name ?? '').normalize('NFC').slice(0, 80), portion: String(i.portion ?? '').slice(0, 40), kcal: Math.round(Number(i.kcal)), proteinG: Math.round(Number(i.proteinG) * 10) / 10 }))
    .filter(i => i.description && Number.isFinite(i.kcal) && i.kcal > 0 && i.kcal <= 3000 && Number.isFinite(i.proteinG) && i.proteinG >= 0 && i.proteinG <= 200);
  return { items, confidence: ['low', 'medium', 'high'].includes(String(out?.confidence)) ? String(out?.confidence) : 'low' };
}
