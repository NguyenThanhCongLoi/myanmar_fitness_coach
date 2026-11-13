import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true, poweredByHeader: false, serverExternalPackages: ['@prisma/client'],
  // Bundled workout music never changes under the same name: cache it so the second workout starts instantly.
  async headers() { return [{source:'/media/:file*',headers:[{key:'Cache-Control',value:'public, max-age=3600, must-revalidate'}]},{ source: '/audio/music/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }] }]; },
};
export default config;
