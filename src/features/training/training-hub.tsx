'use client';
import { WorkoutIntro } from '../plan/workout-intro';
import {eligibleExercises} from '@/shared/workout-policy';
import { availableAt } from '@/shared/exercise-place';
import { BeeTip } from '../gamification/bee-tip';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Dumbbell, Eye, Play, Plus, Timer, Trash2 } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, RequestError, trainingApi } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import { clock, fill, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise, Routine } from '@/shared/types';
import { MuscleMap } from '../exercises/muscle-map';
import { BeeMessage } from '../gamification/mascot';
import { useGameLanguage } from '@/shared/game-language';
import { CoachPlan } from './coach-plan';
import { NutritionView } from './nutrition-view';
import type { TrainPreset } from '@/shared/app-context';

export type Location = 'home' | 'gym';
export const LOCATION_EQUIPMENT: Record<Location, string[]> = { home: ['body weight'], gym: ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'] };
const GROUPS = ['all', 'legs', 'core', 'push', 'pull', 'upper'] as const;
type Recommendation = { kind: 'train' | 'recovery'; focus: string; location: Location; difficulty: 'beginner' | 'intermediate' | 'advanced'; suggestedMinutes: number; reasons: { code: string; group?: string; muscles?: string[]; hours?: number }[]; muscles: { muscle: string; level: string }[]; newUser: boolean; plannedRestDay: boolean };

const PRESETS = [5, 10, 15, 20, 30];
const AVOID = ['jumping', 'floor', 'wrist-loaded', 'knee-loaded', 'back-loaded', 'overhead'] as const;
type Row = { key: number; exerciseId: string; sets: number; reps: number; weight: number; restSeconds: number; linkNext?: boolean };
type TT = ReturnType<typeof useTrainingLanguage>;

export function trainingErrorText(error: unknown, t: Parameters<typeof errorText>[1], tt: TT) {
  const code = error instanceof Error ? error.message : '';
  return tt.errors[code as keyof TT['errors']] ?? errorText(error, t);
}
export function explainSequenceError(error: unknown, tt: TT, focusLabel: string) {
  if (!(error instanceof RequestError) || !error.details) return '';
  const d = error.details as Record<string, number | string | string[]>;
  if (error.code === 'BUDGET_TOO_SHORT') return fill(tt.explainShort, { budget: clock(Number(d.budgetSeconds)), min: clock(Number(d.minimumSeconds)), warm: clock(Number(d.warmup)), work: clock(Number(d.shortestExerciseSeconds)), tr: clock(Number(d.transitionSeconds) * 2), cool: clock(Number(d.cooldown)) });
  if (error.code === 'NO_EXERCISE_MATCH') return fill(tt.explainNoMatch, { focus: focusLabel, after: Number(d.afterEquipmentAndConstraints), level: Number(d.afterDifficulty) });
  if (error.code === 'NO_PREPARATION_MATCH') return tt.explainNoPrep;
  if (error.code === 'EQUIPMENT_UNAVAILABLE') return fill(tt.explainEquipment, { items: (d.missing as string[] ?? []).join(', ') });
  return '';
}

export function TrainingHub() {
  const { data, openWorkout, refresh, notify, trainPreset, clearTrainPreset, go } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage();
  const [mode, setMode] = useState<'plan' | 'free' | 'follow' | 'nutrition'>(trainPreset?.mode ?? 'plan');
  const [preset] = useState<TrainPreset | null>(trainPreset);
  useEffect(() => { if (trainPreset) clearTrainPreset(); }, []);
  const [location, setLocationState] = useState<Location>(data.profile?.trainingLocation ?? 'home');
  useEffect(() => { try { const saved = localStorage.getItem('mingalar-location'); if (saved === 'gym' || saved === 'home') setLocationState(saved); } catch { /* optional */ } }, []);
  const setLocation = (value: Location) => { setLocationState(value); try { localStorage.setItem('mingalar-location', value); } catch { /* optional */ } };
  const [library, setLibrary] = useState<Exercise[]>([]);
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setLibrary).catch(error => notify(errorText(error, t), true)); }, []);
  const name = (e: Exercise) => localExercise(e, locale).name;
  const start = async (path: 'free' | 'follow', body: unknown) => {
    const session = await trainingApi<{ id: string }>(path, body); await refresh(); openWorkout(session.id);
  };
  if (preset?.mode === 'follow' || mode === 'follow') return <WorkoutIntro focus={preset?.mode==='follow'?preset.focus:'all'} minutes={preset?.mode==='follow'?preset.minutes:([15,20,30].includes(data.profile?.sessionMinutes??20)?data.profile?.sessionMinutes??20:20)} title={preset?.mode==='follow'?`${preset.minutes} ${tt.ux.min}`:tt.ux.home.forYou} image="/images/banners/fullbody.webp" back={()=>go('home')}/>;
  return <section>
    <div className="page-heading"><span className="overline"><Dumbbell size={14}/> {tt.train}</span><h1>{tt.trainTitle}</h1><p>{tt.trainBody}</p></div>
    <BeeTip context={mode === 'nutrition' ? 'nutrition' : 'train'}/>
    {data.activeSession && <div className="rest-banner" role="status"><Timer size={20}/><span>{tt.resumeActive}</span><button className="button secondary" onClick={() => openWorkout(data.activeSession!.id)}>{tt.openActive}</button></div>}
    <div className="mode-switch four" role="tablist">
      <button role="tab" aria-selected={mode === 'plan'} className={mode === 'plan' ? 'selected' : ''} onClick={() => setMode('plan')}><strong>{tt.planTab}</strong><small>{tt.splitsTitle}</small></button>
      <button role="tab" aria-selected={mode === 'free'} className={mode === 'free' ? 'selected' : ''} onClick={() => setMode('free')}><strong>{tt.freeWorkout}</strong><small>{tt.freeHint}</small></button>
      <button role="tab" aria-selected={false} onClick={() => setMode('follow')}><strong>{tt.followAlong}</strong><small>{tt.followHint}</small></button>
      <button role="tab" aria-selected={mode === 'nutrition'} className={mode === 'nutrition' ? 'selected' : ''} onClick={() => setMode('nutrition')}><strong>{tt.nutritionTab}</strong><small>{tt.nutritionTitle}</small></button>
    </div>
    <button type="button" className="text-button my-plans-link" onClick={() => go('plans')}>{tt.myPlans} →</button>
    <fieldset className="location-switch"><legend>{tt.location}</legend>{(['home', 'gym'] as const).map(l => <button type="button" key={l} aria-pressed={location === l} className={location === l ? 'selected' : ''} onClick={() => setLocation(l)}><strong>{tt[l]}</strong><small>{l === 'home' ? tt.homeHint : tt.gymHint}</small></button>)}</fieldset>
    <div hidden={mode !== 'nutrition'}>{mode === 'nutrition' && <NutritionView/>}</div>
    <div hidden={mode !== 'plan'}>{library.length > 0 && <CoachPlan library={library} location={location}/>}</div>
    <div hidden={mode !== 'free'}><FreeBuilder library={library} name={name} location={location} start={body => start('free', body)} preset={preset?.mode === 'free' ? preset : undefined}/></div>
  </section>;
}

