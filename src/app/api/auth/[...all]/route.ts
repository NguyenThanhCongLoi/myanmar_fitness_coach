import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/server/auth';
import { persistDatabase } from '@/server/durability';
export const runtime = 'nodejs';
const handlers = toNextJsHandler(auth);
export async function GET(request: Request) {
  const response = await handlers.GET(request);
  // OAuth callbacks create accounts/sessions and consume state, including redirect responses.
  if (new URL(request.url).pathname.startsWith('/api/auth/callback/')) {
    try { await persistDatabase(); }
    catch { return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 }); }
  }
  return response;
}
export async function POST(request: Request) {
  const response = await handlers.POST(request);
  if (response.ok) {
    try { await persistDatabase(); }
    catch { return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 }); }
  }
  return response;
}
