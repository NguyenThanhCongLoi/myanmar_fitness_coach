import { googleConfigured } from '@/server/social-config';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ google: googleConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}
