export class RequestError extends Error { constructor(public code: string, public status: number, public details?: Record<string, unknown>) { super(code); } }
// Offline-tolerant set logging: if the network drops, the set is queued locally and re-sent when back online.
// Set logging is idempotent on (session, exercise, setIndex), so a retry can never duplicate a set.
const QUEUE = 'mingalar-offline-sets';
function queued(): { path: string; data: unknown }[] { try { return JSON.parse(localStorage.getItem(QUEUE) ?? '[]'); } catch { return []; } }
export async function flushOfflineSets() {
  const items = queued(); if (!items.length) return 0;
  const left: typeof items = [];
  for (const it of items) { try { await api(it.path, it.data); } catch (e) { if (!(e instanceof RequestError)) left.push(it); } }
  try { localStorage.setItem(QUEUE, JSON.stringify(left)); } catch { /* optional */ }
  return items.length - left.length;
}
if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushOfflineSets(); });
export async function api<T>(path: string, data?: unknown): Promise<T> {
  if (data !== undefined && /^sessions\/[^/]+\/sets$/.test(path) && typeof navigator !== 'undefined' && !navigator.onLine) {
    try { localStorage.setItem(QUEUE, JSON.stringify([...queued(), { path, data }])); } catch { /* optional */ }
    throw new RequestError('SAVED_OFFLINE', 0);
  }
  const response = await fetch('/api/fitness/' + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new RequestError(body.error ?? 'REQUEST_FAILED', response.status);
  return body;
}
export function localExercise(exercise: import('./types').Exercise, locale: string) {
  const translation = exercise.translations.find(item => item.locale === locale);
  return { name: translation?.name ?? exercise.name, instructions: translation?.instructions ?? exercise.instructions };
}
export function weightValue(kg: number, unit: string) { return unit === 'lb' ? kg / 0.45359237 : kg; }
// The exercise library is static per deployment: fetch it once per page session and share it.
const memo = new Map<string, Promise<unknown>>();
export async function trainingApi<T>(path: string, data?: unknown): Promise<T> {
  if (data === undefined && path === 'exercises') {
    if (!memo.has(path)) memo.set(path, trainingRequest<T>(path).catch(e => { memo.delete(path); throw e; }));
    return memo.get(path) as Promise<T>;
  }
  return trainingRequest<T>(path, data);
}
async function trainingRequest<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch('/api/training/' + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(body.error ?? 'REQUEST_FAILED', response.status, body.details);
  return body;
}
export function actionId() { return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, ''); }
