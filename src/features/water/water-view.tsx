'use client';
import { useEffect, useState } from 'react';
import { CupSoda, Droplets, GlassWater, Milk, Undo2 } from 'lucide-react';
import { trainingApi } from '@/shared/client';
import { useTrainingLanguage } from '@/shared/training-language';
import { buzz } from '@/shared/wake-lock';
import { NutritionView } from '../training/nutrition-view';
import { BeeTip } from '../gamification/bee-tip';
import { MealPhoto } from './meal-photo';

type Water = { day: string; totalMl: number; targetMl: number; weightKg: number | null; workedOut: boolean; entries: { id: string; ml: number; at: string }[]; week: { day: string; ml: number }[] };

// Water + food tab: daily water target from body weight, one-tap logging, then calories and nutrition guidance.
export function WaterView() {
  const tt = useTrainingLanguage(); const u = tt.ux;
  const [w, setW] = useState<Water | null>(null); const [busy, setBusy] = useState(false); const [tab, setTab] = useState<'water' | 'food'>(() => { try { const v = sessionStorage.getItem('mingalar-tab'); sessionStorage.removeItem('mingalar-tab'); return v === 'food' ? 'food' : 'water'; } catch { return 'water'; } });
  useEffect(() => { trainingApi<Water>('water').then(setW).catch(() => {}); }, []);
  async function add(ml: number) { setBusy(true); try { setW(await trainingApi<Water>('water', { ml })); buzz(20); } finally { setBusy(false); } }
  async function undo() { setBusy(true); try { setW(await trainingApi<Water>('water/undo', {})); } finally { setBusy(false); } }
  const pct = w ? Math.min(100, Math.round(w.totalMl / w.targetMl * 100)) : 0;
  const max = Math.max(1, ...(w?.week.map(d => Math.max(d.ml, w.targetMl)) ?? [1]));
  return <section className="water-view">
    <div className="page-heading"><span className="overline"><Droplets size={14}/> {u.waterTab}</span><h1>{u.waterTitle}</h1></div>
    <div className="seg-switch tab-switch">{(['water', 'food'] as const).map(k => <button key={k} type="button" className={tab === k ? 'selected' : ''} aria-pressed={tab === k} onClick={() => setTab(k)}>{u.waterTabs[k]}</button>)}</div>
    {tab === 'water' && <>
      {!w ? <div className="sk sk-hero"/> : <>
        <div className="water-ring" style={{ ['--p' as string]: `${pct}%` }} role="img" aria-label={`${w.totalMl} / ${w.targetMl} ml`}>
          <div><strong>{(w.totalMl / 1000).toFixed(2)}</strong><small>/ {(w.targetMl / 1000).toFixed(1)} L</small><span>{pct}%</span></div></div>
        <p className="muted center">{pct >= 100 ? u.waterDone : u.waterLeft.replace('{ml}', String(Math.max(0, w.targetMl - w.totalMl)))}</p>
        <div className="water-buttons">
          {([[150, CupSoda, u.cup], [250, GlassWater, u.glass], [500, Milk, u.bottle]] as const).map(([ml, Icon, label]) =>
            <button key={ml} type="button" className="water-add" disabled={busy} onClick={() => void add(ml)}><Icon size={26}/><strong>+{ml} ml</strong><small>{label}</small></button>)}
        </div>
        {w.entries.length > 0 && <button type="button" className="text-button" disabled={busy} onClick={() => void undo()}><Undo2 size={15}/>{u.undo} ({w.entries[0].ml} ml)</button>}
        <section className="panel"><h3>{u.last7}</h3>
          <div className="water-week">{w.week.map(d => <div key={d.day} title={`${d.day}: ${d.ml} ml`}><span style={{ height: `${d.ml / max * 100}%` }} className={d.ml >= w.targetMl ? 'met' : ''}/><small>{d.day.slice(8)}</small></div>)}</div></section>
        <details className="explain-box"><summary>{u.howTarget}</summary><p>{u.targetExplain.replace('{kg}', w.weightKg ? String(w.weightKg) : '—').replace('{ml}', String(w.targetMl))}{w.workedOut ? ` ${u.workoutExtra}` : ''}</p></details>
      </>}
      <BeeTip context="nutrition"/>
    </>}
    {tab === 'food' && <><MealPhoto/><NutritionView/></>}
  </section>;
}
