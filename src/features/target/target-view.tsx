'use client';
import { useEffect, useState } from 'react';
import { Award, Camera, Droplets, Dumbbell, Flame, Target, Utensils } from 'lucide-react';
import { trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { pctColor } from '../plan/plan-view';

type Streak = { current: number; best: number; next: number };
type Board = { today: string; kcalTarget: number; milestones: number[]; streaks: Record<'training' | 'water' | 'meals' | 'photos', Streak>;
  grid: { day: string; waterPct: number; meals: number; photos: number; kcalPct: number; workoutPct: number | null; planned: boolean }[] };
const KINDS = ['training', 'water', 'meals', 'photos'] as const;
const ICON = { training: Dumbbell, water: Droplets, meals: Utensils, photos: Camera };
// cell colour per streak type: water = blue scale by %, meals = darker the closer to the calorie target, training = % scale
function cell(kind: typeof KINDS[number], d: Board['grid'][number]) {
  if (kind === 'water') return d.waterPct ? `color-mix(in srgb, var(--c-water) ${Math.max(15, d.waterPct)}%, transparent)` : 'var(--line)';
  if (kind === 'meals') return d.meals ? `color-mix(in srgb, var(--c-meal) ${Math.max(18, Math.min(100, 100 - Math.abs(100 - d.kcalPct)))}%, transparent)` : 'var(--line)';
  if (kind === 'photos') return d.photos ? `color-mix(in srgb, var(--c-photo) ${Math.min(100, 35 + d.photos * 25)}%, transparent)` : 'var(--line)';
  return d.workoutPct !== null ? pctColor(d.workoutPct) : d.planned ? 'var(--line)' : 'transparent';
}

export function TargetView() {
  const { t } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux; const g = u.goals;
  const [b, setB] = useState<Board | null>(null);
  useEffect(() => { trainingApi<Board>('streaks').then(setB).catch(() => {}); }, []);
  if (!b) return <section className="target-view"><div className="sk sk-title"/><div className="sk sk-card"/><div className="sk sk-card"/></section>;
  const first = new Date(b.grid[0].day + 'T12:00:00Z').getUTCDay(), offset = (first + 6) % 7;
  return <section className="target-view">
    <div className="page-heading"><span className="overline"><Target size={14}/> {g.tab}</span><h1>{g.title}</h1><p>{g.intro}</p></div>
    {KINDS.map(k => { const s = b.streaks[k], Icon = ICON[k]; const pct = Math.min(100, Math.round(s.current / s.next * 100));
      return <article key={k} className={`streak-card s-${k}`}>
        <header><span className="streak-icon"><Icon size={20}/></span><div><strong>{g.names[k]}</strong><small>{g.rules[k]}</small></div>
          <span className="streak-count">{k === 'training' ? <Flame size={18}/> : null}{s.current}<small>{g.days}</small></span></header>
        <div className="milestone"><div className="milestone-bar"><i style={{ width: `${pct}%` }}/></div>
          <small>{s.current >= s.next ? g.reached : g.toNext.replace('{n}', String(s.next - s.current)).replace('{m}', String(s.next))} · {g.best} {s.best}</small></div>
        <div className="streak-grid" role="img" aria-label={`${g.names[k]}: 5 ${g.weeks}`}>
          {Array.from({ length: offset }, (_, i) => <span key={`x${i}`} className="sg-empty"/>)}
          {b.grid.map(d => { const bg = cell(k, d), rest = k === 'training' && d.workoutPct === null && !d.planned, on = bg !== 'var(--line)' && bg !== 'transparent';
            return <span key={d.day} title={`${d.day}`} className={[d.day === b.today ? 'today' : '', rest ? 'rest' : '', on ? 'on' : 'off'].join(' ')} style={on ? { background: bg } : undefined}>{k === 'water' && d.waterPct >= 100 ? '✓' : ''}</span>; })}
        </div>
        <div className="sg-legend">{t.weekdaysShort.map(w => <small key={w}>{w.slice(0, 2)}</small>)}</div>
      </article>; })}
    <section className="panel ladder"><h2><Award size={18}/> {g.ladder}</h2>
      {KINDS.map(k => <div key={k} className="ladder-row"><small>{g.names[k]}</small>
        <div className="ladder-steps">{b.milestones.slice(0, 5).map(m => <span key={m} className={b.streaks[k].best >= m ? 'won' : b.streaks[k].current >= m ? 'won' : ''}>{m}</span>)}</div></div>)}
      <p className="muted small">{g.ladderHint}</p></section>
  </section>;
}
