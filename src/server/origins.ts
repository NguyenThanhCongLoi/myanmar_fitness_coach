// Exact product origins only; Modal exposes canonical and regional URLs for this app.
const MODAL_ORIGINS = ['https://avibigateway--myanmar-fitness-coach.modal.run', 'https://avibigateway--myanmar-fitness-coach.us-east.modal.run'];
export function appOrigins(baseURL = process.env.BETTER_AUTH_URL): string[] {
  if (!baseURL) return [];
  let configured: string;
  try { configured = new URL(baseURL).origin; } catch { return []; }
  return MODAL_ORIGINS.includes(configured) ? [...MODAL_ORIGINS] : [configured];
}
export function allowedAppOrigin(origin: string | null, baseURL = process.env.BETTER_AUTH_URL) {
  return origin === null || appOrigins(baseURL).includes(origin);
}
