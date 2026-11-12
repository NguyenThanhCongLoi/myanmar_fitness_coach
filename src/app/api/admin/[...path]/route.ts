import { requiredUser } from '@/server/auth';
import { ApiError } from '@/server/validation';
import { analyticsCsv, analyticsInsights, requireAdmin } from '@/server/analytics';
export const dynamic = 'force-dynamic';
// Internal analytics for the product owner: only emails listed in ADMIN_EMAILS (server env) can read it.
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const user = await requiredUser(request); requireAdmin(user.email);
    const key = (await context.params).path.join('/'); const q = new URL(request.url).searchParams;
    if (key === 'analytics') return Response.json(await analyticsInsights(q.get('days')), { headers: { 'Cache-Control': 'private, no-store' } });
    if (key === 'analytics.csv') return new Response(await analyticsCsv(q.get('days')), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="mingalar-fit-usage.csv"', 'Cache-Control': 'private, no-store' } });
    throw new ApiError(404, 'NOT_FOUND');
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.code }, { status: error.status });
    return Response.json({ error: 'REQUEST_FAILED' }, { status: 500 });
  }
}
