'use client';
import { useEnglishServerVoice } from '@/shared/voice';
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Music } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';
import { doseFor, type Level } from '@/shared/dose';
import { localExercise } from '@/shared/client';

export type Cue = { kind: 'next'; exercise: Exercise; level: Level } | { kind: 'motivate'; n: number } | { kind: 'done' | 'rest' | 'finish' | 'pr' };
const pref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* optional */ } };

// ---------- Original procedural background music (WebAudio; no third-party tracks) ----------
type Style = 'off' | 'calm' | 'focus' | 'energy';
const STYLES: Record<Exclude<Style, 'off'>, { bpm: number; kick: number[]; hat: number[]; snare: number[]; chords: number[][] }> = {
  calm: { bpm: 84, kick: [0], hat: [2, 6], snare: [], chords: [[220, 277, 330], [196, 247, 294], [174.6, 220, 262], [196, 247, 294]] },
  focus: { bpm: 92, kick: [0, 3], hat: [2, 6], snare: [4], chords: [[220, 262, 330], [174.6, 220, 262], [196, 247, 294], [164.8, 208, 247]] },
  energy: { bpm: 124, kick: [0, 2, 4, 6], hat: [1, 3, 5, 7], snare: [2, 6], chords: [[220, 277, 330], [247, 311, 370], [196, 247, 294], [220, 277, 330]] },
};
class BeatEngine {
  ctx: AudioContext | null = null; master: GainNode | null = null; timer: ReturnType<typeof setInterval> | null = null; step = 0; next = 0; style: Exclude<Style, 'off'> = 'calm'; volume = 0.35;
  start(style: Exclude<Style, 'off'>) {
    this.style = style;
    if (!this.ctx) { const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; this.ctx = new C(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
    void this.ctx.resume(); this.master!.gain.value = this.volume; this.next = this.ctx.currentTime + 0.05; this.step = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 50);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; void this.ctx?.suspend(); }
  duck(on: boolean) { if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? this.volume * 0.25 : this.volume, this.ctx.currentTime, 0.15); }
  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number) {
    const o = this.ctx!.createOscillator(), g = this.ctx!.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(t: number, dur: number, gain: number, hp: number) {
    const b = this.ctx!.createBuffer(1, Math.ceil(this.ctx!.sampleRate * dur), this.ctx!.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx!.createBufferSource(), f = this.ctx!.createBiquadFilter(), g = this.ctx!.createGain(); s.buffer = b; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(this.master!); s.start(t);
  }
  private schedule() {
    const p = STYLES[this.style], stepDur = 60 / p.bpm / 2;
    while (this.next < this.ctx!.currentTime + 0.2) {
      const s = this.step % 8, bar = Math.floor(this.step / 8) % p.chords.length, t = this.next;
      if (p.kick.includes(s)) { this.tone(110, t, 0.25, 'sine', 0.6); this.tone(55, t, 0.3, 'sine', 0.5); }
      if (p.hat.includes(s)) this.noise(t, 0.05, 0.12, 7000);
      if (p.snare.includes(s)) this.noise(t, 0.15, 0.2, 1500);
      if (s === 0) p.chords[bar].forEach(f => this.tone(f, t, stepDur * 8, 'triangle', 0.05));
      if (this.style === 'energy' && s % 2 === 1) this.tone(p.chords[bar][0] / 2, t, stepDur * 0.9, 'sawtooth', 0.04);
      this.next += stepDur; this.step++;
    }
  }
}

// Voice + music companion shared by Follow Along and Free Workout.
export function usePtCompanion() {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [voiceOn, setVoiceOn] = useState(true); const [style, setStyle] = useState<Style>('off');
  const engine = useRef<BeatEngine | null>(null); const audio = useRef<HTMLAudioElement | null>(null); const cache = useRef(new Map<string, string>());
  useEffect(() => { setVoiceOn(pref('mingalar-voice-coach', 'on') === 'on'); setStyle(pref('mingalar-music', 'off') as Style); }, []);
  useEffect(() => { if (style === 'off') engine.current?.stop(); else { engine.current ??= new BeatEngine(); engine.current.start(style); } return () => engine.current?.stop(); }, [style]);
  const enVoice = useEnglishServerVoice(); const serverVoice = locale === 'my-MM' || enVoice;
  const lang = locale === 'en' ? '&lang=en' : '';
  const url = (c: Cue) => (c.kind === 'next' ? `/api/training/tts/cue?kind=next&exerciseId=${encodeURIComponent(c.exercise.id)}` : c.kind === 'motivate' ? `/api/training/tts/cue?kind=motivate&n=${c.n % 8}` : `/api/training/tts/cue?kind=${c.kind}`) + lang;
  const englishText = (c: Cue) => {
    if (c.kind === 'next') { const d = doseFor({ tracking: c.exercise.tracking, equipment: c.exercise.equipment, tags: c.exercise.tags }, c.level, !!c.exercise.guidance?.perSide);
      return fill(tt.cueNext, { name: localExercise(c.exercise, 'en').name, muscles: (c.exercise.primaryMuscles ?? []).map(m => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m).join(', '), dose: fill(d.unit === 'reps' ? tt.doseReps : tt.doseSeconds, { sets: d.sets, target: d.target }) }); }
    return c.kind === 'motivate' ? tt.motivation[(c.n % 8) as unknown as keyof typeof tt.motivation] : c.kind === 'done' ? tt.cueDone : c.kind === 'rest' ? tt.cueRest : c.kind === 'pr' ? tt.cuePr : tt.cueFinish;
  };
  async function blobFor(c: Cue) {
    const key = url(c); const hit = cache.current.get(key); if (hit) return hit;
    const r = await fetch(key); if (!r.ok) throw new Error('voice');
    const obj = URL.createObjectURL(await r.blob()); cache.current.set(key, obj); return obj;
  }
  // Prefetch so the cue plays instantly when the moment arrives (server TTS can take several seconds).
  const prefetch = (c: Cue) => { if (voiceOn && serverVoice) void blobFor(c).catch(() => {}); };
  async function say(c: Cue) {
    if (!voiceOn) return;
    audio.current?.pause(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    engine.current?.duck(true);
    const done = () => engine.current?.duck(false);
    if (!serverVoice) {
      if (typeof speechSynthesis === 'undefined') return done();
      const u = new SpeechSynthesisUtterance(englishText(c)); u.lang = 'en-US'; u.onend = done; u.onerror = done; speechSynthesis.speak(u); return;
    }
    try { const a = new Audio(await blobFor(c)); audio.current = a; a.onended = done; a.onerror = done; await a.play(); } catch { done(); }
  }
  const bar = <div className="companion-bar">
    <button type="button" className={`chip-toggle ${voiceOn ? 'on' : ''}`} aria-pressed={voiceOn} onClick={() => { const v = !voiceOn; setVoiceOn(v); save('mingalar-voice-coach', v ? 'on' : 'off'); }}>{voiceOn ? <Mic size={15}/> : <MicOff size={15}/>}{tt.voiceCoach}</button>
    <label className="music-select"><Music size={15}/><span className="sr-only">{tt.music}</span>
      <select aria-label={tt.music} value={style} onChange={e => { const v = e.target.value as Style; setStyle(v); save('mingalar-music', v); }}>{(['off', 'calm', 'focus', 'energy'] as const).map(s => <option key={s} value={s}>{tt.music}: {tt.musicStyles[s]}</option>)}</select></label>
  </div>;
  return { say, prefetch, bar, voiceOn };
}
