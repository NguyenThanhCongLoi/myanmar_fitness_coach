'use client';
import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { useEnglishServerVoice } from '@/shared/voice';
import type { Exercise, Workout } from '@/shared/types';
import { workoutKcal } from '@/shared/energy';
import { MuscleMap } from '../exercises/muscle-map';
import { BeeMessage } from '../gamification/mascot';
import { useGameLanguage } from '@/shared/game-language';
import { makeShareCard, shareOrDownload } from './share-card';
import { Share2 } from 'lucide-react';
import { track } from '@/shared/analytics';

// Post-workout summary from what was actually logged (not the plan), with an optional spoken recap.
export function SessionSummary({ session, library, onContinue }: { session: Workout; library: Exercise[]; onContinue: () => void }) {
  const { data } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage(); const gt = useGameLanguage();
  const enVoice = useEnglishServerVoice();
  const [playing, setPlaying] = useState(false); const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }, []);
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const minutes = Math.max(1, Math.round((end - new Date(session.startedAt).getTime() - (session.totalPausedMs ?? 0)) / 60000));
  const ids = [...new Set(session.sets.map(s => s.exerciseId))];
  const reps = session.sets.reduce((n, s) => n + (s.seconds ? 0 : s.reps), 0), volume = Math.round(session.sets.reduce((n, s) => n + s.reps * s.weightKg, 0));
  const kcal = workoutKcal(minutes, data.measurements[0]?.weightKg ?? 70);
  const muscles = [...new Set(ids.flatMap(id => library.find(e => e.id === id)?.primaryMuscles ?? []))];
  const secondary = [...new Set(ids.flatMap(id => library.find(e => e.id === id)?.secondaryMuscles ?? []))].filter(m => !muscles.includes(m));
  async function listen() {
    if (playing) { audio.current?.pause(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); setPlaying(false); return; }
    setPlaying(true);
    if (locale === 'en' && !enVoice && typeof speechSynthesis !== 'undefined') { const u = new SpeechSynthesisUtterance(`You trained for ${minutes} minutes: ${ids.length} exercises, ${session.sets.length} sets${reps ? `, ${reps} reps` : ''}. Great work. Eat a meal with protein and rest well.`); u.onend = () => setPlaying(false); speechSynthesis.speak(u); return; }
    try { const a = new Audio(`/api/training/tts/summary/${encodeURIComponent(session.id)}${locale === 'en' ? '?lang=en' : ''}`); audio.current = a; a.onended = () => setPlaying(false); a.onerror = () => setPlaying(false); await a.play(); } catch { setPlaying(false); }
  }
  const stats: [number, string][] = [[minutes, tt.summaryMinutes], [ids.length, tt.summaryExercises], [session.sets.length, tt.summarySets], ...(reps ? [[reps, tt.summaryReps]] as [number, string][] : []), ...(volume ? [[volume, tt.summaryVolume]] as [number, string][] : []), [kcal, tt.summaryKcal]];
  return <section className="panel session-summary" aria-label={tt.summaryTitle}>
    <BeeMessage state="celebrating" size={72} text={gt.mascot.workoutCompleted}/>
    <h2>{tt.summaryTitle}</h2>
    <div className="summary-stats">{stats.map(([v, l]) => <div key={l} className="stat-tile"><strong>{v}</strong><small>{l}</small></div>)}</div>
    {muscles.length > 0 && <><h3>{tt.summaryMuscles}</h3><div className="summary-map"><MuscleMap primary={muscles} secondary={secondary}/></div></>}
    <div className="form-footer"><button type="button" className="button secondary" onClick={() => void listen()}>{playing ? <Square size={16}/> : <Volume2 size={17}/>}{playing ? tt.stopVoice : tt.summaryListen}</button>
      <button type="button" className="button secondary" onClick={async () => { track({ name: 'share_clicked' }); const blob = await makeShareCard({ brand: 'Mingalar Fit', title: tt.summaryTitle, subtitle: new Date().toLocaleDateString(locale), stats: stats.slice(0, 4).map(([v, l]) => [v, l]) }); await shareOrDownload(blob, 'mingalar-fit-workout.png', tt.shareText); }}><Share2 size={16}/>{tt.share}</button>
      <button type="button" className="button primary" onClick={onContinue}>{tt.summaryContinue}</button></div>
  </section>;
}
