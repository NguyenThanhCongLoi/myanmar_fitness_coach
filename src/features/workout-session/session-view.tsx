'use client';
import { useCallback, useEffect, useState, type FormEvent, useRef } from 'react';
import { Check, CheckCircle2, Clock3, Pause, Play, Plus, Replace, SkipForward, Trash2 } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { actionId, api, localExercise, RequestError, trainingApi, weightValue } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import { clock, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise, Prescription, SessionPrescription, Workout, WorkoutSet } from '@/shared/types';
import { FollowPlayer } from '../training/follow-player';
import { trainingErrorText } from '../training/training-hub';
import { FeedbackForm } from '../training/feedback-form';
import { SessionSummary } from '../training/session-summary';
import { usePtCompanion } from '../training/pt-companion';
import type { Level } from '@/shared/dose';
import { BeeReaction } from '../gamification/mascot';
import type { MascotState } from '../gamification/mascot-manifest';
import { useGameLanguage } from '@/shared/game-language';
import { fill } from '@/shared/training-language';
import { buzz, useWakeLock } from '@/shared/wake-lock';
import { QuickSetLog } from '../training/quick-log';
import { WarmupPlates } from '../training/warmup-plates';

export function SessionView({ sessionId }: { sessionId: string }) {
  const { notify } = useApp(); const { t } = useLanguage();
  const [session, setSession] = useState<Workout | null>(null);
  const load = useCallback(async () => { try { const value = await trainingApi<Workout>(`sessions/${sessionId}`); setSession(value); return value; } catch (error) { notify(errorText(error, t), true); return null; } }, [sessionId]);
  useEffect(() => { setSession(null); void load(); }, [load]);
  if (!session) return <p className="loading-inline">{t.loading}</p>;
  if (session.mode === 'follow' && session.playerPlan) return <FollowPlayer key={session.id} initial={session} reload={load}/>;
  return <FreeSession session={session} setSession={setSession} load={load}/>;
}

