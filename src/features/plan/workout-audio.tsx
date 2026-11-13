'use client';
import { useEffect, useState } from 'react';
import { Mic, Expand } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';

/** Device speech only: no provider call or key. User gesture enables audio. */
export function useWorkoutAudio(active: boolean) {
  const { locale } = useLanguage(), a = useTrainingLanguage().adaptive;
  const [voice, setVoice] = useState(false), [unavailable, setUnavailable] = useState(false), [error, setError] = useState(false);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { if (!active) window.speechSynthesis?.cancel(); }, [active]);
  const say = (text: string) => {
    if (!voice || !active || !window.speechSynthesis) return;
    const match = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(locale === 'my-MM' ? 'my' : 'en'));
    if (!match) { setUnavailable(true); return; }
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.voice = match; utterance.rate = .95;
    speechSynthesis.speak(utterance);
  };
  const controls = <div className="workout-audio">
    <div className="adaptive-actions"><button type="button" className="button secondary audio-btn" aria-label={a.voice} title={a.voice} aria-pressed={voice} onClick={() => { const enabled = !voice; setVoice(enabled); setUnavailable(!window.speechSynthesis || !speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith(locale === 'my-MM' ? 'my' : 'en'))); if (!enabled) speechSynthesis?.cancel(); }}><Mic size={22}/><span className="sr-only">{a.voice}</span></button>
      <button type="button" className="button secondary audio-btn" aria-label={a.fullscreen} title={a.fullscreen} onClick={() => { const player = document.querySelector('.player'); if (document.fullscreenElement) void document.exitFullscreen(); else if (player?.requestFullscreen) void player.requestFullscreen().catch(() => setError(true)); else setError(true); }}><Expand size={22}/><span className="sr-only">{a.fullscreen}</span></button></div>
    {unavailable && <small role="status">{a.unavailable}</small>}{error && <small role="status">{a.audioError}</small>}
  </div>;
  return { say, controls };
}
