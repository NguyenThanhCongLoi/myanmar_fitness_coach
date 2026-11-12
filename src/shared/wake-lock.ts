'use client';
import { useEffect } from 'react';
// Keep the screen on during an active workout (Screen Wake Lock API); silently unsupported elsewhere.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null; let cancelled = false;
    const request = async () => { try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen'); if (cancelled) void lock.release(); } catch { /* denied or unsupported */ } };
    void request();
    const again = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', again);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', again); void lock?.release().catch(() => {}); };
  }, [active]);
}
export const buzz = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* optional */ } };