function FreeSession({ session, setSession, load }: { session: Workout; setSession: (w: Workout) => void; load: () => Promise<Workout | null> }) {
  const { notify, data, refresh, go, celebrate } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage();
  const [note, setNote] = useState(''); const [finishing, setFinishing] = useState(false); const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0); const [now, setNow] = useState(() => Date.now()); const [hideRest, setHideRest] = useState('');
  const [library, setLibrary] = useState<Exercise[]>([]); const [adding, setAdding] = useState(false);
  const companion = usePtCompanion(); const [summary, setSummary] = useState(false);
  useWakeLock(session.status === "active");
  // Progressive overload targets from the user's previous completed sessions (this session excluded).
  const [progression, setProgression] = useState<Record<string, Progression>>({});
  const idsKey = (session.prescriptions ?? []).map(p => p.exerciseId).join(',');
  useEffect(() => { if (idsKey) trainingApi<Record<string, Progression>>(`progression?ids=${encodeURIComponent(idsKey)}&exclude=${session.id}`).then(setProgression).catch(() => {}); }, [idsKey]);
  const onPr = (pr: PrInfo) => { setReaction({ state: 'proud', text: fill(pr.type === 'e1rm' ? tt.prE1rm : tt.prReps, { value: pr.value }) }); void companion.say({ kind: 'pr' }); try { navigator.vibrate?.([80, 40, 120]); } catch { /* optional */ } };
  const gt = useGameLanguage(); const [reaction, setReaction] = useState<{ state: MascotState; text: string } | null>(null); const [feedback, setFeedback] = useState(false);
  useEffect(() => { try { const key = `bee-start-${session.id}`; if (live && !session.sets.length && !sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); setReaction({ state: 'encouraging', text: gt.mascot.workoutStarted }); } } catch { /* optional */ } }, [session.id]);
  const unit = data.profile?.weightUnit ?? 'kg';
  const live = session.status === 'active' || session.status === 'paused', paused = session.status === 'paused';
  useEffect(() => { if (session.serverNow) setOffset(new Date(session.serverNow).getTime() - Date.now()); }, [session.serverNow]);
  useEffect(() => { if (!live) return; const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, [live]);
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, []);
  useEffect(() => { const sync = () => { if (document.visibilityState === 'visible') void load(); }; document.addEventListener('visibilitychange', sync); return () => document.removeEventListener('visibilitychange', sync); }, [load]);
  const serverNow = now + offset;
  const restLeft = paused ? (session.restRemainingMs ?? 0) / 1000 : session.restUntil ? Math.max(0, (new Date(session.restUntil).getTime() - serverNow) / 1000) : 0;
  const elapsed = Math.max(0, ((session.endedAt ? new Date(session.endedAt).getTime() : paused && session.pausedAt ? new Date(session.pausedAt).getTime() : serverNow) - new Date(session.startedAt).getTime() - (session.totalPausedMs ?? 0)) / 1000);
  const managed = (session.prescriptions?.length ?? 0) > 0;
  const items: SessionPrescription[] = managed ? session.prescriptions! : session.day.exercises.map(p => ({ ...p, originalExerciseId: p.exerciseId, skipped: false }));

  async function act(kind: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try { setSession(await trainingApi<Workout>(`sessions/${session.id}/action`, { actionId: actionId(), revision: session.revision ?? 0, kind, ...extra })); }
    catch (error) { if (error instanceof RequestError && error.code === 'STALE_WORKOUT') await load(); notify(trainingErrorText(error, t, tt), true); }
    finally { setBusy(false); }
  }
  async function finish() {
    setFinishing(true);
    try { const result = await api<{ reward: { awarded: boolean; xp: number; streak?: number } }>(`sessions/${session.id}/finish`, { note }); await refresh(); celebrate(result.reward); await load(); void companion.say({ kind: 'finish' }); setSummary(true); }
    catch (error) { notify(trainingErrorText(error, t, tt), true); } finally { setFinishing(false); }
  }
  async function discard() { if (!confirm(tt.abandonConfirm)) return; await act('abandon', { confirm: true }); await refresh(); go('train'); }
  const name = (e: Exercise) => localExercise(e, locale).name;
  if (feedback) return <FeedbackForm sessionId={session.id} done={() => go('home')}/>;
  if (summary) return <SessionSummary session={session} library={library} onContinue={() => { setSummary(false); setFeedback(true); }}/>;
  return <section>{reaction && <BeeReaction state={reaction.state} text={reaction.text} onDone={() => setReaction(null)}/>}
    <div className="page-heading heading-with-action"><div><span className="overline">{live ? t.workoutInProgress : session.status === 'completed' ? t.completed : session.status} · {tt.freeMode}</span><h1>{session.plan.name}</h1>
      <p><Clock3 size={15}/> {tt.elapsed} {clock(elapsed)}</p></div>
      <div className="heading-actions">{live && companion.bar}<span className="status-pill"><span/>{session.sets.length} {t.loggedSets}</span>
        {live && (paused ? <button className="button primary" disabled={busy} onClick={() => void act('resume')}><Play size={17}/>{tt.resume}</button> : <button className="button secondary" disabled={busy} onClick={() => void act('pause')}><Pause size={17}/>{tt.pause}</button>)}</div></div>
    {paused && <div className="rest-banner" role="status"><Pause size={20}/><span>{tt.workoutPaused}</span></div>}
    {restLeft > 0 && hideRest !== session.restUntil && <div className="rest-banner rest-ring-banner" role="timer"><RestRing left={restLeft} total={items.find(p => session.sets.some(x => x.exerciseId === p.exerciseId))?.restSeconds ?? 60}/><span>{tt.restTimer}</span><strong>{clock(Math.ceil(restLeft))}</strong>{!paused && <button className="text-button" onClick={() => setHideRest(session.restUntil ?? '')}>{tt.skipRest}</button>}</div>}
    <div className="session-exercises">{items.map(prescription => {
      const logged = session.sets.filter(s => s.exerciseId === prescription.exerciseId);
      const original = library.find(e => e.id === prescription.originalExerciseId);
      const alternatives = (original?.alternatives ?? []).map(id => library.find(e => e.id === id)).filter((e): e is Exercise => !!e && !items.some(i => i.exerciseId === e.id));
      return <article className={`panel session-exercise ${prescription.skipped ? 'skipped' : ''} ${prescription.supersetGroup ? 'in-superset' : ''}`} key={prescription.id}>{prescription.supersetGroup && <p className="muted small"><span className="superset-chip">{fill(tt.supersetLabel, { g: prescription.supersetGroup })}</span>{tt.supersetHint}</p>}
        <div className="session-exercise-heading"><span className="exercise-number">{String(prescription.order + 1).padStart(2, '0')}</span><div><h2>{localExercise(prescription.exercise, locale).name}</h2><p className="muted small">{prescription.sets === 1 ? tt.ux.plural.set1 : tt.ux.plural.sets.replace('{n}', String(prescription.sets))} × {prescription.reps} {t.reps} · {prescription.restSeconds}s {t.rest}{prescription.skipped ? ` · ${tt.skipped}` : ''}</p></div></div>
        {live && !prescription.skipped && (progression[prescription.exerciseId]?.suggestion?.weightKg ?? prescription.targetKg) >= 20 && <WarmupPlates targetKg={progression[prescription.exerciseId]?.suggestion?.weightKg || prescription.targetKg} equipment={prescription.exercise.equipment}/>}
        {managed && live && !prescription.skipped && !logged.length && <div className="exercise-actions">
          <button className="text-button" disabled={busy} onClick={() => void act('skip', { prescriptionId: prescription.id })}><SkipForward size={16}/>{tt.skipExercise}</button>
          {alternatives.length > 0 && <label className="replace-select"><Replace size={16}/><span className="sr-only">{tt.replaceWith}</span><select aria-label={`${tt.replace} ${localExercise(prescription.exercise, locale).name}`} value="" disabled={busy} onChange={e => e.target.value && void act('replace', { prescriptionId: prescription.id, exerciseId: e.target.value })}><option value="">{tt.replace}…</option>{alternatives.map(a => <option key={a.id} value={a.id}>{name(a)}</option>)}</select></label>}
        </div>}
        {!prescription.skipped && <><div className="set-table-heading"><span>{t.sets}</span><span>{t.reps}</span><span>{t.weight} ({unit})</span><span/></div>
        {Array.from({ length: prescription.sets }, (_, index) => <SetRow key={`${prescription.id}-${prescription.exerciseId}-${index}`} sessionId={session.id} prescription={prescription} index={index} unit={unit} progression={progression[prescription.exerciseId]} onPr={onPr} saved={session.sets.find(item => item.exerciseId === prescription.exerciseId && item.setIndex === index)} disabled={!live || paused} onSaved={async () => { setHideRest(''); const next = await load(); if (!next) return;
          // PT companion: encourage after each set; when an exercise is complete, praise and announce the next one.
          if (next.sets.filter(s => s.exerciseId === prescription.exerciseId).length >= prescription.sets) {
            setReaction({ state: 'happy', text: gt.mascot.exerciseDone });
            const following = items.find(p => !p.skipped && p.order > prescription.order && next.sets.filter(s => s.exerciseId === p.exerciseId).length < p.sets);
            const ex = following ? library.find(e => e.id === following.exerciseId) : null;
            if (ex) void companion.say({ kind: 'next', exercise: ex, level: (data.profile?.experience ?? 'beginner') as Level }); else void companion.say({ kind: 'done' });
          } else void companion.say({ kind: 'motivate', n: next.sets.length }); }}/>)}</>}
      </article>;
    })}</div>
    {managed && live && !paused && <QuickSetLog session={session} onSaved={load}/>}
    {managed && live && (adding ? <AddExercise library={library.filter(e => !items.some(i => i.exerciseId === e.id) && !(e.tags ?? []).some(x => x === 'warmup' || x === 'cooldown'))} unit={unit} busy={busy} cancel={() => setAdding(false)} submit={async p => { await act('add', { prescription: p }); setAdding(false); }}/> : <button className="button secondary" disabled={busy || items.length >= 20} onClick={() => setAdding(true)}><Plus size={18}/>{tt.addToWorkout}</button>)}
    {session.status !== 'abandoned' && <div className="panel session-finish"><label>{t.note}<textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={1000} disabled={!live}/></label>
      <p className="muted small">{tt.creditRule}</p>
      <div className="form-footer"><span className="muted small">{!session.sets.length ? t.finishHint : `${session.sets.length} ${t.loggedSets}`}</span>
        {live && <button className="button ghost" disabled={busy} onClick={() => void discard()}><Trash2 size={17}/>{tt.discard}</button>}
        <button className="button primary" onClick={() => void finish()} disabled={!session.sets.length || finishing || !live}><CheckCircle2 size={18}/>{finishing ? t.working : t.finish}</button></div></div>}
  </section>;
}

