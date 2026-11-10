import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { googleConfigured } from '../src/server/social-config';
beforeAll(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-only.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-only-not-valid-at-google');
});
afterAll(async () => { vi.unstubAllEnvs(); await prisma.$disconnect(); });
test('Google authorization uses state, PKCE and the application callback without exchanging tokens', async () => {
  expect(googleConfigured()).toBe(true);
  const { auth } = await import('../src/server/auth');
  const response = await auth.handler(new Request('http://localhost:3000/api/auth/sign-in/social', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ provider: 'google', callbackURL: '/', errorCallbackURL: '/?authError=1', disableRedirect: true }),
  }));
  expect(response.status).toBe(200);
  const url = new URL((await response.json()).url);
  expect(url.hostname).toBe('accounts.google.com');
  expect(url.searchParams.get('client_id')).toBe('test-only.apps.googleusercontent.com');
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/google');
  expect(url.searchParams.get('state')).toBeTruthy();
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('prompt')).toBe('select_account');
  const before = await prisma.user.count();
  const invalid = await auth.handler(new Request('http://localhost:3000/api/auth/callback/google?state=invalid&code=invalid'));
  expect(invalid.status).toBeGreaterThanOrEqual(300);
  expect(await prisma.user.count()).toBe(before);
});
test('missing Google credentials keeps the provider unavailable', () => {
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  expect(googleConfigured()).toBe(false);
});
