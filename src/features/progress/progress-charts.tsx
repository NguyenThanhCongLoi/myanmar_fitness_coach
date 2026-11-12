'use client';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { trainingApi, localExercise } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';
import { MuscleMap } from '../exercises/muscle-map';
import { WeeklyReport } from './weekly-report';
import { ProgressPhotos } from './progress-photos';

type Overview = { calendar: { day: string; count: number }[]; weeks: { week: string; workouts: number; sets: number; volumeKg: number }[]; setsPerMuscle: Record<string, number>; target: { min: number; max: number };
  trends: { exerciseId: string; name: string; points: { day: string; e1rm: number }[] }[]; records: { exerciseId: string; name: string; e1rm: number | null; reps: number; weightKg: number }[]; totalWorkouts: number };
const INK = 'var(--chart-ink, #2f6b52)';

// Single-hue charts (magnitude), thin marks, recessive axes, native SVG tooltips on every mark, table-like labels for accessibility.
function Bars({ data, label, unit }: { data: { key: string; label: string; value: number }[]; label: string; unit: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return <figure className="chart" aria-label={label}><figcaption>{label}</figcaption>
    <svg viewBox={`0 0 ${data.length * 40} 120`} role="img" aria-label={label} preserveAspectRatio="none" className="bars">
      <line x1="0" x2={data.length * 40} y1="100" y2="100" stroke="var(--line)" strokeWidth="1"/>
      {data.map((d, i) => { const h = Math.max(d.value ? 3 : 0, d.value / max * 90); return <g key={d.key}><title>{`${d.label}: ${d.value} ${unit}`}</title>
        <rect x={i * 40 + 8} y={100 - h} width="24" height={h} rx="4" fill={INK}/><rect x={i * 40} y="0" width="40" height="120" fill="transparent"/></g>; })}
    </svg>
    <div className="bar-labels">{data.map(d => <span key={d.key}>{d.label}</span>)}</div>
  </figure>;
}
function Line({ points, label }: { points: { day: string; e1rm: number }[]; label: string }) {
  if (points.length < 2) return <p className="muted small">{label}: {points[0]?.e1rm ?? '—'} kg</p>;
  const min = Math.min(...points.map(p => p.e1rm)), max = Math.max(...points.map(p => p.e1rm)), span = Math.max(1, max - min);
  const x = (i: number) => 10 + i * (280 / (points.length - 1)), y = (v: number) => 90 - (v - min) / span * 70;
  return <figure className="chart"><figcaption>{label}</figcaption>
    <svg viewBox="0 0 300 100" role="img" aria-label={label}><line x1="0" x2="300" y1="95" y2="95" stroke="var(--line)"/>
      <polyline fill="none" stroke={INK} strokeWidth="2" points={points.map((p, i) => `${x(i)},${y(p.e1rm)}`).join(' ')}/>
      {points.map((p, i) => <g key={p.day}><title>{`${p.day}: ${p.e1rm} kg`}</title><circle cx={x(i)} cy={y(p.e1rm)} r="4" fill={INK} stroke="#fff" strokeWidth="2"/><circle cx={x(i)} cy={y(p.e1rm)} r="12" fill="transparent"/></g>)}
      <text x="4" y="12" fontSize="10" fill="var(--muted)">{max} kg</text></svg></figure>;
}
export function ProgressCharts() {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [o, setO] = useState<Overview | null>(null); const [library, setLibrary] = useState<Exercise[]>([]);
  const [load, setLoad] = useState<{ muscle: string; level: string }[]>([]);
  useEffect(() => { trainingApi<Overview>('progress').then(setO).catch(() => {}); trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); trainingApi<{ muscles: { muscle: string; level: string }[] }>('recommendation?location=home').then(r => setLoad(r.muscles)).catch(() => {}); }, []);
  if (!o) return null;
  const name = (id: string, fallback: string) => { const e = library.find(x => x.id === id); return e ? localExercise(e, locale).name.split('—')[0].trim() : fallback; };
  const muscles = Object.entries(o.setsPerMuscle).sort((a, b) => b[1] - a[1]);
  const maxCal = Math.max(1, ...o.calendar.map(c => c.count));
  return <div className="progress-charts">
    <WeeklyReport/>
    <section className="panel"><h2>{tt.calendarTitle}</h2>
      <div className="heat-calendar" role="img" aria-label={tt.calendarTitle}>{o.calendar.map(c => <span key={c.day} title={`${c.day}: ${c.count}`} className="heat-cell" style={{ background: c.count ? `color-mix(in srgb, #2f6b52 ${30 + 70 * c.count / maxCal}%, white)` : 'var(--line)' }}/>)}</div>
      <p className="muted small">{fill(tt.workoutsIn12Weeks, { n: o.totalWorkouts })}</p></section>
    <div className="chart-grid">
      <section className="panel"><Bars label={tt.weeklyVolume} unit="kg" data={o.weeks.map(w => ({ key: w.week, label: w.week.slice(5), value: w.volumeKg }))}/></section>
      <section className="panel"><Bars label={tt.weeklySets} unit={tt.summarySets} data={o.weeks.map(w => ({ key: w.week, label: w.week.slice(5), value: w.sets }))}/></section>
    </div>
    <section className="panel"><h2>{tt.setsPerMuscle}</h2><p className="muted small">{fill(tt.setsTargetNote, { min: o.target.min, max: o.target.max })}</p>
      {muscles.length ? <div className="muscle-bars">{muscles.map(([m, n]) => <div key={m} className="muscle-bar" title={`${m}: ${n}`}><span className="mb-label">{tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m}</span>
        <span className="mb-track"><span className="mb-band" style={{ left: `${o.target.min / 25 * 100}%`, width: `${(o.target.max - o.target.min) / 25 * 100}%` }}/><span className="mb-fill" style={{ width: `${Math.min(100, n / 25 * 100)}%` }}/></span><span className="mb-value">{n}</span></div>)}</div> : <p className="muted">{tt.noSetsYet}</p>}</section>
    <div className="chart-grid">
      <section className="panel"><h2>{tt.strengthTrend}</h2>{o.trends.length ? o.trends.map(t => <Line key={t.exerciseId} label={name(t.exerciseId, t.name)} points={t.points}/>) : <p className="muted">{tt.noSetsYet}</p>}</section>
      <section className="panel"><h2><Trophy size={18}/> {tt.recordsTitle}</h2>{o.records.length ? <ul className="records">{o.records.map(r => <li key={r.exerciseId}><span>{name(r.exerciseId, r.name)}</span><strong>{r.e1rm ? `${r.weightKg} kg × ${r.reps} (1RM ~${r.e1rm})` : `${r.reps} ${tt.summaryReps}`}</strong></li>)}</ul> : <p className="muted">{tt.noSetsYet}</p>}</section>
    </div>
    <ProgressPhotos/>
    {load.some(m => m.level !== 'none') && <section className="panel"><h2>{tt.recoveryMap}</h2><MuscleMap primary={load.filter(m => m.level === 'high').map(m => m.muscle)} secondary={load.filter(m => m.level === 'moderate' || m.level === 'low').map(m => m.muscle)} legend={[tt.activityHigh, tt.activityModerate]}/><p className="muted small">{tt.loadNote}</p></section>}
  </div>;
}
