'use client';
import { mascotManifest } from '@/features/gamification/mascot-manifest';
import { trainingApi } from './client';
// After the first screen is up, quietly load what the next screens need (when the browser is idle; skipped on Save-Data/low-data).
export function warmApp() {
  if (typeof window === 'undefined') return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let lowData = false; try { lowData = localStorage.getItem('mingalar-lowdata') === 'on'; } catch { /* optional */ }
  if (conn?.saveData || lowData) return;
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? (window as Window & { requestIdleCallback: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500));
  idle(() => {
    void trainingApi('exercises').catch(() => {});
    // Mascot expressions used across pages and celebrations (cached by the service worker afterwards).
    for (const a of Object.values(mascotManifest)) { const img = new Image(); img.decoding = 'async'; img.src = a.kind === 'image' ? a.srcSmall : a.src; }
  });
}
