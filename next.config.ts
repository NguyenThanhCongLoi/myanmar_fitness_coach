import type { NextConfig } from 'next';
const config: NextConfig = { reactStrictMode: true, poweredByHeader: false, serverExternalPackages: ['@prisma/client'] };
export default config;