function RestRing({ left, total }: { left: number; total: number }) {
  const done = left <= 0.5;
  useEffect(() => { if (Math.ceil(left) === 3) buzz(60); }, [Math.ceil(left)]);
  useEffect(() => () => { if (done) buzz([150, 80, 150]); }, []);
  const p = Math.max(0, Math.min(1, left / Math.max(1, total)));
  return <svg className="rest-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" strokeWidth="4"/><circle cx="18" cy="18" r="15" fill="none" stroke="var(--green)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${p * 94.2} 94.2`} transform="rotate(-90 18 18)"/></svg>;
}

function AddExercise({ library, unit, busy, cancel, submit }: { library: Exercise[]; unit: string; busy: boolean; cancel: () => void; submit: (p: { exerciseId: string; sets: number; reps: number; restSeconds: number; targetKg: number }) => Promise<void> }) {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [exerciseId, setExerciseId] = useState(library[0]?.id ?? ''); const [sets, setSets] = useState(3); const [reps, setReps] = useState(10); const [rest, setRest] = useState(60); const [weight, setWeight] = useState(0);
  return <form className="panel free-row" onSubmit={e => { e.preventDefault(); void submit({ exerciseId, sets, reps, restSeconds: rest, targetKg: Math.round((unit === 'lb' ? weight * 0.45359237 : weight) * 10) / 10 }); }}>
    <label className="wide">{tt.chooseExercise}<select value={exerciseId} onChange={e => setExerciseId(e.target.value)} required>{library.map(e => <option key={e.id} value={e.id}>{localExercise(e, locale).name}</option>)}</select></label>
    <label>{tt.sets}<input type="number" min={1} max={8} value={sets} onChange={e => setSets(Number(e.target.value))}/></label>
    <label>{tt.reps}<input type="number" min={1} max={50} value={reps} onChange={e => setReps(Number(e.target.value))}/></label>
    <label>{tt.weight} ({unit})<input type="number" min={0} step="0.5" value={weight} onChange={e => setWeight(Number(e.target.value))}/></label>
    <label>{tt.restSeconds}<input type="number" min={15} max={600} step={5} value={rest} onChange={e => setRest(Number(e.target.value))}/></label>
    <div className="form-footer wide"><button type="button" className="button ghost" onClick={cancel}>{tt.cancel}</button><button className="button primary" disabled={busy || !exerciseId}><Plus size={17}/>{tt.addExercise}</button></div>
  </form>;
}

