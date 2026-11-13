import { z } from 'zod';
import { allowedAppOrigin } from '@/server/origins';
import { prisma } from '@/shared/lib/prisma';
import { requiredUser } from '@/server/auth';
import { trackAppOpen, trackRoute } from '@/server/analytics';
import { persistDatabase } from '@/server/durability';
import { ApiError, toKg } from '@/server/validation';
import { approveProposal, createPlan, dashboard, exerciseList, finishSession, getSession, logSet, plansForUser, saveProfile, sessionInclude, startSession } from '@/server/services';
import { chat, gatewayConfigured } from '@/server/agent';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const write = request.method !== 'GET';
  let authenticated = false;
  try {
    if (write) {
      const origin = request.headers.get('origin');
      if (!allowedAppOrigin(origin)) throw new ApiError(403, 'INVALID_ORIGIN');
      if (Number(request.headers.get('content-length') ?? 0) > 65536) throw new ApiError(413, 'REQUEST_TOO_LARGE');
    }
    const user = await requiredUser(request);
    authenticated = true;
    const path = (await context.params).path;
    const route = path.join('/');
    const url = new URL(request.url);
    let body: unknown;
    if (write) {
      const raw = await request.text();
      if (raw.length > 65536) throw new ApiError(413, 'REQUEST_TOO_LARGE');
      try { body = JSON.parse(raw || '{}'); } catch { throw new ApiError(400, 'INVALID_INPUT'); }
    }
    let result: unknown;
    if (!write && route === 'bootstrap') result = { user: { id: user.id, name: user.name, email: user.email }, ...await dashboard(user.id), gatewayConfigured: gatewayConfigured() };
    else if (!write && route === 'exercises') result = await exerciseList((url.searchParams.get('q') ?? '').slice(0, 100));
    else if (!write && route === 'plans') result = await plansForUser(user.id);
    else if (request.method === 'POST' && route === 'profile') result = await saveProfile(user.id, body);
    else if (request.method === 'POST' && route === 'preferences') {
      const input = z.object({ locale: z.enum(['my-MM', 'en']) }).strict().parse(body);
      result = await prisma.fitnessProfile.updateMany({ where: { userId: user.id }, data: input });
    }
    else if (request.method === 'POST' && route === 'plans') result = await createPlan(user.id, body);
    else if (!write && route === 'history') result = await prisma.workoutSession.findMany({ where: { userId: user.id }, include: sessionInclude, orderBy: { startedAt: 'desc' }, take: 100 });
    else if (request.method === 'POST' && route === 'sessions') result = await startSession(user.id, z.object({ dayId: z.string().min(1) }).strict().parse(body).dayId);
    else if (!write && path[0] === 'sessions' && path.length === 2) result = await getSession(user.id, path[1]);
    else if (request.method === 'POST' && path[0] === 'sessions' && path[2] === 'sets' && path.length === 3) result = await logSet(user.id, path[1], body);
    else if (request.method === 'POST' && path[0] === 'sessions' && path[2] === 'finish' && path.length === 3) result = await finishSession(user.id, path[1], z.object({ note: z.string().max(1000).default('') }).strict().parse(body).note);
    else if (request.method === 'POST' && route === 'measurements') {
      const input = z.object({ weight: z.number().positive().max(700), unit: z.enum(['kg', 'lb']), waistCm: z.number().min(40).max(200).nullable().optional() }).strict().parse(body);
      const weightKg = toKg(input.weight, input.unit);
      if (weightKg < 20 || weightKg > 350) throw new ApiError(400, 'INVALID_INPUT');
      result = await prisma.bodyMeasurement.create({ data: { userId: user.id, weightKg, waistCm: input.waistCm ?? null } });
    } else if (!write && route === 'coach') {
      const exerciseId = url.searchParams.get('exerciseId')?.slice(0, 100) || undefined;
      const conversation = await prisma.aiConversation.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, include: { messages: { where: exerciseId ? { exerciseId } : {}, orderBy: { createdAt: 'desc' }, take: exerciseId ? 20 : 50 } } });
      if (conversation) conversation.messages.reverse();
      result = { configured: gatewayConfigured(), messages: conversation?.messages ?? [], proposals: await prisma.planProposal.findMany({ where: { userId: user.id, status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 10 }), memories: await prisma.aiMemory.findMany({ where: { userId: user.id, key: { in: ['user_note', 'injuries', 'preferences', 'schedule'] } }, take: 10 }) };
    } else if (request.method === 'POST' && route === 'coach/chat') {
      const input = z.object({ message: z.string().trim().min(1).max(2000), locale: z.enum(['my-MM', 'en']), exerciseId: z.string().max(100).optional() }).strict().parse(body);
      result = await chat(user.id, input.message.normalize('NFC'), input.locale, input.exerciseId);
    } else if (request.method === 'POST' && path[0] === 'proposals' && path[2] === 'approve' && path.length === 3) {
      z.object({ confirm: z.literal(true) }).strict().parse(body);
      result = await approveProposal(user.id, path[1]);
    } else if (request.method === 'POST' && route === 'coach/memory') {
      // Long-term coach memory the user writes and can edit at any time; the AI reads it via get_user_profile.
      const { content, key } = z.object({ content: z.string().trim().max(500), key: z.enum(['user_note', 'injuries', 'preferences', 'schedule']).default('user_note') }).strict().parse(body);
      result = content ? await prisma.aiMemory.upsert({ where: { userId_key: { userId: user.id, key } }, create: { userId: user.id, key, content: content.normalize('NFC') }, update: { content: content.normalize('NFC') } }) : await prisma.aiMemory.deleteMany({ where: { userId: user.id, key } });
    } else throw new ApiError(404, 'NOT_FOUND');
    if (write) await trackRoute(user.id, 'fitness', path, request);
    else if (route === 'bootstrap') await trackAppOpen(user.id, request);
    if (write||route==='bootstrap') await persistDatabase();
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    // A gateway/tool error may follow a durable proposal write; commit before exposing the result.
    if (write && authenticated) { try { await persistDatabase(); } catch { return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 }); } }
    if (error instanceof ApiError) return Response.json({ error: error.code }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
    return Response.json({ error: 'REQUEST_FAILED' }, { status: 500 });
  }
}
export const GET = handler;
export const POST = handler;
