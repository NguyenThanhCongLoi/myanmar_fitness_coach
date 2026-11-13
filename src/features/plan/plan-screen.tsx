'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clock, Dumbbell, Home, Loader2, Play } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, trainingApi } from '@/shared/client';
import { useIntakeLanguage } from '@/shared/intake-language';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { trainingErrorText } from '../training/training-hub';
import type { Exercise } from '@/shared/types';
import { getLocation, startPlanDay, type Plan, type PlanDayView } from './plan-view';

// Workout Plan: this week's days with their exercises; the next day is open and has the Start button.
export function PlanScreen() {
  const { data, go, openWorkout, notify } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux; const copy=useIntakeLanguage();
  const [plan, setPlan] = useState<Plan | null>(null); const [library, setLibrary] = useState<Exercise[]>([]);
  const [location, setLocation] = useState<'home' | 'gym'>('home'); const [busy, setBusy] = useState<number | null>(null);
  const load = (l: 'home' | 'gym') => trainingApi<Plan>(`plan?location=${l}`).then(setPlan).catch(e => notify(trainingErrorText(e, t, tt)));
  useEffect(() => { const l = getLocation(data.profile?.trainingLocation); setLocation(l); void load(l); trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, []);
  const ex = (id: string) => library.find(e => e.id === id);
  const name = (id: string) => { const e = ex(id); return e ? localExercise(e, locale).name.split('—')[0].trim() : ''; };
  const title = (d: PlanDayView) => u.splits[d.split as keyof typeof u.splits] ?? d.split;
  const sets = (n: number) => (n === 1 ? u.plural.set1 : u.plural.sets.replace('{n}', String(n)));
  function switchTo(l: 'home' | 'gym') { setLocation(l); try { localStorage.setItem('mingalar-location', l); } catch { /* optional */ } void load(l); }
  async function start(d: PlanDayView) {
    if (data.activeSession) { openWorkout(data.activeSession.id); return; }
    setBusy(d.day);
    try { const s = await startPlanDay(d, plan!.program, `${u.day} ${d.day} · ${title(d)}`); openWorkout(s.id); }
    catch (e) { notify(trainingErrorText(e, t, tt)); setBusy(null); }
  }
  return <section className="plan-screen">
    <div className="ps-top"><button type="button" className="icon-button" aria-label={u.back} onClick={() => go('home')}><ArrowLeft size={22}/></button><h1>{u.planSection}</h1></div>
    {!plan ? <><div className="sk sk-card"/><div className="sk sk-card"/></> : <>
      <div className="ps-summary">
        <div><strong>{u.programs[plan.program].title}</strong><small>{u.week} {plan.week} · {plan.completed}/{plan.total}</small></div>
        <div className="seg-switch">{(['home', 'gym'] as const).map(l => <button key={l} type="button" className={location === l ? 'selected' : ''} aria-pressed={location === l} onClick={() => switchTo(l)}>{l === 'home' ? <Home size={15}/> : <Dumbbell size={15}/>}{tt[l]}</button>)}</div>
        <span className="hv-progress"><i style={{ width: `${plan.total ? plan.completed / plan.total * 100 : 0}%` }}/></span>
      </div>
      {plan.days.some(d=>d.minutes<plan.sessionMinutes-3)&&<p className="muted">{copy.budgetHint}</p>}
      {plan.days.map(d => { const current = d.day === plan.current;
        return <details key={d.day} className={`ps-day ${current ? 'current' : ''} ${d.done ? 'done' : ''}`} open={current}>
          <summary><span className="ps-dot">{d.done ? <Check size={16}/> : d.day}</span><span><strong>{u.day} {d.day} · {title(d)}</strong><small><Clock size={13}/>{d.minutes} {u.min} · {d.items.length} {u.exercises}</small></span></summary>
          <ul className="ps-list">{d.items.map(it => { const e = ex(it.id);
            return <li key={it.id}><span className="ex-thumb" style={e?.thumbnailUrl ? { backgroundImage: `url(${e.thumbnailUrl})` } : undefined}/>
              <span><strong>{name(it.id)}</strong><small>{sets(it.sets)} × {it.target}{it.unit === 'reps' ? ` ${u.reps}` : ` ${u.sec}`}</small></span>{d.done && <Check className="ps-done" size={18}/>}</li>; })}</ul>
          {!d.done && <button type="button" className="button workout-start big-start" disabled={busy !== null} onClick={() => void start(d)}>{busy === d.day ? <><Loader2 className="spin" size={20}/>{u.starting}</> : <><Play size={20}/>{data.activeSession ? u.resume : u.start}</>}</button>}
        </details>; })}
    </>}
  </section>;
}
