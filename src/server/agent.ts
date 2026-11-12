// Tool-driven plan workflow adapted from fitness-coach (MIT notice in licenses/).
// Product data and tool execution remain in this TypeScript application.
import { prisma } from '@/shared/lib/prisma';
import { ApiError, planSchema } from './validation';
import { dashboard, exerciseList } from './services';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { coachSystemPrompt } from './coach-policy';
import { analyzeRecentMuscleLoad, recommendTrainingFocus } from './recommendation';
import { previewRoutine } from './training';
import { LOCATION_EQUIPMENT } from './sequencer';
import { nutritionGuidance, pickSession, weeklyPlan, type Goal } from '@/shared/program';
import { exerciseRecommendations, todaySession } from './pt';
import { coachInsights, energySummary } from './energy';
import { weeklyReport } from './coach-extras';
import type { Level } from '@/shared/dose';

export function gatewayConfigured() {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}
const empty = { type: 'object', properties: {}, additionalProperties: false };
const idArg = { type: 'string', maxLength: 100, description: 'Existing exercise id from this app (never invent)' };
const fn = (name: string, description: string, parameters: object = empty) => ({ type: 'function', function: { name, description, parameters } });
const tools = [
  fn('get_user_profile', 'Read the authenticated user fitness preferences, experience, equipment, units and stated movement limitations.'),
  fn('get_exercise_details', 'Read verified app data for one exercise: instructions, primary/secondary muscles (canonical IDs), equipment, difficulty, tracking, common mistakes, alternatives, media availability.', { type: 'object', properties: { exerciseId: idArg }, required: ['exerciseId'], additionalProperties: false }),
  fn('search_exercises', 'Find real exercises and their stable IDs. Optional filters by muscle ID or equipment. Never invent exercise IDs.', { type: 'object', properties: { query: { type: 'string', maxLength: 100 }, muscle: { type: 'string', maxLength: 40 }, equipment: { type: 'string', maxLength: 40 } }, required: ['query'], additionalProperties: false }),
  fn('get_training_history', 'Read the user recent completed workouts (last 10), optionally only sets of one exercise, with reps/weight/time actually logged and check-in feedback.', { type: 'object', properties: { exerciseId: idArg }, additionalProperties: false }),
  fn('find_exercise_alternatives', 'Find existing alternatives for an exercise: easier, harder or similar, with equipment availability for this user.', { type: 'object', properties: { exerciseId: idArg, direction: { type: 'string', enum: ['easier', 'harder', 'similar'] } }, required: ['exerciseId', 'direction'], additionalProperties: false }),
  fn('analyze_recent_muscle_load', 'Relative training exposure per canonical muscle over the last 7 days from real completed sets and self-reported soreness. Not a medical measure.'),
  fn('recommend_training_focus', 'Deterministic next-workout recommendation (focus group, difficulty, rest/recovery) with reason codes, for home or gym.', { type: 'object', properties: { location: { type: 'string', enum: ['home', 'gym'] } }, additionalProperties: false }),
  fn('preview_follow_along', 'Validate and preview a Follow Along routine with the server sequencer (counts warm-up, work, rest, transitions, cooldown). Returns the routine or a reason it cannot fit. Saves nothing.', { type: 'object', properties: { minutes: { type: 'integer', minimum: 1, maximum: 60 }, focus: { type: 'string', enum: ['all', 'legs', 'core', 'push', 'pull', 'upper'] }, location: { type: 'string', enum: ['home', 'gym'] } }, required: ['minutes', 'focus', 'location'], additionalProperties: false }),
  fn('validate_workout_draft', 'Validate a Free Workout draft: exercise IDs exist, no duplicates, equipment available, level, sets/reps/rest within app limits. Returns problems; saves nothing.', { type: 'object', properties: { exercises: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { exerciseId: idArg, sets: { type: 'integer' }, reps: { type: 'integer' }, restSeconds: { type: 'integer' } }, required: ['exerciseId', 'sets', 'reps', 'restSeconds'], additionalProperties: false } } }, required: ['exercises'], additionalProperties: false }),
  fn('get_weekly_plan', 'The app deterministic coach week for this user: training weekdays (0=Mon), muscle pairing per day (push=chest/shoulders/triceps, pull=back/biceps, legs, core, upper, lower, full) and exercises with starting sets x reps for home or gym. Use this before suggesting a schedule.', { type: 'object', properties: { location: { type: 'string', enum: ['home', 'gym'] } }, required: ['location'], additionalProperties: false }),
  fn('get_today_session', 'Personal-trainer session for TODAY for this user: planned muscle pairing for the weekday, adjusted by real recovery signals (rest day, pain, high recent load), with exercises, sets x reps/time, rest and nutrition numbers. Use this when the user asks what to train today or wants a PT-style session.', { type: 'object', properties: { location: { type: 'string', enum: ['home', 'gym'] } }, required: ['location'], additionalProperties: false }),
  fn('get_exercise_recommendations', 'For one exercise: other exercises for the same muscle from different angles, and complementary exercises (antagonist balance, synergist finisher, core support) with reason codes, filtered to location and the user level.', { type: 'object', properties: { exerciseId: idArg, location: { type: 'string', enum: ['home', 'gym'] } }, required: ['exerciseId', 'location'], additionalProperties: false }),
  fn('get_energy_summary', 'Last 7 days of the user self-logged food intake, cardio/activity and workouts with estimated calories out (BMR Mifflin-St Jeor x 1.2 + MET-based activity), daily target intake for their weight goal, protein range and projected weekly weight change. Estimates only.'),
  fn('get_insights', 'Current proactive insights about the user (workouts this week vs goal, intake vs target, protein, projection to goal weight, missing body data). Mention the most useful one briefly when relevant.'),
  fn('get_weekly_report', 'This week vs last week from real data: workouts, sets, volume, new personal records, sets per muscle, low-volume muscles, weight change, average intake vs target.'),
  fn('get_nutrition_guidance', 'General nutrition ranges for this user from their latest body weight and goal (protein g/day, water L/day, energy approach). Not a medical diet; never give medical nutrition therapy.'),
  fn('propose_plan', 'Propose a saved weekly plan for explicit user approval in the UI. Does NOT activate it. Shape: name, goal, weeks, days: [{name,week,weekday,exercises:[{exerciseId,sets,reps,restSeconds,targetKg}]}]. Existing exercise IDs only.', {
    type: 'object', properties: {
      name: { type: 'string' }, goal: { type: 'string' }, weeks: { type: 'integer', minimum: 1, maximum: 8 },
      days: { type: 'array', minItems: 1, maxItems: 24, items: { type: 'object', properties: {
        name: { type: 'string' }, week: { type: 'integer', minimum: 1, maximum: 8 }, weekday: { type: 'integer', minimum: 0, maximum: 6 },
        exercises: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'object', properties: {
          exerciseId: { type: 'string' }, sets: { type: 'integer', minimum: 1, maximum: 8 }, reps: { type: 'integer', minimum: 1, maximum: 50 },
          restSeconds: { type: 'integer', minimum: 15, maximum: 600 }, targetKg: { type: 'number', minimum: 0, maximum: 400 },
        }, required: ['exerciseId', 'sets', 'reps', 'restSeconds', 'targetKg'], additionalProperties: false } },
      }, required: ['name', 'week', 'weekday', 'exercises'], additionalProperties: false } },
    }, required: ['name', 'goal', 'weeks', 'days'], additionalProperties: false,
  }),
];
const rank: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
type ExerciseRow = { id: string; canonicalId: string | null; name: string; difficulty: string; equipment: unknown; primaryMuscles: unknown; secondaryMuscles: unknown; tracking: string };
const exerciseSummary = (e: ExerciseRow) => ({ id: e.id, canonicalId: e.canonicalId, name: e.name, difficulty: e.difficulty, equipment: e.equipment, primaryMuscles: e.primaryMuscles, secondaryMuscles: e.secondaryMuscles, tracking: e.tracking });
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export async function executeTool(userId: string, name: string, args: unknown) {
  let result: unknown;
  const profile = () => prisma.fitnessProfile.findUnique({ where: { userId } });
  if (name === 'get_user_profile') {
    z.object({}).strict().parse(args ?? {});
    const p = await profile();
    result = { profile: p && { goal: p.goal, experience: p.experience, equipment: p.equipment, daysPerWeek: p.daysPerWeek, limitations: p.limitations, screening: p.screening, weightUnit: p.weightUnit, locale: p.locale }, memories: await prisma.aiMemory.findMany({ where: { userId, key: { in: ['user_note', 'injuries', 'preferences', 'schedule'] } }, select: { key: true, content: true }, take: 10 }) };
  } else if (name === 'get_exercise_details') {
    const { exerciseId } = z.object({ exerciseId: z.string().max(100) }).strict().parse(args);
    const e = await prisma.exercise.findUnique({ where: { id: exerciseId }, include: { translations: { select: { locale: true, name: true, instructions: true, reviewStatus: true } } } });
    result = e ? { ...exerciseSummary(e), instructions: e.instructions, steps: e.steps, commonMistakes: e.commonMistakes, alternatives: e.alternatives, tags: e.tags, translations: e.translations, demonstrationVideoAvailable: e.mediaLicenseStatus === 'verified' && !!e.videoUrl } : { error: 'UNKNOWN_EXERCISE' };
  } else if (name === 'search_exercises') {
    const { query, muscle, equipment } = z.object({ query: z.string().max(100), muscle: z.string().max(40).optional(), equipment: z.string().max(40).optional() }).strict().parse(args);
    result = (await exerciseList(query)).filter(e => (!muscle || [...strings(e.primaryMuscles), ...strings(e.secondaryMuscles)].includes(muscle)) && (!equipment || strings(e.equipment).includes(equipment))).slice(0, 15).map(exerciseSummary);
  } else if (name === 'get_training_history') {
    const { exerciseId } = z.object({ exerciseId: z.string().max(100).optional() }).strict().parse(args ?? {});
    result = await prisma.workoutSession.findMany({ where: { userId, status: 'completed', ...(exerciseId ? { sets: { some: { exerciseId } } } : {}) }, select: { mode: true, startedAt: true, endedAt: true, plan: { select: { name: true } }, sets: { where: exerciseId ? { exerciseId } : {}, select: { exerciseId: true, reps: true, seconds: true, weightKg: true } }, feedback: { select: { difficulty: true, soreMuscles: true, pain: true } } }, orderBy: { startedAt: 'desc' }, take: 10 });
  } else if (name === 'find_exercise_alternatives') {
    const { exerciseId, direction } = z.object({ exerciseId: z.string().max(100), direction: z.enum(['easier', 'harder', 'similar']) }).strict().parse(args);
    const [e, p, all] = await Promise.all([prisma.exercise.findUnique({ where: { id: exerciseId } }), profile(), prisma.exercise.findMany()]);
    if (!e) result = { error: 'UNKNOWN_EXERCISE' };
    else {
      const owned = new Set([...strings(p?.equipment), 'body weight']), primary = strings(e.primaryMuscles);
      result = all.filter(x => x.id !== e.id && strings(x.primaryMuscles).some(m => primary.includes(m)) && !strings(x.tags).some(t => t === 'warmup' || t === 'cooldown')
        && (direction === 'similar' || (direction === 'easier' ? (rank[x.difficulty] ?? 1) < (rank[e.difficulty] ?? 1) : (rank[x.difficulty] ?? 1) > (rank[e.difficulty] ?? 1))))
        .map(x => ({ ...exerciseSummary(x), listedAlternative: strings(e.alternatives).includes(x.id), equipmentAvailable: strings(x.equipment).every(q => owned.has(q)) })).slice(0, 8);
    }
  } else if (name === 'analyze_recent_muscle_load') {
    z.object({}).strict().parse(args ?? {});
    const a = await analyzeRecentMuscleLoad(userId);
    result = { completedSessions7d: a.sessions, groupLoad: a.groupLoad, trainedMuscles: a.muscles.filter(m => m.load > 0), recentFeedback: a.feedback, stats: (await dashboard(userId)).stats, note: 'Relative exposure index, not a medical measurement.' };
  } else if (name === 'recommend_training_focus') {
    const r = await recommendTrainingFocus(userId, args ?? {});
    result = { ...r, muscles: r.muscles.filter(m => m.load > 0) };
  } else if (name === 'preview_follow_along') {
    const input = z.object({ minutes: z.number().int().min(1).max(60), focus: z.enum(['all', 'legs', 'core', 'push', 'pull', 'upper']), location: z.enum(['home', 'gym']) }).strict().parse(args);
    const p = await profile();
    try {
      const r = await previewRoutine(userId, { seconds: input.minutes * 60, focus: input.focus, location: input.location, difficulty: p?.experience ?? 'beginner', equipment: [...LOCATION_EQUIPMENT[input.location]], avoid: [], excludedIds: [], reviewedConstraints: true });
      result = { fits: true, totalSeconds: r.totalSeconds, budgetSeconds: r.budgetSeconds, summary: r.summary, exercises: [...new Set(r.phases.filter(x => x.kind === 'exercise').map(x => x.exerciseId))], note: 'The user starts it from the Train screen; nothing was saved.' };
    } catch (error) { result = { fits: false, reason: error instanceof ApiError ? error.code : 'INVALID_INPUT', details: error instanceof ApiError ? error.details : undefined }; }
  } else if (name === 'validate_workout_draft') {
    const { exercises } = z.object({ exercises: z.array(z.object({ exerciseId: z.string().max(100), sets: z.number().int(), reps: z.number().int(), restSeconds: z.number().int() }).strict()).min(1).max(20) }).strict().parse(args);
    const [rows, p] = await Promise.all([prisma.exercise.findMany({ where: { id: { in: exercises.map(x => x.exerciseId) } } }), profile()]);
    const owned = new Set([...strings(p?.equipment), 'body weight']), problems: string[] = [], seen = new Set<string>();
    for (const x of exercises) {
      const e = rows.find(r => r.id === x.exerciseId);
      if (!e) problems.push(`UNKNOWN_EXERCISE:${x.exerciseId}`);
      else {
        if (strings(e.equipment).some(q => !owned.has(q))) problems.push(`EQUIPMENT_NOT_IN_PROFILE:${x.exerciseId}`);
        if ((rank[e.difficulty] ?? 1) > (rank[p?.experience ?? 'beginner'] ?? 0)) problems.push(`ABOVE_PROFILE_LEVEL:${x.exerciseId}`);
      }
      if (seen.has(x.exerciseId)) problems.push(`DUPLICATE:${x.exerciseId}`);
      seen.add(x.exerciseId);
      if (x.sets < 1 || x.sets > 8 || x.reps < 1 || x.reps > 50 || x.restSeconds < 15 || x.restSeconds > 600) problems.push(`OUT_OF_RANGE:${x.exerciseId}`);
    }
    result = { valid: problems.length === 0, problems, note: 'Free Workout has no total duration limit. Nothing was saved.' };
  } else if (name === 'get_weekly_plan') {
    const { location } = z.object({ location: z.enum(['home', 'gym']) }).strict().parse(args);
    const [p, game, library] = await Promise.all([profile(), prisma.gameState.findUnique({ where: { userId } }), prisma.exercise.findMany()]);
    const lib = library.map(e => ({ id: e.id, name: e.name, primaryMuscles: strings(e.primaryMuscles), secondaryMuscles: strings(e.secondaryMuscles), equipment: strings(e.equipment), difficulty: e.difficulty, tags: strings(e.tags), tracking: e.tracking, guidance: e.guidance as { home?: unknown[]; perSide?: boolean } }));
    const level = (p?.experience ?? 'beginner') as Level;
    result = weeklyPlan((game?.weekdays as number[] | undefined) ?? [], p?.daysPerWeek ?? 3).map(d => ({ weekday: d.weekday, split: d.split, exercises: d.split ? pickSession(d.split, lib, location, level).map(x => ({ id: x.exercise.id, name: (x.exercise as unknown as { name: string }).name, sets: x.dose.sets, target: `${x.dose.target} ${x.dose.unit}`, restSeconds: x.dose.restSeconds, perSide: x.dose.perSide })) : [] }));
  } else if (name === 'get_today_session') {
    const { location } = z.object({ location: z.enum(['home', 'gym']) }).strict().parse(args);
    result = await todaySession(userId, location);
  } else if (name === 'get_exercise_recommendations') {
    const { exerciseId, location } = z.object({ exerciseId: z.string().max(100), location: z.enum(['home', 'gym']) }).strict().parse(args);
    result = await exerciseRecommendations(userId, exerciseId, location);
  } else if (name === 'get_energy_summary') {
    z.object({}).strict().parse(args ?? {}); result = await energySummary(userId);
  } else if (name === 'get_insights') {
    z.object({}).strict().parse(args ?? {}); result = await coachInsights(userId);
  } else if (name === 'get_weekly_report') {
    z.object({}).strict().parse(args ?? {}); const r = await weeklyReport(userId); result = { ...r, narrative: undefined };
  } else if (name === 'get_nutrition_guidance') {
    z.object({}).strict().parse(args ?? {});
    const [p, m] = await Promise.all([profile(), prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } })]);
    result = { ...nutritionGuidance(m?.weightKg ?? null, (p?.goal ?? 'general_fitness') as Goal), note: 'General guidance for healthy adults; refer medical conditions, pregnancy or eating disorders to a doctor or dietitian.' };
  } else if (name === 'propose_plan') {
    const payload = planSchema.parse(args);
    const ids = [...new Set(payload.days.flatMap(day => day.exercises.map(item => item.exerciseId)))];
    if (await prisma.exercise.count({ where: { id: { in: ids } } }) !== ids.length) throw new ApiError(400, 'UNKNOWN_EXERCISE');
    const proposal = await prisma.planProposal.create({ data: { userId, payload, status: 'pending' } });
    result = { proposalId: proposal.id, status: 'pending_user_approval', savedAsActivePlan: false };
  } else throw new ApiError(400, 'UNKNOWN_TOOL');
  await prisma.agentAction.create({ data: { userId, tool: name, status: 'executed', arguments: (args ?? {}) as Prisma.InputJsonValue } });
  return result;
}

