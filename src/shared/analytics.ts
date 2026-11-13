'use client';
// Batched, fire-and-forget usage events (names only; no personal text). Server drops them if the user opted out.
type Ev = { name: 'screen_view' | 'screen_time' | 'app_rating' | 'workout_quit' | 'exercise_opened' | 'voice_play' | 'theme_changed' | 'share_clicked' | 'photo_added' | 'language_switched'; screen?: string; props?: Record<string, string | number | boolean> };
let queue: Ev[] = []; let timer: ReturnType<typeof setTimeout> | null = null;
// Only signed-in users send events (signed-out calls would 401 and fill the console).
let signedIn = false;
export function setAnalyticsSignedIn(on: boolean) { signedIn = on; if (!on) queue = []; else if (queue.length) timer ??= setTimeout(flush, 1000); }
function flush() {
  timer = null; if (!queue.length || !signedIn) return;
  const events = queue.splice(0, 20);
  void fetch('/api/training/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }), keepalive: true }).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 1000);
}
export function track(ev: Ev) {
  if (typeof window === 'undefined') return;
  queue.push(ev); if (queue.length >= 20 || document.visibilityState === 'hidden') flush(); else timer ??= setTimeout(flush, 8000);
}
if (typeof window !== 'undefined') addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
