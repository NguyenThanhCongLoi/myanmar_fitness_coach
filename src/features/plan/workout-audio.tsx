'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Music, Expand } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';

/** Device speech only: no provider call or key. User gesture enables audio. */
export function useWorkoutAudio(active: boolean) {
  const { locale } = useLanguage(), a = useTrainingLanguage().adaptive;
  const [voice, setVoice] = useState(false), [music, setMusic] = useState(false), [unavailable, setUnavailable] = useState(false), [error, setError] = useState(false);
  const track = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { const audio = new Audio('/audio/carefree.mp3'); audio.loop = true; audio.volume = .18; track.current = audio; return () => { audio.pause(); track.current = null; window.speechSynthesis?.cancel(); }; }, []);
  useEffect(() => { if (!active) { track.current?.pause(); window.speechSynthesis?.cancel(); } else if (music) void track.current?.play().catch(() => setError(true)); }, [active, music]);
  const say = (text: string) => {
    if (!voice || !active || !window.speechSynthesis) return;
    const match = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(locale === 'my-MM' ? 'my' : 'en'));
    if (!match) { setUnavailable(true); return; }
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.voice = match; utterance.rate = .95;
    if (track.current) track.current.volume = .04;
    const restore = () => { if (track.current) track.current.volume = .18; };
    utterance.onend = restore; utterance.onerror = restore; speechSynthesis.speak(utterance);
  };
  const controls = <div className="workout-audio">
    <div className="adaptive-actions"><button type="button" className="button secondary" aria-pressed={voice} onClick={() => { const enabled = !voice; setVoice(enabled); setUnavailable(!window.speechSynthesis || !speechSynthesis.getVoices().some(v => v.lang.toLowerCase().startsWith(locale === 'my-MM' ? 'my' : 'en'))); if (!enabled) speechSynthesis?.cancel(); }}><Mic size={22}/>{a.voice}</button>
      <button type="button" className="button secondary" aria-pressed={music} onClick={async () => { if (music) { track.current?.pause(); setMusic(false); } else { try { await track.current?.play(); setMusic(true); setError(false); } catch { setError(true); } } }}><Music size={22}/>{a.music}: {music ? a.track : a.off}</button>
      <button type="button" className="button secondary" onClick={() => { const player = document.querySelector('.player'); if (document.fullscreenElement) void document.exitFullscreen(); else if (player?.requestFullscreen) void player.requestFullscreen().catch(() => setError(true)); else setError(true); }}><Expand size={22}/>{a.fullscreen}</button></div>
    {unavailable && <small role="status">{a.unavailable}</small>}{error && <small role="status">{a.audioError}</small>}
    {music && <small><a href="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037" target="_blank" rel="noreferrer">Carefree — Kevin MacLeod (incompetech.com)</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small>}
  </div>;
  return { say, controls };
}