type GatewayMessage = { role: string; content?: string | null; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };
export async function chat(userId: string, text: string, locale: string, exerciseId?: string) {
  if (!gatewayConfigured()) throw new ApiError(503, 'LLM_NOT_CONFIGURED');
  const count = await prisma.aiMessage.count({ where: { role: 'user', createdAt: { gte: new Date(Date.now() - 60000) }, conversation: { userId } } });
  if (count >= 6) throw new ApiError(429, 'PLEASE_WAIT');
  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
  if (!profile?.onboarded) throw new ApiError(400, 'COMPLETE_PROFILE_FIRST');
  let conversation = await prisma.aiConversation.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  if (!conversation) conversation = await prisma.aiConversation.create({ data: { userId } });
  const exercise = exerciseId ? await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { id: true, canonicalId: true, name: true } }) : null;
  if (exerciseId && !exercise) throw new ApiError(400, 'UNKNOWN_EXERCISE');
  const previous = await prisma.aiMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: 12 });
  // Screen context is data, not instructions; grounding comes from get_exercise_details.
  const context: GatewayMessage[] = exercise ? [{ role: 'system', content: `Screen context: the user is on the Exercise Detail page of exercise id "${exercise.id}" (canonical "${exercise.canonicalId}", English name "${exercise.name}"). Call get_exercise_details for this id before answering about it.` }] : [];
  const messages:GatewayMessage[]=[{role:'system',content:coachSystemPrompt(locale)},...previous.reverse().map(message=>({role:message.role,content:message.content})),...context,{role:'user',content:text}];
  const base = process.env.LLM_BASE_URL!.replace(/\/$/, '');
  let answer = '';
  for (let turn = 0; turn < 5; turn++) {
    let response: Response;
    try {
      response = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.LLM_MODEL, messages, tools, max_tokens: 1200 }), signal: AbortSignal.timeout(60000), cache: 'no-store' });
    } catch { throw new ApiError(502, 'GATEWAY_UNAVAILABLE'); }
    if (!response.ok) throw new ApiError(502, 'GATEWAY_UNAVAILABLE');
    const body = await response.json();
    const message = body.choices?.[0]?.message as GatewayMessage | undefined;
    if (!message || (message.content != null && typeof message.content !== 'string')) throw new ApiError(502, 'GATEWAY_INVALID_RESPONSE');
    messages.push(message);
    if (!message.tool_calls?.length) { answer = message.content?.slice(0, 12000) ?? ''; break; }
    if (message.tool_calls.length > 5) throw new ApiError(502, 'TOO_MANY_TOOL_CALLS');
    for (const call of message.tool_calls) {
      let result: unknown;
      try { result = await executeTool(userId, call.function.name, JSON.parse(call.function.arguments)); }
      catch { result = { error: 'Tool arguments were invalid or action was not allowed. Correct the request.' }; }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  if (!answer) throw new ApiError(502, 'GATEWAY_INVALID_RESPONSE');
  const [, saved] = await prisma.$transaction([
    prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'user', content: text, exerciseId: exercise?.id } }),
    prisma.aiMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: answer, exerciseId: exercise?.id } }),
    prisma.aiConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } }),
  ]);
  return { answer, id: saved.id };
}
