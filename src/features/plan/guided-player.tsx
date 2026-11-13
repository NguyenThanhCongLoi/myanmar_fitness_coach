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
import { useIntakeLanguage } from '@/shared/intake-language';
import { getLocation, pctColor } from './plan-view';

// Guided, one-set-per-screen player for logged sessions: big media, one main button, full-screen rest, one-tap quit reasons.
type Step = { pid: string; exercise: Exercise; setIndex: number; sets: number; target: number; rest: number; timed: boolean; weightKg: number };
const QUIT = ['later', 'looking', 'too_hard', 'too_easy', 'unclear', 'pain', 'other'] as const;

export function GuidedPlayer({ sessionId, listView }: { sessionId: string; listView: () => void }) {
  const { data, refresh, notify, go } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux; const copy = useIntakeLanguage();
  const [s, setS] = useState<Workout | null>(null); const [library, setLibrary] = useState<Exercise[]>([]);
  const [phase, setPhase] = useState<'ready' | 'work' | 'rest' | 'summary' | 'feedback' | 'result'>('ready');
  const [result, setResult] = useState<{ change: 'up' | 'same' | 'down'; reason: string; pct: number | null; difficulty: string | null } | null>(null);
  const [count, setCount] = useState(10); const [restLeft, setRestLeft] = useState(0); const [restTotal, setRestTotal] = useState(0);
  const [reps, setReps] = useState(10); const [kg, setKg] = useState(0); const [timer, setTimer] = useState(0); const [running, setRunning] = useState(false);
  const busyRef = useRef(false), finishing = useRef(false);
  const [editLoad,setEditLoad] = useState(false);
  const [paused,setPaused] = useState(false), [gymElapsed,setGymElapsed] = useState(0);
  const [busy, setBusy] = useState(false); const [quit, setQuit] = useState(false); const [skipped, setSkipped] = useState<string[]>([]);
  const [technique, setTechnique] = useState<'good' | 'needs_work' | 'unknown'>('unknown');
  const [rir, setRir] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const audio = useWorkoutAudio(visible && !quit && !paused && ['ready','work','rest'].includes(phase));
  useEffect(() => { const changed = () => { setVisible(!document.hidden); if (document.hidden) { setRunning(false); setPaused(true); } }; document.addEventListener('visibilitychange', changed); return () => document.removeEventListener('visibilitychange', changed); }, []);
  const unit = data.profile?.weightUnit ?? 'kg';
  const experienced = data.profile?.experience === 'advanced' || data.profile?.experience === 'intermediate';
  useWakeLock(phase === 'work' || phase === 'rest' || phase === 'ready');
  const load = async () => setS(await trainingApi<Workout>(`sessions/${sessionId}`));
  useEffect(() => { void load(); trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, [sessionId]);
  const steps: Step[] = useMemo(() => {
    if (!s?.prescriptions) return [];
    const live = s.prescriptions.filter(p => !p.skipped && !skipped.includes(p.id));
    const one = (p: typeof live[number], setIndex: number) => ({
      pid: p.id, exercise: library.find(e => e.id === p.exerciseId) ?? (p.exercise as Exercise), setIndex, sets: p.sets, target: p.reps, rest: p.restSeconds,
      timed: !!(p as { timed?: boolean }).timed || ['time', 'timed'].includes(library.find(e => e.id === p.exerciseId)?.tracking ?? ''), weightKg: p.targetKg });
    // Timed (home) sessions run as circuits: every exercise once, then the next round. Gym keeps straight sets.
    const circuit = live.length > 1 && live.every(p => (p as { timed?: boolean }).timed);
    const rounds = Math.max(0, ...live.map(p => circuit && p.exerciseId === 'curated-bird-dog' ? Math.ceil(p.sets/2) : p.sets));
    const order = circuit ? Array.from({ length: rounds }, (_, r) => live.flatMap(p => p.exerciseId === 'curated-bird-dog' ? [r*2,r*2+1].filter(index=>index<p.sets).map(index=>one(p,index)) : r<p.sets ? [one(p,r)] : [])).flat() : live.flatMap(p => Array.from({ length: p.sets }, (_, i) => one(p, i)));
    return order.filter(st => !s.sets.some(x => x.exerciseId === st.exercise.id && x.setIndex === st.setIndex));
  }, [s, library, skipped]);
  const cur = steps[0], next = steps[1];
  useEffect(() => { if (!cur) return; if (phase === 'ready') audio.say(count === 10 ? tt.adaptive.countReady : String(count)); else if (phase === 'rest') audio.say(tt.adaptive.rest); else if (phase === 'work') audio.say(tt.adaptive.start); }, [phase, count, quit, paused, visible, !!cur]);
  const totalSets = s?.prescriptions?.filter(p => !p.skipped).reduce((n, p) => n + p.sets, 0) ?? 1, doneSets = s?.sets.length ?? 0;
  const nm = (e?: Exercise) => (e ? localExercise(e, locale).name.split('—')[0].trim() : '');
  // reset inputs for each new set
  useEffect(() => { if (!cur) return; setReps(cur.target); setKg(Number(weightValue(cur.weightKg, unit).toFixed(1))); setTimer(cur.target); setRunning(false); setRir(null); setGymElapsed(0); }, [cur?.pid, cur?.setIndex]);
  // countdown before the first set
  useEffect(() => { if (phase !== 'ready' || quit || paused || !visible || !cur) return; if (count <= 0) { setPhase('work'); return; } const id = setTimeout(() => setCount(c => c - 1), 1000); return () => clearTimeout(id); }, [phase, count, quit, paused, visible, !!cur]);
  // rest timer
  useEffect(() => { if (phase !== 'rest' || quit || paused || !visible) return; if (restLeft <= 0) { buzz(60); setPhase('work'); return; } const id = setTimeout(() => setRestLeft(r => r - 1), 1000); return () => clearTimeout(id); }, [phase, restLeft, quit, paused, visible]);
  // timed sets count down automatically
  // Timers pause while the quit sheet is open (nothing is logged behind the user's back).
  useEffect(() => { if (phase !== 'work' || !cur?.timed || !running || quit || paused || busy || !visible) return; if (timer <= 0) { void logSet(); return; } const id = setTimeout(() => setTimer(v => v - 1), 1000); return () => clearTimeout(id); }, [phase, running, timer, cur?.timed, quit, paused, busy, visible]);
  useEffect(() => { if (phase === 'work' && cur?.timed) setRunning(true); }, [phase, cur?.pid, cur?.setIndex]);
  // end automatically when nothing is left
  useEffect(() => { if (!busy && !finishing.current && s && library.length && !steps.length && (phase === 'work' || phase === 'rest') && s.sets.length) void finish(); }, [steps.length, phase, busy]);

  useEffect(()=>{if(phase!=='work'||cur?.timed||paused||quit||!visible)return;const id=setTimeout(()=>setGymElapsed(v=>v+1),1000);return()=>clearTimeout(id);},[phase,cur?.timed,paused,quit,visible,gymElapsed]);
  useEffect(()=>{const video=document.querySelector<HTMLVideoElement>('.player video');if(!video)return;if(paused||quit||!visible)video.pause();else void video.play().catch(()=>{});},[paused,quit,visible,phase,cur?.pid,cur?.setIndex]);
  async function logSet() {
    if (!cur || busyRef.current) return; busyRef.current=true; setBusy(true); setRunning(false);
    try {
      await api(`sessions/${sessionId}/sets`, { exerciseId: cur.exercise.id, setIndex: cur.setIndex, reps: cur.timed ? 1 : reps, weight: cur.timed ? 0 : kg, unit, restSeconds: Math.max(10, cur.rest), ...(rir !== null && !cur.timed ? { rir } : {}), ...(cur.timed ? { seconds: cur.target - timer } : {}) });
      buzz(30); await load();
      if (steps.length > 1) { setRestTotal(cur.rest); setRestLeft(cur.rest); setPhase('rest'); }
    } catch (e) { notify(trainingErrorText(e, t, tt)); } finally { busyRef.current=false; setBusy(false); }
  }
  async function skipExercise() {
    if (!cur || !s || busyRef.current) return; busyRef.current=true;setBusy(true);const pid = cur.pid;setRunning(false);
    try { await trainingApi(`sessions/${sessionId}/action`, { actionId: actionId(), revision: s.revision ?? 0, kind: 'skip', prescriptionId: pid }); await load();setSkipped(x=>[...x,pid]);setRestLeft(cur.rest);setRestTotal(cur.rest);setPhase('rest'); } catch(e) {notify(trainingErrorText(e,t,tt));} finally {busyRef.current=false;setBusy(false);}
  }
  async function finish(reason = '') {
    if(finishing.current)return;finishing.current=true;setBusy(true);
    try { const r = await api<{ reward: { awarded: boolean; xp: number; streak?: number } }>(`sessions/${sessionId}/finish`, { note: reason ? `quit:${reason}` : '' }); void r; await refresh(); await load(); setPhase('summary'); }
    catch (e) { finishing.current=false;notify(trainingErrorText(e, t, tt)); } finally { setBusy(false); }
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
    try { const p = await trainingApi<{ lastAdapt: { sessionId: string; change: 'up' | 'same' | 'down'; reason: string; pct: number | null; difficulty: string | null } | null }>(`plan?location=${getLocation(data.profile?.trainingLocation)}`);
      if (p.lastAdapt?.sessionId === sessionId) { setResult(p.lastAdapt); setPhase('result'); return; } } catch { /* not a programme session */ }
    setBusy(false); go('home');
  }
  if (!s || !library.length) return <section className="player"><div className="sk sk-hero"/></section>;
  if (!steps.length && !s.sets.length && ['ready', 'work', 'rest'].includes(phase)) return <section className="panel session-result"><h2>{u.allSkippedTitle}</h2><p className="muted">{u.allSkippedHint}</p>
    <button type="button" className="button primary big-start" disabled={busy} onClick={() => void quitWith('later')}>{u.backToPlan}</button></section>;
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
  const opposite = !!cur && cur.exercise.id==='curated-bird-dog' && cur.setIndex%2===1;
  const side = cur?.exercise.id==='curated-bird-dog' ? (opposite?copy.right:copy.left) : '';
  const media = (e:Exercise) => hasApprovedVideo(e)
    ? <video key={e.videoUrl} className={opposite?'opposite-side':''} src={e.videoUrl!} poster={e.thumbnailUrl??undefined} autoPlay muted loop playsInline preload="auto"/>
    : <div className="player-poster"><MuscleMap primary={e.primaryMuscles??[]} secondary={e.secondaryMuscles??[]}/></div>;
  async function nextBlock(){ if(!cur)return;if(cur.timed&&timer>=cur.target)await skipExercise();else await logSet(); }
  return <section className={`player minimal-player phase-${phase}`} aria-busy={busy}>
    <div className="player-bar">
      <button type="button" className="icon-button" aria-label={u.quit} onClick={()=>setQuit(true)}><X size={26}/></button>
      <div className="player-progress" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}><i style={{width:`${doneSets/totalSets*100}%`}}/></div>
      <button type="button" className="icon-button" aria-label={paused?u.resumeTimer:u.pause} onClick={()=>{setPaused(v=>!v);setRunning(true);}}>{paused?<Play size={24}/>:<Pause size={24}/>}</button>
    </div>
    {audio.controls}
    {cur && ['ready','work','rest'].includes(phase) && <div className="minimal-stage">
      <div className="player-media">{media(cur.exercise)}</div>
      <div className="minimal-caption">
        <span className="player-state">{phase==='ready'?u.getReady:phase==='rest'?`${u.rest} · ${copy.next}`:side || u.setOf.replace('{a}',String(cur.setIndex+1)).replace('{b}',String(cur.sets))}</span>
        <h2>{nm(cur.exercise)}{phase!=='work'&&side?` · ${side}`:''}</h2>
        <strong className="minimal-count" aria-live="off">{phase==='ready'?count:phase==='rest'?restLeft:cur.timed?timer:`${Math.floor(gymElapsed/60)}:${String(gymElapsed%60).padStart(2,'0')}`}<small>s</small></strong>
        {phase==='work'&&!cur.timed&&<button type="button" className="text-button gym-target" onClick={()=>{setEditLoad(true);setPaused(true);}}>{reps} {u.reps} · {kg} {unit}</button>}
        {phase==='work'&&<button type="button" className="button workout-start player-next" disabled={busy||paused} onClick={()=>void nextBlock()}>{busy?'…':u.next}<SkipForward size={24}/></button>}
      </div>
    </div>}
    {editLoad&&<Modal title={tt.weight} close={()=>{setEditLoad(false);setPaused(false);}}><label>{u.reps}<input type="number" min={1} max={100} value={reps} onChange={e=>setReps(Number(e.target.value))}/></label><label>{tt.weight} ({unit})<input type="number" min={0} max={400} step={0.5} value={kg} onChange={e=>setKg(Number(e.target.value))}/></label><button className="button primary" onClick={()=>{setEditLoad(false);setPaused(false);}}>{u.doneSet}</button></Modal>}
    {quit && <Modal title={u.quitTitle} close={() => setQuit(false)}>
      <p className="muted">{u.quitHint}</p>
      <div className="quit-reasons">{QUIT.map(r => <button key={r} type="button" className="quiz-option" onClick={() => void quitWith(r)}><strong>{u.quitReasons[r]}</strong></button>)}</div>
      <button type="button" className="button primary" onClick={() => setQuit(false)}>{u.keepGoing}</button>
    </Modal>}
  </section>;
}
