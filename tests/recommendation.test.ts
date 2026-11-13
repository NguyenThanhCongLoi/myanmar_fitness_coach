import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { recommendTrainingFocus, analyzeRecentMuscleLoad, saveFeedback } from '../src/server/recommendation';
import { previewRoutine } from '../src/server/training';
import { executeTool } from '../src/server/agent';
import { civilDay, weekday } from '../src/server/streak';
import { todaySession } from '../src/server/pt';
import { updateSchedule } from '../src/server/gamification';
// Synthetic test fixtures only (clearly labeled users with the test prefix); never production data.
const prefix = `reco-${Date.now()}`;
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } }); await prisma.$disconnect(); });
const now = new Date();
const todayIndex = weekday(civilDay(now, 'Asia/Yangon'));
async function user(suffix: string, opts: { equipment?: string[]; experience?: string; restToday?: boolean } = {}) {
  const id = prefix + suffix;
  await prisma.user.create({ data: { id, name: 'Test', email: id + '@example.test', profile: { create: { equipment: opts.equipment ?? ['body weight'], experience: opts.experience ?? 'intermediate', onboarded: true, daysPerWeek: 3 } } } });
  const days = opts.restToday ? [0, 1, 2, 3, 4, 5, 6].filter(d => d !== todayIndex).slice(0, 3) : [todayIndex];
  await prisma.gameState.create({ data: { userId: id, timezone: 'Asia/Yangon', weekdays: days, weeklyGoal: 3, cursor: civilDay(now, 'Asia/Yangon') } });
  return id;
}
async function trained(userId: string, canonicalIds: string[], hoursAgo: number, setsEach = 3) {
  const exercises = await prisma.exercise.findMany({ where: { canonicalId: { in: canonicalIds } } });
  const ended = new Date(now.getTime() - hoursAgo * 3600000);
  const plan = await prisma.workoutPlan.create({ data: { userId, name: 'fixture', goal: 'free', status: 'session_template', days: { create: { name: 'd', weekday: 0, order: 0 } } }, include: { days: true } });
  return prisma.workoutSession.create({ data: { userId, planId: plan.id, dayId: plan.days[0].id, status: 'completed', startedAt: new Date(ended.getTime() - 1800000), endedAt: ended,
    sets: { create: exercises.flatMap(e => Array.from({ length: setsEach }, (_, i) => ({ exerciseId: e.id, setIndex: i, reps: 10, weightKg: 0 }))) } } });
}

test('new user without history gets the reviewed beginner template, not invented history', async () => {
  const id = await user('new');
  const r = await recommendTrainingFocus(id, { location: 'home' }, now);
  expect(r.newUser).toBe(true); expect(r.focus).toBe('all'); expect(r.difficulty).toBe('beginner');
  expect(r.reasons[0].code).toBe('NEW_USER_TEMPLATE');
});

test('trained core yesterday -> core deprioritized; compound exercises count for every muscle', async () => {
  const id = await user('core');
  await trained(id, ['dead-bug', 'forearm-plank', 'side-plank'], 20);
  const load = await analyzeRecentMuscleLoad(id, now);
  expect(load.groupLoad.core).toBeGreaterThan(0);
  const r = await recommendTrainingFocus(id, { location: 'home' }, now);
  expect(r.kind).toBe('train'); expect(r.focus).not.toBe('core');
  expect(r.reasons.some(x => x.code === 'DEPRIORITIZED_RECENT_LOAD' && x.group === 'core')).toBe(true);
  // A compound (lunge) loads quads + glutes primary and hamstrings secondary.
  const id2 = await user('compound');
  await trained(id2, ['forward-lunge'], 10, 1);
  const l2 = await analyzeRecentMuscleLoad(id2, now);
  const m = Object.fromEntries(l2.muscles.map(x => [x.muscle, x.load]));
  expect(m.quadriceps).toBeGreaterThan(0); expect(m.gluteal).toBeGreaterThan(0); expect(m.hamstring).toBeGreaterThan(0); expect(m.hamstring).toBeLessThan(m.quadriceps);
});