function FreeBuilder({ library, name, location, start, preset }: { library: Exercise[]; name: (e: Exercise) => string; location: Location; start: (body: unknown) => Promise<void>; preset?: Extract<TrainPreset, { mode: 'free' }> }) {
  const { data, notify } = useApp(); const { t } = useLanguage(); const tt = useTrainingLanguage();
  const unit = data.profile?.weightUnit ?? 'kg';
  const [title, setTitle] = useState(preset?.name ?? tt.defaultFreeName);
  const [rows, setRows] = useState<Row[]>(() => (preset?.rows ?? []).map((r, i) => ({ key: i + 1, exerciseId: r.exerciseId, sets: Math.min(8, Math.max(1, r.sets)), reps: Math.min(50, Math.max(1, r.reps)), weight: 0, restSeconds: Math.min(600, Math.max(15, r.restSeconds)) }))); const [busy, setBusy] = useState(false);
  const available = new Set(LOCATION_EQUIPMENT[location]);
  const choices = eligibleExercises(library,data.profile??{equipment:['body weight']},location).filter(e => availableAt(e,location) && !(e.tags ?? []).some(x => x === 'warmup' || x === 'cooldown') && (e.equipment.every(q => available.has(q)) || rows.some(r => r.exerciseId === e.id)));
  const update = (key: number, patch: Partial<Row>) => setRows(all => all.map(r => r.key === key ? { ...r, ...patch } : r));
  const add = () => { const next = choices.find(e => !rows.some(r => r.exerciseId === e.id)); if (next) setRows(all => [...all, { key: Date.now(), exerciseId: next.id, sets: 3, reps: 10, weight: 0, restSeconds: 60 }]); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!rows.length) { notify(tt.noExercisesYet, true); return; }
    setBusy(true);
    // Consecutive linked rows share a superset letter (A, B, ...), max 4 per group.
    const groups: (string | null)[] = []; let letter = -1, size = 0;
    rows.forEach((r, i) => { const linkedFromPrev = i > 0 && rows[i - 1].linkNext && size < 4; if (linkedFromPrev) { groups[i - 1] ??= String.fromCharCode(65 + letter); groups[i] = String.fromCharCode(65 + letter); size++; } else { groups[i] = null; if (r.linkNext && i < rows.length - 1) { letter++; size = 1; } } });
    try { await start({ name: title.trim(), location, exercises: rows.map((r, i) => ({ exerciseId: r.exerciseId, sets: r.sets, reps: r.reps, restSeconds: r.restSeconds, targetKg: Math.round((unit === 'lb' ? r.weight * 0.45359237 : r.weight) * 10) / 10, supersetGroup: groups[i] ?? null })) }); }
    catch (error) { notify(trainingErrorText(error, t, tt), true); } finally { setBusy(false); }
  }
  return <form className="panel form-stack free-builder" onSubmit={submit}>
    <label>{tt.workoutName}<input value={title} onChange={e => setTitle(e.target.value)} minLength={2} maxLength={100} required/></label>
    {rows.map((row, index) => <fieldset className="free-row" key={row.key}>
      <legend>{String(index + 1).padStart(2, '0')}</legend>
      <label className="wide">{tt.chooseExercise}<select value={row.exerciseId} onChange={e => update(row.key, { exerciseId: e.target.value })}>{choices.map(e => <option key={e.id} value={e.id} disabled={e.id !== row.exerciseId && rows.some(r => r.exerciseId === e.id)}>{name(e)}</option>)}</select></label>
      <label>{tt.sets}<input type="number" min={1} max={8} value={row.sets} onChange={e => update(row.key, { sets: Number(e.target.value) })} required/></label>
      <label>{tt.reps}<input type="number" min={1} max={50} value={row.reps} onChange={e => update(row.key, { reps: Number(e.target.value) })} required/></label>
      <label>{tt.weight} ({unit})<input type="number" min={0} max={unit === 'kg' ? 400 : 880} step="0.5" value={row.weight} onChange={e => update(row.key, { weight: Number(e.target.value) })} required/></label>
      <label>{tt.restSeconds}<input type="number" min={15} max={600} step={5} value={row.restSeconds} onChange={e => update(row.key, { restSeconds: Number(e.target.value) })} required/></label>
      {index < rows.length - 1 && <label className="check superset-link"><input type="checkbox" checked={!!row.linkNext} onChange={e => update(row.key, { linkNext: e.target.checked })}/>{tt.supersetWithNext}</label>}
      <button type="button" className="icon-button" aria-label={`${tt.remove} ${index + 1}`} onClick={() => setRows(all => all.filter(r => r.key !== row.key))}><Trash2 size={18}/></button>
    </fieldset>)}
    {!rows.length && <p className="muted">{tt.noExercisesYet}</p>}
    <div className="form-footer"><button type="button" className="button secondary" onClick={add} disabled={rows.length >= 20 || !choices.length}><Plus size={18}/>{tt.addExercise}</button>
      <button className="button primary" disabled={busy || !rows.length}><Play size={18}/>{busy ? t.working : tt.startFree}</button></div>
  </form>;
}