export type Progression = { suggestion: { weightKg: number; reps: number; note: string; previous: { reps: number; weightKg: number }[] } | null; bestE1rm: number | null; bestReps: number | null };
type PrInfo = { type: 'e1rm' | 'reps'; value: number; previous: number | null };
function SetRow({ sessionId, prescription, index, saved, unit, onSaved, disabled, progression, onPr }: { sessionId: string; prescription: Prescription; index: number; saved?: WorkoutSet; unit: 'kg' | 'lb'; onSaved: () => Promise<void>; disabled: boolean; progression?: Progression; onPr: (pr: PrInfo) => void }) {
  const { t } = useLanguage(); const tt = useTrainingLanguage(); const { notify } = useApp();
  const [reps, setReps] = useState(saved?.reps ?? prescription.reps); const [weight, setWeight] = useState(saved ? weightValue(saved.weightKg, unit) : weightValue(prescription.targetKg, unit)); const [busy, setBusy] = useState(false);
  const [rir, setRir] = useState<number | null>(saved?.rir ?? null);
  const [kind, setKind] = useState<'normal' | 'warmup' | 'drop' | 'failure'>((saved?.kind as 'normal') ?? 'normal');
  const KINDS = ['normal', 'warmup', 'drop', 'failure'] as const;
  const s = progression?.suggestion; const prev = s?.previous[index] ?? s?.previous.at(-1);
  // Prefill from the progression target once it arrives (only for sets not yet logged).
  // ...but never after the user has edited the row (the suggestion can arrive late and used to overwrite typed reps)
  const touched = useRef(false);
  useEffect(() => { if (!saved && s && !touched.current) { setReps(s.reps); if (s.weightKg > 0) setWeight(weightValue(s.weightKg, unit)); } }, [s?.reps, s?.weightKg]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { const r = await api<{ pr: PrInfo | null }>(`sessions/${sessionId}/sets`, { exerciseId: prescription.exerciseId, setIndex: index, reps, weight: Math.round(weight * 10) / 10, unit, restSeconds: prescription.restSeconds, rir, kind }); await onSaved(); if (r.pr) onPr(r.pr); }
    catch (error) { notify(trainingErrorText(error, t, tt), true); } finally { setBusy(false); }
  }
  return <><div className="set-meta">{prev && <span className="prev-chip">{tt.previous}: {Number(weightValue(prev.weightKg, unit).toFixed(1))}{unit} × {prev.reps}</span>}{s && index === 0 && <span className={`target-chip ${s.note}`}>{tt.progressNotes[s.note as keyof typeof tt.progressNotes] ?? s.note}</span>}
    {!saved && !disabled && <span className="rir-chips" role="group" aria-label={tt.rirLabel}><small className="rir-caption">{tt.rirShort}</small>{[0, 1, 2, 3].map(v => <button type="button" key={v} className={rir === v ? 'on' : ''} aria-pressed={rir === v} onClick={() => setRir(rir === v ? null : v)} title={tt.rirHint}>{v === 3 ? '3+' : v}</button>)}</span>}</div>
  <form className={`set-row ${saved ? 'logged' : ''} kind-${kind}`} onSubmit={submit}><button type="button" className={`set-kind kind-${kind}`} disabled={!!saved || disabled} title={tt.setKinds[kind]} aria-label={`${tt.setKindLabel}: ${tt.setKinds[kind]}`} onClick={() => setKind(KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length])}>{kind === 'normal' ? String(index + 1).padStart(2, '0') : tt.setKindShort[kind]}</button><input aria-label={`${prescription.exercise.name} ${t.reps} ${index + 1}`} type="number" min={1} max={100} required value={reps} disabled={!!saved || disabled} onInput={() => { touched.current = true; }} onChange={event => setReps(Number(event.target.value))}/><input aria-label={`${prescription.exercise.name} ${t.weight} ${index + 1}`} type="number" min={0} max={unit === 'kg' ? 400 : 880} step="0.1" required value={Number(weight.toFixed(1))} disabled={!!saved || disabled} onChange={event => setWeight(Number(event.target.value))}/><button className={`button ${saved ? 'logged-button' : 'secondary'}`} disabled={busy || !!saved || disabled} aria-label={`${saved ? t.saved : t.logSet} ${index + 1}`}><Check size={17}/><span>{busy ? t.working : saved ? t.saved : t.logSet}</span></button></form></>;
}
