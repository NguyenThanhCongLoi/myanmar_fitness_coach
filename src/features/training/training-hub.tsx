'use client';
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
export const LOCATION_EQUIPMENT: Record<Location, string[]> = { home: ['body weight', 'band', 'dumbbell'], gym: ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'] };
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
  const [location, setLocationState] = useState<Location>('home');
  useEffect(() => { try { const saved = localStorage.getItem('mingalar-location'); if (saved === 'gym' || saved === 'home') setLocationState(saved); } catch { /* optional */ } }, []);
  const setLocation = (value: Location) => { setLocationState(value); try { localStorage.setItem('mingalar-location', value); } catch { /* optional */ } };
  const [library, setLibrary] = useState<Exercise[]>([]);
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setLibrary).catch(error => notify(errorText(error, t), true)); }, []);
  const name = (e: Exercise) => localExercise(e, locale).name;
  const start = async (path: 'free' | 'follow', body: unknown) => {
    const session = await trainingApi<{ id: string }>(path, body); await refresh(); openWorkout(session.id);
  };
  return <section>
    <div className="page-heading"><span className="overline"><Dumbbell size={14}/> {tt.train}</span><h1>{tt.trainTitle}</h1><p>{tt.trainBody}</p></div>
    <BeeTip context={mode === 'nutrition' ? 'nutrition' : 'train'}/>
    {data.activeSession && <div className="rest-banner" role="status"><Timer size={20}/><span>{tt.resumeActive}</span><button className="button secondary" onClick={() => openWorkout(data.activeSession!.id)}>{tt.openActive}</button></div>}
    <div className="mode-switch four" role="tablist">
      <button role="tab" aria-selected={mode === 'plan'} className={mode === 'plan' ? 'selected' : ''} onClick={() => setMode('plan')}><strong>{tt.planTab}</strong><small>{tt.splitsTitle}</small></button>
      <button role="tab" aria-selected={mode === 'free'} className={mode === 'free' ? 'selected' : ''} onClick={() => setMode('free')}><strong>{tt.freeWorkout}</strong><small>{tt.freeHint}</small></button>
      <button role="tab" aria-selected={mode === 'follow'} className={mode === 'follow' ? 'selected' : ''} onClick={() => setMode('follow')}><strong>{tt.followAlong}</strong><small>{tt.followHint}</small></button>
      <button role="tab" aria-selected={mode === 'nutrition'} className={mode === 'nutrition' ? 'selected' : ''} onClick={() => setMode('nutrition')}><strong>{tt.nutritionTab}</strong><small>{tt.nutritionTitle}</small></button>
    </div>
    <button type="button" className="text-button my-plans-link" onClick={() => go('plans')}>{tt.myPlans} →</button>
    <fieldset className="location-switch"><legend>{tt.location}</legend>{(['home', 'gym'] as const).map(l => <button type="button" key={l} aria-pressed={location === l} className={location === l ? 'selected' : ''} onClick={() => setLocation(l)}><strong>{tt[l]}</strong><small>{l === 'home' ? tt.homeHint : tt.gymHint}</small></button>)}</fieldset>
    <div hidden={mode !== 'nutrition'}>{mode === 'nutrition' && <NutritionView/>}</div>
    <div hidden={mode !== 'plan'}>{library.length > 0 && <CoachPlan library={library} location={location}/>}</div>
    <div hidden={mode !== 'free'}><FreeBuilder library={library} name={name} location={location} start={body => start('free', body)} preset={preset?.mode === 'free' ? preset : undefined}/></div>
    <div hidden={mode !== 'follow'}><FollowBuilder library={library} name={name} location={location} start={body => start('follow', body)} preset={preset?.mode === 'follow' ? preset : undefined}/></div>
  </section>;
}

function FreeBuilder({ library, name, location, start, preset }: { library: Exercise[]; name: (e: Exercise) => string; location: Location; start: (body: unknown) => Promise<void>; preset?: Extract<TrainPreset, { mode: 'free' }> }) {
  const { data, notify } = useApp(); const { t } = useLanguage(); const tt = useTrainingLanguage();
  const unit = data.profile?.weightUnit ?? 'kg';
  const [title, setTitle] = useState(preset?.name ?? tt.defaultFreeName);
  const [rows, setRows] = useState<Row[]>(() => (preset?.rows ?? []).map((r, i) => ({ key: i + 1, exerciseId: r.exerciseId, sets: Math.min(8, Math.max(1, r.sets)), reps: Math.min(50, Math.max(1, r.reps)), weight: 0, restSeconds: Math.min(600, Math.max(15, r.restSeconds)) }))); const [busy, setBusy] = useState(false);
  const available = new Set(LOCATION_EQUIPMENT[location]);
  const choices = library.filter(e => !(e.tags ?? []).some(x => x === 'warmup' || x === 'cooldown') && (e.equipment.every(q => available.has(q)) || rows.some(r => r.exerciseId === e.id)));
  const update = (key: number, patch: Partial<Row>) => setRows(all => all.map(r => r.key === key ? { ...r, ...patch } : r));
  const add = () => { const next = choices.find(e => !rows.some(r => r.exerciseId === e.id)); if (next) setRows(all => [...all, { key: Date.now(), exerciseId: next.id, sets: 3, reps: 10, weight: 0, restSeconds: 60 }]); };
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!rows.length) { notify(tt.noExercisesYet, true); return; }
    setBusy(true);
    // Consecutive linked rows share a superset letter (A, B, ...), max 4 per group.
    const groups: (string | null)[] = []; let letter = -1, size = 0;
    rows.forEach((r, i) => { const linkedFromPrev = i > 0 && rows[i - 1].linkNext && size < 4; if (linkedFromPrev) { groups[i - 1] ??= String.fromCharCode(65 + letter); groups[i] = String.fromCharCode(65 + letter); size++; } else { groups[i] = null; if (r.linkNext && i < rows.length - 1) { letter++; size = 1; } } });
    try { await start({ name: title.trim(), exercises: rows.map((r, i) => ({ exerciseId: r.exerciseId, sets: r.sets, reps: r.reps, restSeconds: r.restSeconds, targetKg: Math.round((unit === 'lb' ? r.weight * 0.45359237 : r.weight) * 10) / 10, supersetGroup: groups[i] ?? null })) }); }
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

