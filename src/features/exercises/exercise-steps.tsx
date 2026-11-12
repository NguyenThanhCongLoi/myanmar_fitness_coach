'use client';
import { useEnglishServerVoice } from '@/shared/voice';
import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import type { Exercise } from '@/shared/types';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { BeeAvatar } from '../gamification/mascot';

export type ExerciseStep = { en: string; my: string | null; image: string | null; credit: string | null };

// Coach voice: Myanmar uses the server TTS gateway (cached audio); English uses the device's speech engine.
export function useCoachVoice(exerciseId: string) {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<number | 'all' | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const stop = () => { audio.current?.pause(); audio.current = null; if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); setPlaying(null); setLoading(false); };
  const enVoice = useEnglishServerVoice();
  useEffect(() => stop, [exerciseId, locale]);
  function play(which: number | 'all', englishText: string) {
    stop(); setError(''); setPlaying(which);
    if (locale === 'en' && !enVoice) {
      if (typeof speechSynthesis === 'undefined') { setError(tt.voiceUnavailable); setPlaying(null); return; }
      const u = new SpeechSynthesisUtterance(englishText); u.lang = 'en-US'; u.rate = 0.95; u.onend = () => setPlaying(null); u.onerror = () => setPlaying(null);
      speechSynthesis.speak(u); return;
    }
    setLoading(true);
    const q = new URLSearchParams({ ...(which === 'all' ? {} : { step: String(which) }), ...(locale === 'en' ? { lang: 'en' } : {}) }).toString();
    const a = new Audio(`/api/training/tts/${encodeURIComponent(exerciseId)}${q ? `?${q}` : ''}`);
    audio.current = a;
    a.oncanplay = () => setLoading(false);
    a.onended = () => setPlaying(null);
    a.onerror = () => { setLoading(false); setPlaying(null); setError(tt.voiceUnavailable); };
    void a.play().catch(() => { setLoading(false); setPlaying(null); setError(tt.voiceUnavailable); });
  }
  return { play, stop, playing, loading, error };
}

export function ExerciseSteps({ exercise }: { exercise: Exercise }) {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const steps = (exercise.steps ?? []) as ExerciseStep[];
  const voice = useCoachVoice(exercise.id);
  if (!steps.length) return null;
  const text = (s: ExerciseStep) => (locale === 'my-MM' ? s.my ?? s.en : s.en);
  const lang = (s: ExerciseStep) => (locale === 'my-MM' && s.my ? 'my' : 'en');
  const all = steps.map((s, i) => `Step ${i + 1}. ${s.en}`).join(' ');
  const gallery = steps.map((s, i) => ({ image: s.image, n: i + 1 })).filter((x): x is { image: string; n: number } => !!x.image);
  return <section className="panel exercise-steps" aria-label={tt.stepsTitle}>
    <div className="steps-head">
      <h2>{tt.stepsTitle}</h2>
      <div className="coach-voice">
        <BeeAvatar mood="happy" size={36}/>
        {voice.playing === 'all'
          ? <button className="button secondary" onClick={voice.stop}><Square size={16}/>{voice.loading ? tt.voiceLoading : tt.stopVoice}</button>
          : <button className="button primary" onClick={() => voice.play('all', all)}><Volume2 size={18}/>{tt.listenCoach}</button>}
      </div>
    </div>
    {voice.error && <p className="error-text" role="alert">{voice.error}</p>}
    {gallery.length > 0 && <div className="pose-gallery">{gallery.map(g => <figure key={g.n} className="pose"><img src={g.image} alt={`${tt.step} ${g.n}`} width={480} height={360} loading="lazy" decoding="async"/><figcaption><span className="step-number small">{g.n}</span>{tt.step} {g.n}</figcaption></figure>)}</div>}
    <ol className="step-list">{steps.map((s, i) => <li key={i} className={`step ${voice.playing === i + 1 ? 'speaking' : ''}`}>
      <span className="step-number" aria-hidden="true">{i + 1}</span>
      <p lang={lang(s)}>{text(s)}</p>
      <button className="icon-button step-voice" aria-label={`${voice.playing === i + 1 ? tt.stopVoice : tt.listenStep} ${i + 1}`} onClick={() => voice.playing === i + 1 ? voice.stop() : voice.play(i + 1, `Step ${i + 1}. ${s.en}`)}>
        {voice.playing === i + 1 ? <Square size={16}/> : <Volume2 size={16}/>}
      </button>
    </li>)}</ol>
  </section>;
}
