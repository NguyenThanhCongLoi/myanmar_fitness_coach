'use client';
import {playbackSource,prefersLightVideo} from '@/shared/video-source';
import {useActiveClock} from './use-active-clock';
import {usePlaybackProgress} from './use-playback-progress';
import {orderedSets} from '@/shared/workout-sequence';
import {NextVideo} from './next-video';
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
import { music } from './workout-music';
import { MuscleMap } from '../exercises/muscle-map';
import { hasApprovedVideo } from '../exercises/exercise-media';
import { useIntakeLanguage } from '@/shared/intake-language';
import { getLocation, pctColor } from './plan-view';
import { countdownRemaining, estimatedSetSeconds, blockRest } from '@/shared/workout-timing';

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
  const [finishFailed,setFinishFailed]=useState(false);
  const busyRef = useRef(false), finishing = useRef(false);
  const [editLoad,setEditLoad] = useState(false);
  const [paused,setPaused] = useState(false), [gymElapsed,setGymElapsed] = useState(0);
  const [busy, setBusy] = useState(false); const [quit, setQuit] = useState(false); const [skipped, setSkipped] = useState<string[]>([]);
  const [technique, setTechnique] = useState<'good' | 'needs_work' | 'unknown'>('unknown');
  const [rir, setRir] = useState<number | null>(null);
  const checkpoint=usePlaybackProgress(sessionId,data.user.id);
  const restoredOnce=useRef(false);
  const [activeSeconds,setActiveSeconds]=useState(0);
  const [lightVideo]=useState(prefersLightVideo);
  const videoFor=(e:Exercise)=>playbackSource(e.videoUrl,lightVideo);
  const [mediaState,setMediaState]=useState<{url:string|null;ready:boolean;error:boolean}>({url:null,ready:false,error:false});
  const [visible, setVisible] = useState(true);
  const beforeSettings=useRef(false);

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
    const order=orderedSets(live,circuit).map(({row,setIndex})=>one(row,setIndex));
    return order.filter(st => !s.sets.some(x => x.exerciseId === st.exercise.id && x.setIndex === st.setIndex));
  }, [s, library, skipped]);
  const cur = steps[0], next = steps[1];
  const mediaReady=!cur?.exercise.videoUrl||(mediaState.url===videoFor(cur.exercise)&&mediaState.ready);
  const gymTargetSeconds = estimatedSetSeconds(reps, !!cur?.exercise.guidance?.perSide);
  const audio = useWorkoutAudio(checkpoint.restored!==undefined && visible && !quit && !paused && ['ready','work','rest','summary'].includes(phase) && (phase!=='work'||mediaReady),open=>{if(open){beforeSettings.current=paused;setPaused(true);}else setPaused(beforeSettings.current);});
  const spoken=useRef(new Set<string>());
  const voiceOnce=(event:string,run:()=>void)=>{if(!audio.voice||!visible||quit||paused||checkpoint.restored===undefined||(phase==='work'&&!mediaReady))return;const key=`${sessionId}:${cur?.pid}:${cur?.setIndex}:${phase}:${event}`;if(!spoken.current.has(key)){spoken.current.add(key);run();}};
  // Voice script (locales/workout-voice.ts): "<name> starts in … 5 4 3 2 1", "Go" / "Switch sides", last 3 s of a timed set,
  // "Rest, stretch and relax", then "Get ready, next: <name>" and 3 2 1. Music starts with the first set.
  const switching = !!cur && cur.exercise.id === 'curated-bird-dog' && cur.setIndex % 2 === 1;
  useEffect(() => { if (s && library.length) audio.prefetch([cur,next].filter(Boolean).map(x=>x.exercise)); }, [cur?.exercise.id,next?.exercise.id,audio.server,locale]);
  useEffect(() => { if (!cur || phase !== 'ready') return; if (count === 10) voiceOnce('starts',()=>audio.cue('starts', cur.exercise)); else if (count > 0 && count <= 5) voiceOnce(`count:${count}`,()=>audio.count(count)); }, [phase,count,!!cur,checkpoint.restored,paused]);
  useEffect(() => { if (cur && phase === 'work'&&mediaReady)voiceOnce('go',()=>audio.cue(switching ? 'side' : 'go')); }, [phase, cur?.pid, cur?.setIndex,mediaReady]);
  useEffect(() => { if (phase === 'work' && cur?.timed && running && timer === Math.floor(cur.target/2) && cur.target>=20)voiceOnce('encourage',()=>audio.cue('encourage')); if (phase === 'work' && cur?.timed && running && timer > 0 && timer <= 3 && cur.target > 6) voiceOnce(`count:${timer}`,()=>audio.count(timer)); }, [timer]);
  useEffect(() => { if (phase !== 'rest' || !cur) return;
    if (restLeft === restTotal) voiceOnce('relax',()=>audio.cue('relax'));
    else if (restLeft === Math.min(7, restTotal - 3)) voiceOnce('ready',()=>audio.cue(switching ? 'side' : 'ready', cur.exercise));
    else if (restLeft > 0 && restLeft <= 3) voiceOnce(`count:${restLeft}`,()=>audio.count(restLeft)); }, [phase, restLeft]);
  useEffect(() => { if (phase === 'summary') { audio.cue('complete'); music.stop(); } }, [phase]);
  useEffect(() => { if (paused || quit || !visible) music.pause(); else if (phase === 'work' || phase === 'rest') music.play(); }, [paused, quit, visible, phase]);
  useEffect(() => () => music.stop(), []);
  const totalSets = s?.prescriptions?.filter(p => !p.skipped).reduce((n, p) => n + p.sets, 0) ?? 1, doneSets = s?.sets.length ?? 0;
  const nm = (e?: Exercise) => (e ? localExercise(e, locale).name.split('—')[0].trim() : '');
  // reset inputs for each new set
  useEffect(() => { if (!cur) return; const previous = s?.sets.filter(x=>x.exerciseId===cur.exercise.id&&x.completed).sort((a,b)=>b.setIndex-a.setIndex)[0]; setReps(cur.target); setKg(Number(weightValue(previous?.weightKg ?? cur.weightKg, unit).toFixed(1))); setTimer(cur.target); setRunning(false); setRir(null); setGymElapsed(0); }, [cur?.pid, cur?.setIndex]);
  useEffect(()=>{
    if(s?.status==='completed'){setPhase('summary');return;}
    if(!cur||checkpoint.restored===undefined||restoredOnce.current)return;
    restoredOnce.current=true;
    const saved=checkpoint.restored;
    if(saved&&saved.prescriptionId===cur.pid&&saved.setIndex===cur.setIndex){
      setPhase(saved.phase);setCount(saved.phase==='ready'?saved.remaining:10);setRestLeft(saved.phase==='rest'?saved.remaining:0);setRestTotal(saved.restTotal);
      setTimer(saved.phase==='work'?Math.min(cur.target,saved.remaining):cur.target);setGymElapsed(saved.gymElapsed);setReps(saved.reps);setKg(saved.kg);setRir(saved.rir);setActiveSeconds(saved.activeSeconds);setPaused(true);
    }else if(s?.status==='completed')setPhase('summary');
  },[cur?.pid,cur?.setIndex,checkpoint.restored,s?.status]);
  useEffect(()=>{if(!restoredOnce.current||!cur||!['ready','work','rest'].includes(phase))return;
    checkpoint.save({prescriptionId:cur.pid,setIndex:cur.setIndex,phase:phase as 'ready'|'work'|'rest',remaining:phase==='ready'?count:phase==='rest'?restLeft:timer,restTotal,gymElapsed,paused:paused||quit||!visible,reps,kg,rir,activeSeconds});
  },[phase,count,restLeft,timer,gymElapsed,paused,quit,visible,cur?.pid,cur?.setIndex,reps,kg,rir,activeSeconds]);
  useActiveClock(checkpoint.restored!==undefined&&!paused&&!quit&&visible&&!busy&&['ready','work','rest'].includes(phase)&&(phase!=='work'||mediaReady),`elapsed:${sessionId}`,n=>setActiveSeconds(v=>v+n));
  // countdown before the first set
  useEffect(() => { if (checkpoint.restored===undefined || phase !== 'ready' || quit || paused || !visible || !cur) return; if (count <= 0) { setPhase('work'); return; } const id = setTimeout(() => setCount(c => c - 1), 1000); return () => clearTimeout(id); }, [phase, count, quit, paused, visible, !!cur,checkpoint.restored]);
  // rest timer
  useEffect(() => { if (checkpoint.restored===undefined || phase !== 'rest' || quit || paused || !visible) return; if (restLeft <= 0) { buzz(60); setPhase('work'); return; } const id = setTimeout(() => setRestLeft(r => r - 1), 1000); return () => clearTimeout(id); }, [phase, restLeft, quit, paused, visible,checkpoint.restored]);
  // timed sets count down automatically
  // Timers pause while the quit sheet is open (nothing is logged behind the user's back).
  const clockActive=checkpoint.restored!==undefined&&phase==='work'&&!quit&&!paused&&!busy&&visible&&mediaReady;
  const clockId=`${cur?.pid}:${cur?.setIndex}`;
  useActiveClock(clockActive&&!!cur?.timed&&running&&timer>0,clockId,n=>setTimer(v=>Math.max(0,v-n)));
  useEffect(()=>{if(clockActive&&cur?.timed&&running&&timer<=0)void logSet();},[clockActive,cur?.timed,running,timer]);
  useEffect(() => { if (phase === 'work' && cur?.timed) setRunning(true); }, [phase, cur?.pid, cur?.setIndex]);
  // end automatically when nothing is left
  useEffect(() => { if (!finishFailed && checkpoint.restored!==undefined && !busy && !finishing.current && s && library.length && !steps.length && (phase === 'ready' || phase === 'work' || phase === 'rest') && s.sets.length) void finish(); }, [steps.length, phase, busy,checkpoint.restored,finishFailed]);

  useActiveClock(clockActive&&!cur?.timed&&gymElapsed<gymTargetSeconds,clockId,n=>setGymElapsed(v=>Math.min(gymTargetSeconds,v+n)));
  useEffect(()=>{const video=document.querySelector<HTMLVideoElement>('.player-media video');if(!video)return;if(paused||quit||!visible)video.pause();else void video.play().catch(()=>{});},[paused,quit,visible,phase,cur?.pid,cur?.setIndex]);
  async function logSet() {
    if (!cur || busyRef.current) return; busyRef.current=true; setBusy(true); setRunning(false);
    const recovery=blockRest(cur.rest,cur.setIndex,cur.timed,next?.exercise.id!==cur.exercise.id,!!next&&cur.timed&&Math.floor(next.setIndex/(next.exercise.id==='curated-bird-dog'?2:1))>Math.floor(cur.setIndex/(cur.exercise.id==='curated-bird-dog'?2:1)));
    try {
      await api(`sessions/${sessionId}/sets`, { exerciseId: cur.exercise.id, setIndex: cur.setIndex, reps: cur.timed ? 1 : reps, weight: cur.timed ? 0 : kg, unit, restSeconds: recovery, ...(rir !== null && !cur.timed ? { rir } : {}), ...(cur.timed ? { seconds: cur.target - timer } : {}) });
      buzz(30); await load();
      if (steps.length > 1) { setRestTotal(recovery); setRestLeft(recovery); setPhase('rest'); }
    } catch (e) { notify(trainingErrorText(e, t, tt)); } finally { busyRef.current=false; setBusy(false); }
  }
  async function skipExercise() {
    if (!cur || !s || busyRef.current) return; busyRef.current=true;setBusy(true);const pid = cur.pid;setRunning(false);
    try { await trainingApi(`sessions/${sessionId}/action`, { actionId: actionId(), revision: s.revision ?? 0, kind: 'skip', prescriptionId: pid }); await load();setSkipped(x=>[...x,pid]);setRestLeft(cur.rest);setRestTotal(cur.rest);setPhase('rest'); } catch(e) {notify(trainingErrorText(e,t,tt));} finally {busyRef.current=false;setBusy(false);}
  }
  async function finish(reason = '') {
    if(finishing.current)return;finishing.current=true;setBusy(true);setFinishFailed(false);
    try { await checkpoint.flush();checkpoint.stop();const r = await api<{ reward: { awarded: boolean; xp: number; streak?: number } }>(`sessions/${sessionId}/finish`, { note: reason ? `quit:${reason}` : '' }); void r; await refresh(); await load(); setPhase('summary'); }
    catch (e) { checkpoint.resume();finishing.current=false;setFinishFailed(true);notify(trainingErrorText(e, t, tt)); } finally { setBusy(false); }
  }
  async function quitWith(reason: typeof QUIT[number]) {
    track({ name: 'workout_quit', props: { reason } }); setQuit(false);
    if ((s?.sets.length ?? 0) > 0) { await finish(reason); if (reason === 'pain' || reason === 'too_hard') { try { await trainingApi(`sessions/${sessionId}/feedback`, { difficulty: 'too_hard', pain: reason === 'pain', technique: 'unknown' }); } catch { notify(tt.adaptive.audioError); } } return; }
    checkpoint.stop();
    try { await trainingApi(`sessions/${sessionId}/action`, { actionId: actionId(), revision: s?.revision ?? 0, kind: 'abandon', confirm: true, reason }); } catch (e) { checkpoint.resume();notify(trainingErrorText(e, t, tt)); return; }
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
  if(finishFailed)return <section className="panel"><p role="alert">{copy.saveError}</p><button className="button primary" disabled={busy} onClick={()=>void finish()}>{u.doneSet}</button></section>;
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
  const perSide = !!cur?.exercise.guidance?.perSide;
  const gymRemaining = countdownRemaining(gymTargetSeconds, gymElapsed);
  const validLoad = Number.isInteger(reps)&&reps>=1&&reps<=100&&Number.isFinite(kg)&&kg>=0&&kg<=400;
  const media = (e:Exercise) => hasApprovedVideo(e)
    ? <video key={videoFor(e)} className={opposite?'opposite-side':''} src={videoFor(e)!} poster={e.thumbnailUrl??undefined} autoPlay muted loop playsInline preload="auto" onLoadedData={()=>setMediaState({url:videoFor(e)!,ready:true,error:false})} onPlaying={()=>setMediaState({url:videoFor(e)!,ready:true,error:false})} onWaiting={()=>setMediaState({url:videoFor(e)!,ready:false,error:false})} onError={()=>setMediaState({url:videoFor(e)!,ready:false,error:true})}/>
    : <div className="player-poster"><MuscleMap primary={e.primaryMuscles??[]} secondary={e.secondaryMuscles??[]}/></div>;
  async function nextBlock(){ if(!cur)return;if(cur.timed&&timer>=cur.target)await skipExercise();else await logSet(); }
  return <section className={`player minimal-player phase-${phase}`} aria-busy={busy}>
    <div className="player-bar">
      <button type="button" className="icon-button" aria-label={u.quit} onClick={()=>setQuit(true)}><X size={26}/></button>
      <div className="player-progress" style={{marginRight:156}} role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets}><i style={{width:`${doneSets/totalSets*100}%`}}/></div>
      <button type="button" className="icon-button" aria-label={paused?u.resumeTimer:u.pause} onClick={()=>{setPaused(v=>!v);setRunning(true);}}>{paused?<Play size={24}/>:<Pause size={24}/>}</button>
    </div>
    {audio.controls}
    <NextVideo src={next?videoFor(next.exercise):undefined}/>
    {cur && ['ready','work','rest'].includes(phase) && <div className="minimal-stage">
      <div className="player-media">{media(cur.exercise)}{!mediaReady&&<span role="status">{mediaState.error?tt.adaptive.audioError:t.loading}</span>}</div>
      <div className="minimal-caption">
        <span className="player-state">{phase==='ready'?u.getReady:phase==='rest'?`${u.rest} · ${copy.next}`:side || u.setOf.replace('{a}',String(cur.setIndex+1)).replace('{b}',String(cur.sets))}</span>
        <h2>{nm(cur.exercise)}{phase!=='work'&&side?` · ${side}`:''}</h2>
        <strong className="minimal-count" aria-live="off">{phase==='ready'?count:phase==='rest'?restLeft:cur.timed?timer:gymRemaining}<small>s</small></strong>
        {phase==='work'&&!cur.timed&&<><small className="gym-time-hint">{gymRemaining>0?copy.estimatedSet:copy.finishSet}</small><button type="button" className="text-button gym-target" onClick={()=>{setEditLoad(true);setPaused(true);}}>{reps} {u.reps}{perSide?` · ${tt.perSide}`:''} · {kg} {unit}</button></>}
        {phase==='work'&&<button type="button" className="button workout-start player-next" disabled={busy||paused||(!cur.timed&&!validLoad)} onClick={()=>void nextBlock()}>{busy?'…':cur.timed?u.next:u.doneSet}<SkipForward size={24}/></button>}
      </div>
    </div>}
    {editLoad&&<Modal title={tt.weight} close={()=>{setEditLoad(false);setPaused(false);}}><label>{u.reps}<input type="number" min={1} max={100} value={reps} onChange={e=>setReps(Number(e.target.value))}/></label><label>{tt.weight} ({unit})<input type="number" min={0} max={400} step={0.5} value={kg} onChange={e=>setKg(Number(e.target.value))}/></label><label>{tt.rirLabel}<select value={rir??''} onChange={e=>setRir(e.target.value===''?null:Number(e.target.value))}><option value="">{tt.adaptive.unknown}</option>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="button primary" disabled={!Number.isFinite(reps)||reps<1||reps>100||!Number.isFinite(kg)||kg<0||kg>400} onClick={()=>{setEditLoad(false);setPaused(false);}}>{u.doneSet}</button></Modal>}
    {quit && <Modal title={u.quitTitle} close={() => setQuit(false)}>
      <p className="muted">{u.quitHint}</p>
      <div className="quit-reasons">{QUIT.map(r => <button key={r} type="button" className="quiz-option" onClick={() => void quitWith(r)}><strong>{u.quitReasons[r]}</strong></button>)}</div>
      <button type="button" className="button primary" onClick={() => setQuit(false)}>{u.keepGoing}</button>
    </Modal>}
  </section>;
}
