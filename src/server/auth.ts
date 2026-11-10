// Better Auth/Prisma integration adapted from Workout.cool (MIT; licenses/).
// Use Better Auth's password hashing and exact origins instead of upstream's custom hash/wildcard.
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { headers } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import { ApiError } from './validation';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 30 },
});

export async function requiredUser(request?: Request) {
  const session = await auth.api.getSession({ headers: request?.headers ?? await headers() });
  if (!session?.user) throw new ApiError(401, 'UNAUTHORIZED');
  return session.user;
}
