import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/server/auth';
import { persistDatabase } from '@/server/durability';
export const runtime = 'nodejs';
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(request: Request) {
  const response = await handlers.POST(request);
  if (response.ok) {
    try { await persistDatabase(); }
    catch { return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 }); }
  }
  return response;
}
