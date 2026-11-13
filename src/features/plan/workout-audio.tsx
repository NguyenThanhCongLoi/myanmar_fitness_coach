'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Expand } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { localExercise } from '@/shared/client';
import { voiceStatus } from '@/shared/voice';
import { voiceLine, type VoiceKey } from '@/locales/workout-voice';
import type { Exercise } from '@/shared/types';
import { music, MusicControl } from './workout-music';

export type Cue = 'starts' | 'go' | 'side' | 'relax' | 'ready' | 'complete' | 'encourage';
const KEY: Record<Cue, VoiceKey> = { starts: 'startsIn', go: 'go', side: 'switchSide', relax: 'rest', ready: 'getReady', complete: 'done',encourage:'encourage' };
const VOICE_KEY = 'mingalar-voice';
// Clips from the owner's TTS gateway (server /api/training/tts/cue, keys stay server-side, cached on the Volume).
// Fetched ahead into blob URLs so a cue plays instantly; kept for the whole app session.
const clips = new Map<string, Promise<string | null>>();
function clip(url: string) {
  let p = clips.get(url);
  if (!p) {
    if(clips.size>=24){const key=clips.keys().next().value!;const old=clips.get(key);clips.delete(key);void old?.then(src=>{if(src)URL.revokeObjectURL(src);});}
    p = fetch(url,{signal:AbortSignal.timeout(2000)}).then(r => r.ok && (r.headers.get('content-type') ?? '').includes('audio') ? r.blob() : null).then(b => b ? URL.createObjectURL(b) : null).catch(() => null).then(src=>{if(!src)clips.delete(url);return src;}); clips.set(url, p); }
  return p;
}

/** Voice guide: the server voice (TTS_* Myanmar / TTS_EN_* English) when configured, otherwise the device speech
 *  engine (English when the device has no Burmese voice). On by default; music is ducked while a cue plays. */
export function useWorkoutAudio(active: boolean, onSettingsChange?:(open:boolean)=>void) {
  const { locale } = useLanguage(), a = useTrainingLanguage().adaptive;
  const lang = locale === 'my-MM' ? 'my' : 'en';
  const [voice, setVoice] = useState(true), [server, setServer] = useState(false), [error, setError] = useState(false);
  const activeRef = useRef(active); activeRef.current = active;
  const player = useRef<HTMLAudioElement | null>(null), seq = useRef(0);
  useEffect(() => { try { setVoice(localStorage.getItem(VOICE_KEY) !== 'off'); } catch { /* optional */ } window.speechSynthesis?.getVoices(); void voiceStatus().then(s => setServer(!!s[lang])); }, [lang]);
  const stopAll = () => { seq.current++; window.speechSynthesis?.cancel(); player.current?.pause(); music.duck(false); };
  useEffect(() => () => { stopAll(); }, []);
  useEffect(() => { stopAll(); }, [active,lang]);
  const url = (kind: Cue | 'count', id?: string, n?: number) => `/api/training/tts/cue?cachedOnly=1&kind=${kind}${id ? `&exerciseId=${encodeURIComponent(id)}` : ''}${n ? `&n=${n}` : ''}${lang === 'en' ? '&lang=en' : ''}`;
  const device = (text: string, l: 'en' | 'my') => {
    if (!window.speechSynthesis) return;
    const voices = speechSynthesis.getVoices(), v = voices.find(x => x.lang.toLowerCase().startsWith(l));
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); if (v) u.voice = v; u.lang = v?.lang ?? (l === 'my' ? 'my-MM' : 'en-US');
    music.duck(true); u.onend = u.onerror = () => { if (!speechSynthesis.speaking) music.duck(false); };
    speechSynthesis.speak(u);
  };
  const fallback = (kind: Cue | 'count', e?: Exercise, n?: number) => {
    const hasMy = lang === 'my' && (window.speechSynthesis?.getVoices() ?? []).some(v => v.lang.toLowerCase().startsWith('my'));
    const l = lang === 'my' && hasMy ? 'my' : 'en';
    const name = e ? localExercise(e, l === 'my' ? 'my-MM' : 'en').name.split('—')[0].trim() : '';
    device(kind === 'count' ? String(n) : voiceLine(l, KEY[kind], { name }), l);
  };
  const play = async (kind: Cue | 'count', e?: Exercise, n?: number) => {
    if (!voice || !activeRef.current) return;
    stopAll();
    if (!server) { fallback(kind, e, n); return; }
    const id = ++seq.current; window.speechSynthesis?.cancel();
    const src = await clip(url(kind, e?.id, n));
    if (id !== seq.current || !activeRef.current) return;
    if (!src) { fallback(kind, e, n); return; }
    const el = player.current ??= new Audio(); el.pause(); el.src = src;
    music.duck(true); el.onended = el.onerror = () => {if(id===seq.current)music.duck(false);};
    void el.play().catch(() => { if(id!==seq.current||!activeRef.current)return;music.duck(false); fallback(kind, e, n); });
  };
  /** Fetch every clip a session will need (names of its exercises, numbers, fixed cues) before it starts. */
  const prefetch = (exercises: Exercise[]) => {
    if (!server || !voice || !activeRef.current) return;
    (['go', 'side', 'relax', 'complete'] as const).forEach(k => void clip(url(k)));
    for (let n = 1; n <= 5; n++) void clip(url('count', undefined, n));
    exercises.slice(0,2).forEach(e => { void clip(url('starts', e.id)); void clip(url('ready', e.id)); });
  };
  const toggle = () => { const on = !voice; setVoice(on); try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* optional */ } if (!on) stopAll(); };
  const controls = <div className="workout-audio">
    <div className="adaptive-actions"><button type="button" className="button secondary audio-btn" aria-label={a.voice} title={a.voice} aria-pressed={voice} onClick={toggle}>{voice ? <Mic size={22}/> : <MicOff size={22}/>}<span className="sr-only">{a.voice}</span></button>
      <MusicControl onOpenChange={onSettingsChange}/>
      <button type="button" className="button secondary audio-btn" aria-label={a.fullscreen} title={a.fullscreen} onClick={() => { const p = document.querySelector('.player'); if (document.fullscreenElement) void document.exitFullscreen(); else if (p?.requestFullscreen) void p.requestFullscreen().catch(() => setError(true)); else setError(true); }}><Expand size={22}/><span className="sr-only">{a.fullscreen}</span></button></div>
    {error && <small role="status">{a.audioError}</small>}
  </div>;
  return {
    cue: (kind: Cue, e?: Exercise) => void play(kind, e),
    count: (n: number) => void play('count', undefined, n),
    prefetch, controls, voice, server,
  };
}
