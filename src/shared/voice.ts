'use client';
import { useEffect, useState } from 'react';
// Which server voices are configured: my = Myanmar gateway, en = English gateway. English falls back to the browser voice when not configured.
let pending: Promise<{ my: boolean; en: boolean }> | null = null;
export function voiceStatus() {
  pending ??= fetch('/api/training/tts/status', { cache: 'no-store' }).then(r => r.ok ? r.json() : { my: false, en: false }).catch(() => ({ my: false, en: false }));
  return pending;
}
export function useEnglishServerVoice() {
  const [on, setOn] = useState(false);
  useEffect(() => { void voiceStatus().then(s => setOn(!!s.en)); }, []);
  return on;
}
