'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Check, CheckCircle2, Clock3 } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api, localExercise, weightValue } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import type { Prescription, Workout, WorkoutSet } from '@/shared/types';

export function SessionView({ sessionId }: { sessionId: string }) {
  const { notify, data, refresh, go,celebrate } = useApp(); const { t, locale } = useLanguage();
  const [session, setSession] = useState<Workout | null>(null); const [note, setNote] = useState(''); const [rest, setRest] = useState(0); const [finishing, setFinishing] = useState(false);
  const unit = data.profile?.weightUnit ?? 'kg';
  async function load() { try { setSession(await api<Workout>(`sessions/${sessionId}`)); } catch (error) { notify(errorText(error, t), true); } }
  useEffect(() => { void load(); }, [sessionId]);
  useEffect(() => { if (!rest) return; const timer = setInterval(() => setRest(value => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [rest > 0]);
  async function finish() {
    setFinishing(true);
    try { const result=await api<{reward:{awarded:boolean;xp:number;streak?:number}}>(`sessions/${sessionId}/finish`, { note }); await refresh(); celebrate(result.reward); go('home'); }
    catch (error) { notify(errorText(error, t), true); } finally { setFinishing(false); }
  }
  if (!session) return <p className="loading-inline">{t.loading}</p>;
  return <section><div className="page-heading heading-with-action"><div><span className="overline">{t.workoutInProgress}</span><h1>{session.plan.name}</h1><p>{session.day.name}</p></div><span className="status-pill"><span/>{session.sets.length} {t.loggedSets}</span></div>{rest > 0 && <div className="rest-banner" role="status"><Clock3 size={20}/><span>{t.rest}</span><strong>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</strong><button className="text-button" onClick={() => setRest(0)}>{t.close}</button></div>}<div className="session-exercises">{session.day.exercises.map(prescription => <article className="panel session-exercise" key={prescription.id}><div className="session-exercise-heading"><span className="exercise-number">{String(prescription.order + 1).padStart(2, '0')}</span><div><h2>{localExercise(prescription.exercise, locale).name}</h2><p className="muted small">{prescription.sets} {t.sets} × {prescription.reps} {t.reps} · {prescription.restSeconds}s {t.rest}</p></div></div><div className="set-table-heading"><span>{t.sets}</span><span>{t.reps}</span><span>{t.weight} ({unit})</span><span/></div>{Array.from({ length: prescription.sets }, (_, index) => <SetRow key={`${prescription.id}-${index}`} sessionId={sessionId} prescription={prescription} index={index} unit={unit} saved={session.sets.find(item => item.exerciseId === prescription.exerciseId && item.setIndex === index)} completed={session.status === 'completed'} onSaved={async () => { await load(); setRest(prescription.restSeconds); }}/>)}</article>)}</div><div className="panel session-finish"><label>{t.note}<textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={1000}/></label><div className="form-footer"><span className="muted small">{!session.sets.length ? t.finishHint : `${session.sets.length} ${t.loggedSets}`}</span><button className="button primary" onClick={() => void finish()} disabled={!session.sets.length || finishing || session.status === 'completed'}><CheckCircle2 size={18}/>{finishing ? t.working : t.finish}</button></div></div></section>;
}

function SetRow({ sessionId, prescription, index, saved, unit, onSaved, completed }: { sessionId: string; prescription: Prescription; index: number; saved?: WorkoutSet; unit: 'kg' | 'lb'; onSaved: () => Promise<void>; completed: boolean }) {
  const { t } = useLanguage(); const { notify } = useApp();
  const [reps, setReps] = useState(saved?.reps ?? prescription.reps); const [weight, setWeight] = useState(saved ? weightValue(saved.weightKg, unit) : weightValue(prescription.targetKg, unit)); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api(`sessions/${sessionId}/sets`, { exerciseId: prescription.exerciseId, setIndex: index, reps, weight, unit, restSeconds: prescription.restSeconds }); await onSaved(); }
    catch (error) { notify(errorText(error, t), true); } finally { setBusy(false); }
  }
  return <form className={`set-row ${saved ? 'logged' : ''}`} onSubmit={submit}><strong>{String(index + 1).padStart(2, '0')}</strong><input aria-label={`${prescription.exercise.name} ${t.reps} ${index + 1}`} type="number" min={1} max={100} required value={reps} disabled={!!saved || completed} onChange={event => setReps(Number(event.target.value))}/><input aria-label={`${prescription.exercise.name} ${t.weight} ${index + 1}`} type="number" min={0} max={unit === 'kg' ? 400 : 880} step="0.1" required value={Number(weight.toFixed(1))} disabled={!!saved || completed} onChange={event => setWeight(Number(event.target.value))}/><button className={`button ${saved ? 'logged-button' : 'secondary'}`} disabled={busy || !!saved || completed} aria-label={`${saved ? t.saved : t.logSet} ${index + 1}`}><Check size={17}/><span>{busy ? t.working : saved ? t.saved : t.logSet}</span></button></form>;
}
