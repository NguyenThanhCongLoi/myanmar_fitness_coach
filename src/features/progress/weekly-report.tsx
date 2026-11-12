'use client';
import { useEnglishServerVoice } from '@/shared/voice';
import { useRef, useState, useEffect } from 'react';
import { Sparkles, Square, Volume2 } from 'lucide-react';
import { trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { BeeAvatar } from '../gamification/mascot';

type Week = { week: string; workouts: number; sets: number; volumeKg: number };
type Report = { key: string; week: Week; previous: Week; prs: number; lowVolumeMuscles: string[]; weightChangeKg: number | null; avgIntake: number | null; targetIntake: number | null; narrative: string | null };
// Weekly review: deterministic numbers first; the coach narrative (LLM) and its voice are optional extras.
export function WeeklyReport() {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [r, setR] = useState<Report | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { trainingApi<Report>('report').then(setR).catch(() => {}); return () => audio.current?.pause(); }, []);
  const enVoice = useEnglishServerVoice();
  if (!r) return null;
  const delta = (a: number, b: number) => (a > b ? `▲ ${a - b}` : a < b ? `▼ ${b - a}` : '＝');
  async function narrative() { setBusy(true); setError(''); try { setR(await trainingApi<Report>('report/narrative', { locale })); } catch { setError(tt.reportUnavailable); } finally { setBusy(false); } }
  async function listen() {
    if (playing) { audio.current?.pause(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); setPlaying(false); return; }
    if (!r!.narrative) return; setPlaying(true);
    if (!/[က-႟]/.test(r!.narrative) && !enVoice && typeof speechSynthesis !== 'undefined') { const u = new SpeechSynthesisUtterance(r!.narrative.replace(/•/g, '')); u.lang = 'en-US'; u.onend = () => setPlaying(false); speechSynthesis.speak(u); return; }
    try { const a = new Audio(`/api/training/tts/report/${encodeURIComponent(r!.key)}`); audio.current = a; a.onended = () => setPlaying(false); a.onerror = () => { setPlaying(false); setError(tt.voiceUnavailable); }; await a.play(); } catch { setPlaying(false); }
  }
  const tiles: [string, string | number, string][] = [[tt.reportWorkouts, r.week.workouts, delta(r.week.workouts, r.previous.workouts)], [tt.weeklySets, r.week.sets, delta(r.week.sets, r.previous.sets)], [tt.weeklyVolume, r.week.volumeKg, delta(r.week.volumeKg, r.previous.volumeKg)], [tt.recordsTitle, r.prs, '']];
  return <section className="panel weekly-report" aria-label={tt.reportTitle}>
    <div className="insights-head"><BeeAvatar mood="happy" size={40}/><h2>{tt.reportTitle}</h2></div>
    <div className="summary-stats">{tiles.map(([l, v, d]) => <div key={l} className="stat-tile"><small>{l}</small><strong>{v}</strong>{d && <small>{d} {tt.vsLastWeek}</small>}</div>)}</div>
    <ul className="cue-list">
      {r.weightChangeKg !== null && <li>{fill(tt.reportWeight, { kg: r.weightChangeKg > 0 ? `+${r.weightChangeKg}` : r.weightChangeKg })}</li>}
      {r.avgIntake !== null && <li>{fill(tt.reportIntake, { avg: r.avgIntake, target: r.targetIntake ?? '—' })}</li>}
      {r.lowVolumeMuscles.length > 0 && <li>{fill(tt.reportLowVolume, { muscles: r.lowVolumeMuscles.map(m => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m).join(', ') })}</li>}
    </ul>
    {r.narrative ? <div className="report-narrative"><p>{r.narrative}</p><button type="button" className="button secondary" onClick={() => void listen()}>{playing ? <Square size={16}/> : <Volume2 size={17}/>}{playing ? tt.stopVoice : tt.listenMessage}</button></div>
      : <button type="button" className="button primary" disabled={busy} onClick={() => void narrative()}><Sparkles size={17}/>{busy ? tt.ptPreparing : tt.reportAsk}</button>}
    {error && <p className="error-text">{error}</p>}
  </section>;
}
