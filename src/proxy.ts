import { NextResponse, type NextRequest } from 'next/server';

// One canonical address: Modal also serves the app on region hosts (e.g. *.us-east.modal.run).
// Sign-in cookies and the auth origin check belong to BETTER_AUTH_URL, so other *.modal.run hosts redirect there.
export function proxy(request: NextRequest) {
  const canonical = process.env.BETTER_AUTH_URL;
  if (!canonical) return NextResponse.next();
  const target = new URL(canonical);
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').toLowerCase();
  if (host && host !== target.host && host.endsWith('.modal.run')) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname + request.nextUrl.search, target.origin), 308);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