test('high recent leg workload -> legs not recommended; new workout data changes the recommendation', async () => {
  const id = await user('legs');
  await trained(id, ['bodyweight-squat', 'forward-lunge', 'glute-bridge', 'standing-calf-raise'], 12, 4);
  const first = await recommendTrainingFocus(id, { location: 'home' }, now);
  expect(first.focus).not.toBe('legs');
  const firstFocus = first.focus;
  await trained(id, firstFocus === 'core' ? ['dead-bug', 'forearm-plank', 'side-plank', 'bird-dog'] : firstFocus === 'push' ? ['push-up', 'knee-push-up', 'wall-push-up'] : ['band-row', 'dumbbell-bent-over-row', 'dumbbell-biceps-curl'], 2, 4);
  const second = await recommendTrainingFocus(id, { location: 'home' }, now);
  expect(second.focus).not.toBe(firstFocus); expect(second.focus).not.toBe('legs');
});

test('home without equipment and switching home -> gym change the eligible exercises', async () => {
  const id = await user('home', { equipment: ['body weight'] });
  const base = { seconds: 900, focus: 'all', difficulty: 'intermediate', avoid: [], excludedIds: [], reviewedConstraints: true };
  const home = await previewRoutine(id, { ...base, equipment: ['body weight'], location: 'home' });
  const homeIds = home.phases.filter(p => p.exerciseId).map(p => p.exerciseId!);
  const rows = await prisma.exercise.findMany({ where: { id: { in: homeIds } } });
  expect(rows.every(e => (e.equipment as string[]).every(q => q === 'body weight'))).toBe(true);
  // At the gym the user may select gym equipment even though the profile is bodyweight-only.
  const gym = await previewRoutine(id, { ...base, equipment: ['body weight', 'dumbbell', 'barbell', 'bench', 'cable'], location: 'gym' });
  const gymRows = await prisma.exercise.findMany({ where: { id: { in: gym.phases.filter(p => p.exerciseId).map(p => p.exerciseId!) } } });
  const main = gymRows.filter(e => !((e.tags as string[]) ?? []).some(t => t === 'warmup' || t === 'cooldown'));
  expect(main.length).toBeGreaterThan(0);
  expect(main.every(e => (e.equipment as string[]).some(q=>['dumbbell','barbell','bench','cable','machine','band'].includes(q)))).toBe(true);
  await expect(previewRoutine(id, { ...base, equipment: ['barbell'], location: 'home' })).rejects.toMatchObject({ code: 'EQUIPMENT_UNAVAILABLE' });
});

test('scheduled rest day -> recovery recommendation; pain/too-hard feedback only lowers intensity', async () => {
  const rest = await user('rest', { restToday: true });
  await trained(rest, ['push-up'], 30, 2);
  const r = await recommendTrainingFocus(rest, { location: 'home' }, now);
  expect(r.kind).toBe('recovery'); expect(r.reasons[0].code).toBe('PLANNED_REST_DAY');
  const id = await user('feedback', { experience: 'advanced' });
  const s = await trained(id, ['push-up'], 26, 2);
  await saveFeedback(id, s.id, { difficulty: 'too_easy', nextPreference: 'harder' });
  expect((await recommendTrainingFocus(id, { location: 'home' }, now)).difficulty).toBe('advanced'); // never above profile
  await saveFeedback(id, s.id, { difficulty: 'too_hard', soreMuscles: ['chest'], nextPreference: 'easier' });
  const lowered = await recommendTrainingFocus(id, { location: 'home' }, now);
  expect(lowered.difficulty).toBe('intermediate');
  expect(lowered.reasons.some(x => x.code === 'SORENESS_REPORTED')).toBe(true);
  await saveFeedback(id, s.id, { difficulty: 'right', pain: true, limitation: 'ပခုံး နာသည်' });
  expect((await recommendTrainingFocus(id, { location: 'home' }, now)).kind).toBe('recovery');
  const other = await user('feedback-other');
  await expect(saveFeedback(other, s.id, { difficulty: 'right' })).rejects.toMatchObject({ status: 404 });
});

