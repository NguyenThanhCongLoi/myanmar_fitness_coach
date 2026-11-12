'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, List, Minus, Pause, Play, Plus, SkipForward, X } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { actionId, api, localExercise, trainingApi, weightValue } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { track } from '@/shared/analytics';
import { buzz, useWakeLock } from '@/shared/wake-lock';
import type { Exercise, Workout } from '@/shared/types';
import { Modal } from '@/shared/ui';
import { SessionSummary } from '../training/session-summary';
import { trainingErrorText } from '../training/training-hub';
import { useWorkoutAudio } from './workout-audio';
import { MuscleMap } from '../exercises/muscle-map';
import { hasApprovedVideo } from '../exercises/exercise-media';
import { getLocation, pctColor } from './plan-view';

// Guided, one-set-per-screen player for logged sessions: big media, one main button, full-screen rest, one-tap quit reasons.
type Step = { pid: string; exercise: Exercise; setIndex: number; sets: number; target: number; rest: number; timed: boolean; weightKg: number };
const QUIT = ['later', 'looking', 'too_hard', 'too_easy', 'unclear', 'pain', 'other'] as const;

export function GuidedPlayer({ sessionId, listView }: { sessionId: string; listView: () => void }) {
  const { data, refresh, notify, go } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux;
  const [s, setS] = useState<Workout | null>(null); const [library, setLibrary] = useState<Exercise[]>([]);
  const [phase, setPhase] = useState<'ready' | 'work' | 'rest' | 'summary' | 'feedback' | 'result'>('ready');
  const [result, setResult] = useState<{ change: 'up' | 'same' | 'down'; reason: string; pct: number | null; difficulty: string | null } | null>(null);
  const [count, setCount] = useState(10); const [restLeft, setRestLeft] = useState(0); const [restTotal, setRestTotal] = useState(0);
  const [reps, setReps] = useState(10); const [kg, setKg] = useState(0); const [timer, setTimer] = useState(0); const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false); const [quit, setQuit] = useState(false); const [skipped, setSkipped] = useState<string[]>([]);
  const [technique, setTechnique] = useState<'good' | 'needs_work' | 'unknown'>('unknown');
  const [rir, setRir] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const audio = useWorkoutAudio(visible && !quit && ['ready','work','rest'].includes(phase));
  useEffect(() => { const changed = () => { setVisible(!document.hidden); if (document.hidden) setRunning(false); }; document.addEventListener('visibilitychange', changed); return () => document.removeEventListener('visibilitychange', changed); }, []);
  const unit = data.profile?.weightUnit ?? 'kg';
  useWakeLock(phase === 'work' || phase === 'rest' || phase === 'ready');
  const load = async () => setS(await trainingApi<Workout>(`sessions/${sessionId}`));
  useEffect(() => { void load(); trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, [sessionId]);
  const steps: Step[] = useMemo(() => {
    if (!s?.prescriptions) return [];
    return s.prescriptions.filter(p => !p.skipped && !skipped.includes(p.id)).flatMap(p => Array.from({ length: p.sets }, (_, setIndex) => ({
      pid: p.id, exercise: library.find(e => e.id === p.exerciseId) ?? (p.exercise as Exercise), setIndex, sets: p.sets, target: p.reps, rest: p.restSeconds,
      timed: !!(p as { timed?: boolean }).timed || (library.find(e => e.id === p.exerciseId)?.tracking ?? '') === 'time', weightKg: p.targetKg })))
      .filter(st => !s.sets.some(x => x.exerciseId === st.exercise.id && x.setIndex === st.setIndex));
  }, [s, library, skipped]);
  const cur = steps[0], next = steps[1];
  useEffect(() => { if (!cur) return; if (phase === 'ready') audio.say(count === 10 ? tt.adaptive.countReady : String(count)); else if (phase === 'rest') audio.say(tt.adaptive.rest); else if (phase === 'work') audio.say(tt.adaptive.start); }, [phase, count, quit, visible, !!cur]);
  const totalSets = s?.prescriptions?.filter(p => !p.skipped).reduce((n, p) => n + p.sets, 0) ?? 1, doneSets = s?.sets.length ?? 0;
  const nm = (e?: Exercise) => (e ? localExercise(e, locale).name.split('—')[0].trim() : '');
  // reset inputs for each new set
  useEffect(() => { if (!cur) return; setReps(cur.target); setKg(Number(weightValue(cur.weightKg, unit).toFixed(1))); setTimer(cur.target); setRunning(false); setRir(null); }, [cur?.pid, cur?.setIndex]);
  // countdown before the first set
  useEffect(() => { if (phase !== 'ready' || quit || !visible || !cur) return; if (count <= 0) { setPhase('work'); return; } const id = setTimeout(() => setCount(c => c - 1), 1000); return () => clearTimeout(id); }, [phase, count, quit, visible, !!cur]);
  // rest timer
  useEffect(() => { if (phase !== 'rest' || quit || !visible) return; if (restLeft <= 0) { buzz(60); setPhase('work'); return; } const id = setTimeout(() => setRestLeft(r => r - 1), 1000); return () => clearTimeout(id); }, [phase, restLeft, quit, visible]);
  // timed sets count down automatically
  // Timers pause while the quit sheet is open (nothing is logged behind the user's back).
  useEffect(() => { if (phase !== 'work' || !cur?.timed || !running || quit || !visible) return; if (timer <= 0) { void logSet(); return; } const id = setTimeout(() => setTimer(v => v - 1), 1000); return () => clearTimeout(id); }, [phase, running, timer, cur?.timed, quit, visible]);
  useEffect(() => { if (phase === 'work' && cur?.timed) setRunning(true); }, [phase, cur?.pid, cur?.setIndex]);
  // end automatically when nothing is left
  useEffect(() => { if (s && library.length && !steps.length && (phase === 'work' || phase === 'rest') && s.sets.length) void finish(); }, [steps.length, phase]);

  async function logSet() {
    if (!cur || busy) return; setBusy(true); setRunning(false);
    try {
      await api(`sessions/${sessionId}/sets`, { exerciseId: cur.exercise.id, setIndex: cur.setIndex, reps: cur.timed ? 1 : reps, weight: cur.timed ? 0 : kg, unit, restSeconds: Math.max(10, cur.rest), ...(rir !== null && !cur.timed ? { rir } : {}), ...(cur.timed ? { seconds: cur.target - timer } : {}) });
      buzz(30); await load();
      if (steps.length > 1) { setRestTotal(cur.rest); setRestLeft(cur.rest); setPhase('rest'); }
    } catch (e) { notify(trainingErrorText(e, t, tt)); } finally { setBusy(false); }
  }
  async function finish(reason = '') {
    setBusy(true);
    try { const r = await api<{ reward: { awarded: boolean; xp: number; streak?: number } }>(`sessions/${sessionId}/finish`, { note: reason ? `quit:${reason}` : '' }); void r; await refresh(); await load(); setPhase('summary'); }
    catch (e) { notify(trainingErrorText(e, t, tt)); } finally { setBusy(false); }
  }
  async function quitWith(reason: typeof QUIT[number]) {
    track({ name: 'workout_quit', props: { reason } }); setQuit(false);
    if ((s?.sets.length ?? 0) > 0) { await finish(reason); if (reason === 'pain' || reason === 'too_hard') { try { await trainingApi(`sessions/${sessionId}/feedback`, { difficulty: 'too_hard', pain: reason === 'pain', technique: 'unknown' }); } catch { notify(tt.adaptive.audioError); } } return; }
    try { await trainingApi(`sessions/${sessionId}/action`, { actionId: actionId(), revision: s?.revision ?? 0, kind: 'abandon', confirm: true, reason }); } catch (e) { notify(trainingErrorText(e, t, tt)); return; }
    await refresh(); go('home');
  }
  async function feedback(difficulty: 'too_easy' | 'right' | 'too_hard', pain: boolean) {
    setBusy(true);
    try { await trainingApi(`sessions/${sessionId}/feedback`, { difficulty, pain, technique }); } catch (e) { notify(trainingErrorText(e, t, tt)); setBusy(false); return; }
    // the plan re-evaluates this session: heavier / same / lighter, with the reason
    try { const p = await trainingApi<{ lastAdapt: { sessionId: string; change: 'up' | 'same' | 'down'; reason: string; pct: number | null; difficulty: string | null } | null }>(`plan?location=${getLocation()}`);
      if (p.lastAdapt?.sessionId === sessionId) { setResult(p.lastAdapt); setPhase('result'); return; } } catch { /* not a programme session */ }
    setBusy(false); go('home');
  }
  if (!s || !library.length) return <section className="player"><div className="sk sk-hero"/></section>;
  if (phase === 'summary') return <SessionSummary session={s} library={library} onContinue={() => setPhase('feedback')}/>;
  if (phase === 'result' && result) return <section className="panel session-result"><h2>{u.resultTitle}</h2>
    <div className="result-pct" style={{ ['--p' as string]: `${result.pct ?? 100}%`, ['--c' as string]: pctColor(result.pct ?? 100) }}><strong>{result.pct ?? 100}%</strong><small>{u.completed}</small></div>
    <p className={`change-note ${result.change}`}>{u.adaptReason[result.reason as keyof typeof u.adaptReason]} {u.adaptChange[result.change]}</p>
    <button type="button" className="button primary big-start" onClick={() => go('home')}>{u.backToPlan}</button></section>;
  if (phase === 'feedback') return <section className="panel quick-feedback"><h2>{u.howWasIt}</h2>
    <fieldset><legend>{tt.adaptive.technique}</legend><div className="adaptive-actions">{(['good','needs_work','unknown'] as const).map(k => <button type="button" className={`button ${technique === k ? 'primary' : 'secondary'}`} aria-pressed={technique === k} key={k} onClick={() => setTechnique(k)}>{k === 'good' ? tt.adaptive.good : k === 'needs_work' ? tt.adaptive.needsWork : tt.adaptive.unknown}</button>)}</div></fieldset>
    <div className="feedback-faces">{(['too_easy', 'right', 'too_hard'] as const).map(d => <button key={d} type="button" className="quiz-option" disabled={busy} onClick={() => void feedback(d, false)}><strong>{u.difficulty[d]}</strong></button>)}</div>
    <button type="button" className="button secondary" disabled={busy} onClick={() => void feedback('right', true)}>{u.hadPain}</button>
    <button type="button" className="text-button" onClick={() => go('home')}>{u.skip}</button></section>;
  const media = (e: Exercise) => hasApprovedVideo(e)
    ? <video key={e.videoUrl} src={e.videoUrl!} poster={e.thumbnailUrl ?? undefined} autoPlay muted loop playsInline preload="auto"/>
    : <div className="player-poster" style={e.thumbnailUrl || e.steps?.find(s => s.image)?.image ? { backgroundImage: `url(${e.thumbnailUrl || e.steps?.find(s => s.image)?.image})` } : undefined}>{!e.thumbnailUrl && !e.steps?.some(s => s.image) && <MuscleMap primary={e.primaryMuscles ?? []} secondary={e.secondaryMuscles ?? []}/>}</div>;
  return <section className={`player phase-${phase}`}>
    <div className="player-bar">
      <button type="button" className="icon-button" aria-label={u.quit} onClick={() => setQuit(true)}><X size={22}/></button>
      <div className="player-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}><i style={{ width: `${doneSets / totalSets * 100}%` }}/></div>
      <button type="button" className="icon-button" aria-label={u.listView} onClick={listView}><List size={20}/></button>
    </div>
    {audio.controls}
    {cur && <details className="player-credit"><summary>{tt.creditsTitle}</summary><small>{cur.exercise.mediaSource || tt.noVideo}</small></details>}
    {phase === 'ready' && cur && <div className="player-ready"><div className="player-media">{media(cur.exercise)}</div><p>{u.getReady}</p><strong className="big-count">{count}</strong><h2>{nm(cur.exercise)}</h2>
      <button type="button" className="text-button" onClick={() => setPhase('work')}>{u.startNow}</button></div>}
    {phase === 'work' && cur && <div className="player-work">
      <div className="player-media">{media(cur.exercise)}</div>
      <div className="player-info"><small>{u.setOf.replace('{a}', String(cur.setIndex + 1)).replace('{b}', String(cur.sets))}</small><h2>{nm(cur.exercise)}</h2></div>
      {!cur.timed && cur.setIndex === 0 && <SetupCard exercise={cur.exercise} locale={locale} title={u.setupTitle}/>}
      {cur.timed ? <div className="player-timer"><strong>{timer}<small>s</small></strong>
        <button type="button" className="button secondary" onClick={() => setRunning(r => !r)}>{running ? <><Pause size={18}/>{u.pause}</> : <><Play size={18}/>{u.resumeTimer}</>}</button></div>
        : <div className="player-inputs">
          <div className="stepper-field"><small>{u.reps}</small><div><button type="button" onClick={() => setReps(Math.max(1, reps - 1))} aria-label="−"><Minus size={20}/></button><strong>{reps}</strong><button type="button" onClick={() => setReps(Math.min(100, reps + 1))} aria-label="+"><Plus size={20}/></button></div></div>
          {cur.exercise.equipment.some(q => q !== 'body weight') && <div className="stepper-field"><small>{tt.weight} ({unit})</small><div><button type="button" onClick={() => setKg(Math.max(0, +(kg - 2.5).toFixed(1)))} aria-label="−"><Minus size={20}/></button><strong>{kg}</strong><button type="button" onClick={() => setKg(+(kg + 2.5).toFixed(1))} aria-label="+"><Plus size={20}/></button></div></div>}
        </div>}
      {!cur.timed && <label className="rir-choice">{tt.adaptive.rir}<select value={rir ?? ''} onChange={e => setRir(e.target.value === '' ? null : Number(e.target.value))}><option value="">{tt.adaptive.unknown}</option>{[0,1,2,3,4,5].map(n => <option value={n} key={n}>{n}</option>)}</select></label>}
      <div className="player-actions">
        {!cur.timed && <button type="button" className="button primary big-start" disabled={busy} onClick={() => void logSet()}><Check size={22}/>{u.doneSet}</button>}
        <button type="button" className="text-button" onClick={() => setSkipped(x => [...x, cur.pid])}><SkipForward size={16}/>{u.skipExercise}</button>
      </div>
      {next && <p className="up-next">{u.next}: {nm(next.exercise)}</p>}
    </div>}
    {phase === 'rest' && <div className="player-rest">
      <p>{u.rest}</p>
      <div className="rest-big" style={{ ['--p' as string]: `${restTotal ? (restLeft / restTotal) * 100 : 0}%` }}><strong>{restLeft}</strong><small>s</small></div>
      <div className="rest-actions"><button type="button" className="button secondary" onClick={() => { setRestLeft(r => r + 10); setRestTotal(v => v + 10); }}>+10s</button>
        <button type="button" className="button primary" onClick={() => setPhase('work')}><SkipForward size={18}/>{u.skipRest}</button></div>
      {cur && <div className="rest-next"><span className="ex-thumb" style={cur.exercise.thumbnailUrl ? { backgroundImage: `url(${cur.exercise.thumbnailUrl})` } : undefined}/><span><small>{u.next}</small><strong>{nm(cur.exercise)}</strong><small>{u.setOf.replace('{a}', String(cur.setIndex + 1)).replace('{b}', String(cur.sets))}</small></span></div>}
    </div>}
    {quit && <Modal title={u.quitTitle} close={() => setQuit(false)}>
      <p className="muted">{u.quitHint}</p>
      <div className="quit-reasons">{QUIT.map(r => <button key={r} type="button" className="quiz-option" onClick={() => void quitWith(r)}><strong>{u.quitReasons[r]}</strong></button>)}</div>
      <button type="button" className="button primary" onClick={() => setQuit(false)}>{u.keepGoing}</button>
    </Modal>}
  </section>;
}

// Gym: how to set up the machine and body before the first set (seat, grip, posture), with step images.
function SetupCard({ exercise, locale, title }: { exercise: Exercise; locale: string; title: string }) {
  const my = locale === 'my-MM';
  const cues = (exercise.guidance?.gym ?? []).map(c => (my ? c.my ?? c.en : c.en)).slice(0, 3);
  const pics = (exercise.steps ?? []).filter(st => st.image).slice(0, 3);
  if (!cues.length && !pics.length) return null;
  return <details className="setup-card" open><summary>{title}</summary>
    {pics.length > 0 && <div className="setup-pics">{pics.map((st, i) => <img key={i} src={st.image!} alt={my ? st.my ?? st.en : st.en} loading="lazy"/>)}</div>}
    <ol>{cues.map(c => <li key={c}>{c}</li>)}</ol></details>;
}