function FollowBuilder({ library, name, location, start, preset }: { library: Exercise[]; name: (e: Exercise) => string; location: Location; start: (body: unknown) => Promise<void>; preset?: Extract<TrainPreset, { mode: 'follow' }> }) {
  const { data, notify } = useApp(); const { t } = useLanguage(); const tt = useTrainingLanguage();
  const gt = useGameLanguage();
  const profileEquipment = LOCATION_EQUIPMENT[location];
  const [minutes, setMinutes] = useState<number | 'custom'>(preset?.minutes ?? 10); const [custom, setCustom] = useState(12);
  const [focus, setFocus] = useState(preset?.focus ?? 'all'); const [difficulty, setDifficulty] = useState(data.profile?.experience ?? 'beginner');
  const [equipment, setEquipment] = useState<string[]>(profileEquipment);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  useEffect(() => { setEquipment(LOCATION_EQUIPMENT[location]); trainingApi<Recommendation>(`recommendation?location=${location}`).then(setRecommendation).catch(() => setRecommendation(null)); }, [location]); const [avoid, setAvoid] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false); const [preview, setPreview] = useState<Routine | null>(null);
  const [explanation, setExplanation] = useState(''); const [busy, setBusy] = useState(false);
  const muscles = useMemo(() => [...new Set(library.flatMap(e => e.primaryMuscles ?? []))].sort(), [library]);
  const groupName = (g: string) => tt.focusGroups[g as keyof typeof tt.focusGroups] ?? tt.muscleNames[g as keyof typeof tt.muscleNames] ?? g;
  const focusLabel = groupName(focus);
  const seconds = (minutes === 'custom' ? custom : minutes) * 60;
  const body = { seconds, focus, difficulty, equipment, avoid, excludedIds: [], location, reviewedConstraints: reviewed };
  const byId = (id: string | null) => library.find(e => e.id === id);
  useEffect(() => { setPreview(null); setExplanation(''); }, [seconds, focus, difficulty, equipment.join(), avoid.join(), reviewed, location]);
  const applyRecommendation = (r: Recommendation) => { setFocus(r.focus); setDifficulty(r.difficulty); if (PRESETS.includes(r.suggestedMinutes)) setMinutes(r.suggestedMinutes); else { setMinutes('custom'); setCustom(r.suggestedMinutes); } };
  const reasonText = (r: Recommendation['reasons'][number]) => fill(tt.reasons[r.code as keyof typeof tt.reasons] ?? r.code, { group: r.group ? groupName(r.group) : '', hours: r.hours ?? '', muscles: (r.muscles ?? []).map(groupName).join(', ') });
  async function run(kind: 'preview' | 'start') {
    if (!reviewed) return; setBusy(true); setExplanation('');
    try { if (kind === 'preview') setPreview(await trainingApi<Routine>('preview', body)); else await start(body); }
    catch (error) { setPreview(null); const text = explainSequenceError(error, tt, focusLabel); setExplanation(text); if (!text) notify(trainingErrorText(error, t, tt), true); }
    finally { setBusy(false); }
  }
  const toggle = (list: string[], set: (v: string[]) => void, value: string) => set(list.includes(value) ? list.filter(x => x !== value) : [...list, value]);
  const kinds = ['warmup', 'exercise', 'rest', 'transition', 'cooldown'] as const;
  return <div className="follow-builder">
    {recommendation && <section className={`panel recommendation ${recommendation.kind}`} aria-label={tt.recommended}>
      <div className="recommendation-head"><BeeMessage state={recommendation.kind === 'recovery' ? 'sleepy' : recommendation.newUser ? 'waving' : 'encouraging'} size={64} text={recommendation.kind === 'recovery' ? gt.mascot.restDay : gt.mascot.workoutReady}/></div>
      <div className="recommendation-body"><div>
        <span className="overline">{recommendation.kind === 'recovery' ? tt.recommendedRecovery : tt.recommended}</span>
        <h2>{groupName(recommendation.focus)} · {recommendation.suggestedMinutes} {tt.minutes} · {tt.levels[recommendation.difficulty]}</h2>
        <ul className="reason-list">{recommendation.reasons.map((r, i) => <li key={i}>{reasonText(r)}</li>)}</ul>
        <button type="button" className="button secondary" onClick={() => applyRecommendation(recommendation)}>{tt.useRecommendation}</button>
        <p className="muted small">{tt.overrideNote}</p></div>
        <div className="activity-map"><h3>{tt.recentActivity}</h3><MuscleMap primary={recommendation.muscles.filter(m => m.level === 'high').map(m => m.muscle)} secondary={recommendation.muscles.filter(m => m.level === 'moderate' || m.level === 'low').map(m => m.muscle)} legend={[tt.activityHigh, tt.activityModerate]}/><p className="muted small">{tt.loadNote}</p></div>
      </div></section>}
    <form className="panel form-stack" onSubmit={e => { e.preventDefault(); void run('preview'); }}>
      <fieldset><legend>{tt.duration}</legend><div className="filter-row">{PRESETS.map(m => <button type="button" key={m} className={`filter ${minutes === m ? 'selected' : ''}`} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} {tt.minutes}</button>)}
        <button type="button" className={`filter ${minutes === 'custom' ? 'selected' : ''}`} aria-pressed={minutes === 'custom'} onClick={() => setMinutes('custom')}>{tt.custom}</button></div>
        {minutes === 'custom' && <label>{tt.customMinutes}<input type="number" min={1} max={60} value={custom} onChange={e => setCustom(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}/></label>}</fieldset>
      <div className="form-grid">
        <label>{tt.focus}<select value={focus} onChange={e => setFocus(e.target.value)}>{GROUPS.map(g => <option key={g} value={g}>{groupName(g)}</option>)}<option disabled>──────</option>{muscles.map(m => <option key={m} value={m}>{tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m}</option>)}</select></label>
        <label>{tt.difficulty}<select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)}>{(['beginner', 'intermediate', 'advanced'] as const).map(l => <option key={l} value={l}>{tt.levels[l]}</option>)}</select></label>
      </div>
      <p className="muted small">{tt.levelCapped}</p>
      <fieldset><legend>{tt.equipment}</legend><div className="check-grid">{profileEquipment.map(item => <label key={item} className="check"><input type="checkbox" checked={equipment.includes(item)} onChange={() => toggle(equipment, setEquipment, item)}/>{t.equipmentLabels[item as keyof typeof t.equipmentLabels] ?? item}</label>)}</div></fieldset>
      <fieldset><legend>{tt.constraints}</legend><div className="check-grid">{AVOID.map(item => <label key={item} className="check"><input type="checkbox" checked={avoid.includes(item)} onChange={() => toggle(avoid, setAvoid, item)}/>{tt.constraintLabels[item]}</label>)}</div></fieldset>
      <label className="check"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>{tt.reviewed}</label>
      <div className="form-footer"><button className="button secondary" disabled={busy || !reviewed || !equipment.length}><Eye size={18}/>{tt.preview}</button></div>
      {explanation && <p className="explain-box" role="alert">{explanation}</p>}
    </form>
    {preview && <section className="panel routine-preview" aria-label={tt.previewTitle}>
      <h2>{tt.previewTitle}</h2>
      <p className="budget-line"><strong>{fill(tt.budgetLine, { total: clock(preview.totalSeconds), budget: clock(preview.budgetSeconds) })}</strong> · {preview.exerciseCount} {tt.exercisesCount} · {preview.rounds} {tt.rounds}</p>
      {preview.summary && <div className="phase-bar" aria-hidden="true">{kinds.map(k => <span key={k} className={`seg ${k}`} style={{ flexGrow: preview.summary![k] }}/>)}</div>}
      {preview.summary && <ul className="phase-legend">{kinds.map(k => <li key={k}><i className={`seg ${k}`}/>{tt.phaseLabels[k]} {clock(preview.summary![k])}</li>)}</ul>}
      <ol className="phase-list">{preview.phases.map((p, i) => { const e = byId(p.exerciseId); return <li key={i} className={`phase ${p.kind}`}><span className="phase-kind">{tt.phaseLabels[p.kind]}</span><span className="phase-name">{p.kind === 'rest' ? '' : e ? name(e) : ''}{p.kind === 'exercise' && <small> · {p.tracking === 'reps' ? fill(tt.repTarget, { reps: p.reps, s: p.seconds }) : fill(tt.timedTarget, { s: p.seconds })}</small>}</span><span className="phase-time">{clock(p.seconds)}</span></li>; })}</ol>
      <p className="muted small">{tt.creditRule}</p>
      <button className="button primary" disabled={busy} onClick={() => void run('start')}><Play size={18}/>{tt.startFollow}</button>
    </section>}
  </div>;
}