test('coach tools are grounded in real IDs, owner-scoped and never write plans directly', async () => {
  const a = await user('tools-a'), b = await user('tools-b');
  await trained(a, ['push-up'], 5, 2);
  const pushUp = (await prisma.exercise.findUniqueOrThrow({ where: { canonicalId: 'push-up' } })).id;
  const details = await executeTool(a, 'get_exercise_details', { exerciseId: pushUp }) as { primaryMuscles: string[] };
  expect(details.primaryMuscles).toContain('chest');
  expect(await executeTool(a, 'get_exercise_details', { exerciseId: 'invented-exercise' })).toEqual({ error: 'UNKNOWN_EXERCISE' });
  const easier = await executeTool(a, 'find_exercise_alternatives', { exerciseId: pushUp, direction: 'easier' }) as { id: string; difficulty: string }[];
  expect(easier.length).toBeGreaterThan(0); expect(easier.every(e => e.difficulty === 'beginner')).toBe(true);
  const ids = new Set((await prisma.exercise.findMany({ select: { id: true } })).map(e => e.id));
  expect(easier.every(e => ids.has(e.id))).toBe(true);
  expect((await executeTool(b, 'get_training_history', {}) as unknown[]).length).toBe(0);
  expect((await executeTool(a, 'get_training_history', { exerciseId: pushUp }) as unknown[]).length).toBe(1);
  const draft = await executeTool(a, 'validate_workout_draft', { exercises: [{ exerciseId: pushUp, sets: 3, reps: 10, restSeconds: 60 }, { exerciseId: pushUp, sets: 9, reps: 10, restSeconds: 60 }, { exerciseId: 'nope', sets: 3, reps: 10, restSeconds: 60 }] }) as { valid: boolean; problems: string[] };
  expect(draft.valid).toBe(false); expect(draft.problems).toEqual(expect.arrayContaining([`DUPLICATE:${pushUp}`, `OUT_OF_RANGE:${pushUp}`, 'UNKNOWN_EXERCISE:nope']));
  const fits = await executeTool(a, 'preview_follow_along', { minutes: 10, focus: 'core', location: 'home' }) as { fits: boolean; totalSeconds: number };
  expect(fits.fits).toBe(true); expect(fits.totalSeconds).toBeLessThanOrEqual(600);
  const tooShort = await executeTool(a, 'preview_follow_along', { minutes: 1, focus: 'all', location: 'home' }) as { fits: boolean; reason: string };
  expect(tooShort).toMatchObject({ fits: false, reason: 'BUDGET_TOO_SHORT' });
  const plans = await prisma.workoutPlan.count({ where: { userId: a, status: 'active' } });
  await executeTool(a, 'propose_plan', { name: 'Plan', goal: 'Strength', weeks: 1, days: [{ name: 'D1', week: 1, weekday: 0, exercises: [{ exerciseId: pushUp, sets: 3, reps: 8, restSeconds: 90, targetKg: 0 }] }] });
  expect(await prisma.workoutPlan.count({ where: { userId: a, status: 'active' } })).toBe(plans);
  await expect(executeTool(a, 'run_sql', { q: 'select 1' })).rejects.toMatchObject({ code: 'UNKNOWN_TOOL' });
});

test('PT today: training day gives a planned session from real exercises; planned rest day gives recovery', async () => {
  const id = await user('pt');
  const t = await todaySession(id, 'gym', now);
  expect(t.recovery).toBe(false); expect(t.split).toBeTruthy(); expect(t.exercises.length).toBeGreaterThan(0);
  const ids = new Set((await prisma.exercise.findMany({ select: { id: true } })).map(e => e.id));
  for (const x of t.exercises) expect(ids.has(x.id)).toBe(true);
  const rest = await user('pt-rest', { restToday: true });
  const r = await todaySession(rest, 'home', now);
  expect(r.recovery).toBe(true); expect(r.exercises).toHaveLength(0); expect(r.canTrainAnyway).toBe(true); expect(r.scheduleChosen).toBe(false);
  // The user can still choose to train on a rest day: a real, lighter session.
  const a = await todaySession(rest, 'home', now, true);
  expect(a.recovery).toBe(false); expect(a.anyway).toBe(true); expect(a.split).toBeTruthy(); expect(a.exercises.length).toBeGreaterThan(0);
});

test('training days are user-chosen: schedule update marks chosen, clamps goal, syncs days per week', async () => {
  const id = await user('sched');
  const s = await updateSchedule(id, { weekdays: [5, 1] }, now);
  expect(s.weekdays).toEqual([1, 5]); expect(s.scheduleChosen).toBe(true); expect(s.weeklyGoal).toBe(2);
  expect((await prisma.fitnessProfile.findUnique({ where: { userId: id } }))?.daysPerWeek).toBe(2);
  await expect(updateSchedule(id, { weekdays: [] }, now)).rejects.toThrow();
  await expect(updateSchedule(id, { weekdays: [1, 1] }, now)).rejects.toThrow();
});
