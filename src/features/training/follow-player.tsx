'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, LogOut, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { actionId, api, localExercise, RequestError, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { clock, fill, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise, Routine, Workout } from '@/shared/types';
import { ExerciseMedia } from '../exercises/exercise-media';
import { useCoachVoice, type ExerciseStep } from '../exercises/exercise-steps';
import { trainingErrorText } from './training-hub';
import { FeedbackForm } from './feedback-form';
import { SessionSummary } from './session-summary';
import { usePtCompanion } from './pt-companion';
import { buzz, useWakeLock } from '@/shared/wake-lock';
import type { Level } from '@/shared/dose';
import { BeeReaction, Mascot } from '../gamification/mascot';
import { useGameLanguage } from '@/shared/game-language';

// Timer design: the server stores phaseStartedAt + phaseElapsedMs; the client only renders
// (serverNow offset + Date.now()). Background tabs, sleep and refresh therefore never drift.
// The server caps a phase at its length, so an unattended tab never auto-completes work.
function beep(frequency: number) {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioCtx(), oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.frequency.value = frequency; gain.gain.value = 0.08; oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.15); oscillator.onended = () => void context.close();
  } catch { /* sound is optional */ }
}

export function FollowPlayer({ initial, reload }: { initial: Workout; reload: () => Promise<Workout | null> }) {
  const { notify, refresh, go, celebrate, data } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage();
  const companion = usePtCompanion(); const [summary, setSummary] = useState(false); const lastCue = useRef('');
  const [session, setSession] = useState(initial);
  useWakeLock(session.status === 'active');
  const [offset, setOffset] = useState(() => initial.serverNow ? new Date(initial.serverNow).getTime() - Date.now() : 0);
  const [now, setNow] = useState(() => Date.now());
  const [reps, setReps] = useState(0); const [busy, setBusy] = useState(false); const [note, setNote] = useState('');
  const [sound, setSound] = useState(false); const [feedback, setFeedback] = useState(false); const gt = useGameLanguage();
  const [intro, setIntro] = useState(() => (initial.playerIndex ?? 0) === 0 && !(initial.phaseLogs ?? []).length);
  const visibleSince = useRef(Date.now()); const pending = useRef(false); const lastBeep = useRef('');
  const routine = session.playerPlan as Routine;
  const index = session.playerIndex ?? 0, phase = routine.phases[index];
  const exercises = new Map<string, Exercise>((session.prescriptions ?? []).map(p => [p.exerciseId, p.exercise]));
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setCatalog).catch(() => {}); try { setSound(localStorage.getItem('mingalar-sound') === 'on'); } catch { /* optional */ } }, []);
  const exerciseFor = (id: string | null) => (id && (exercises.get(id) ?? catalog.find(e => e.id === id))) || null;

  const apply = useCallback((value: Workout) => { setSession(value); if (value.serverNow) setOffset(new Date(value.serverNow).getTime() - Date.now()); }, []);
  const resync = useCallback(async () => { const value = await reload(); if (value) apply(value); }, [reload, apply]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { visibleSince.current = Date.now(); void resync(); } };
    document.addEventListener('visibilitychange', onVisible); window.addEventListener('focus', onVisible); window.addEventListener('online', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); window.removeEventListener('online', onVisible); };
  }, [resync]);
  useEffect(() => { setReps(phase?.tracking === 'reps' ? phase.reps : 0); }, [index]);

  const serverNow = now + offset;
  const elapsedMs = phase ? Math.min(phase.seconds * 1000, (session.phaseElapsedMs ?? 0) + (session.status === 'active' && session.phaseStartedAt ? serverNow - new Date(session.phaseStartedAt).getTime() : 0)) : 0;
  const remaining = phase ? Math.max(0, phase.seconds - elapsedMs / 1000) : 0;
  const phaseEndClient = phase && session.phaseStartedAt ? new Date(session.phaseStartedAt).getTime() - offset + phase.seconds * 1000 - (session.phaseElapsedMs ?? 0) : 0;
  const before = routine.phases.slice(0, index).reduce((n, p) => n + p.seconds, 0);
  const overall = Math.min(100, ((before + elapsedMs / 1000) / Math.max(1, routine.totalSeconds)) * 100);

  async function act(kind: string, extra: Record<string, unknown> = {}) {
    if (pending.current) return; pending.current = true; setBusy(true);
    try { apply(await trainingApi<Workout>(`sessions/${session.id}/action`, { actionId: actionId(), revision: session.revision ?? 0, kind, ...extra })); }
    catch (error) { if (error instanceof RequestError && ['STALE_WORKOUT', 'PHASE_NOT_READY'].includes(error.code)) await resync(); else notify(trainingErrorText(error, t, tt), true); }
    finally { pending.current = false; setBusy(false); }
  }
  // Auto-advance only while the user is actually watching: non-exercise phases and timed exercise
  // phases whose end happened after the tab became visible. Otherwise the user confirms manually.
  useEffect(() => {
    if (!phase || session.status !== 'active' || remaining > 0 || pending.current || document.visibilityState !== 'visible') return;
    if (phase.kind !== 'exercise') void act('advance');
    else if (phase.tracking === 'timed' && phaseEndClient > visibleSince.current) void act('advance', { confirm: true });
  }, [remaining <= 0, index, session]);
  useEffect(() => {
    if (!sound || !phase || session.status !== 'active' || document.visibilityState !== 'visible') return;
    const second = Math.ceil(remaining), key = `${index}:${second}`;
    if (second >= 1 && second <= 3 && lastBeep.current !== key) { lastBeep.current = key; beep(660); }
    if (remaining === 0 && lastBeep.current !== `${index}:end`) { lastBeep.current = `${index}:end`; beep(990); }
  }, [Math.ceil(remaining), sound, index]);

  const toggleSound = () => { const next = !sound; setSound(next); try { localStorage.setItem('mingalar-sound', next ? 'on' : 'off'); } catch { /* optional */ } if (next) beep(880); };
  async function exit() { if (confirm(tt.exitConfirm)) await act('end', { confirm: true }); }
  async function finish() {
    setBusy(true);
    try { const result = await api<{ reward: { awarded: boolean; xp: number; streak?: number } }>(`sessions/${session.id}/finish`, { note }); await refresh(); celebrate(result.reward); await resync(); setSummary(true); }
    catch (error) { notify(trainingErrorText(error, t, tt), true); } finally { setBusy(false); }
  }
  async function discard() {
    if (!confirm(tt.abandonConfirm)) return; setBusy(true);
    try { await trainingApi(`sessions/${session.id}/action`, { actionId: actionId(), revision: session.revision ?? 0, kind: 'abandon', confirm: true }); await refresh(); go('train'); }
    catch (error) { notify(trainingErrorText(error, t, tt), true); } finally { setBusy(false); }
  }

  // PT companion: announce the next exercise during rest, encourage halfway through each block, celebrate the finish.
  const level = (data.profile?.experience ?? 'beginner') as Level;
  useEffect(() => {
    if (!phase) { if (lastCue.current !== 'finish' && (session.phaseLogs ?? []).length) { lastCue.current = 'finish'; void companion.say({ kind: 'finish' }); } return; }
    const upcoming = routine.phases.slice(index + (phase.kind === 'exercise' ? 1 : 0)).find(p => p.kind === 'exercise');
    const nextEx = upcoming ? exerciseFor(upcoming.exerciseId) : null;
    if (nextEx) companion.prefetch({ kind: 'next', exercise: nextEx, level });
    companion.prefetch({ kind: 'motivate', n: index });
    if ((phase.kind === 'rest' || (phase.kind === 'warmup' && index === 0)) && nextEx && session.status === 'active' && lastCue.current !== `n${index}`) { lastCue.current = `n${index}`; void companion.say({ kind: 'next', exercise: nextEx, level }); }
  }, [index, catalog.length]);
  useEffect(() => {
    if (phase?.kind === 'exercise' && session.status === 'active' && elapsedMs >= phase.seconds * 500 && remaining > 4 && lastCue.current !== `m${index}`) { lastCue.current = `m${index}`; void companion.say({ kind: 'motivate', n: index }); }
  }, [Math.floor(elapsedMs / 1000)]);
  useEffect(() => { if (phase && session.status === 'active' && Math.ceil(remaining) === 0) buzz([120, 60, 120]); }, [Math.ceil(remaining) === 0, index]);
  const logs = session.phaseLogs ?? [];
  const totalBlocks = routine.phases.filter(p => p.kind === 'exercise').length;
  const doneBlocks = logs.filter(l => l.kind === 'exercise' && l.status === 'completed').length;
  if (feedback) return <FeedbackForm sessionId={session.id} done={() => go('home')}/>;
  if (summary) return <SessionSummary session={session} library={catalog} onContinue={() => { setSummary(false); setFeedback(true); }}/>;
  if (!phase) {
    const ended = session.status === 'completed' || session.status === 'abandoned';
    return <section className="follow-player"><div className="page-heading"><span className="overline">{tt.followAlong}</span><h1>{tt.finished}</h1></div>
      <div className="panel"><p className="big-number"><strong>{doneBlocks}</strong> / {totalBlocks}</p><p>{tt.completedPhases}</p>
        <p className="muted small">{tt.skippedPhases}: {logs.filter(l => l.kind === 'exercise' && l.status === 'skipped').length}</p>
        <p className="muted small">{tt.creditRule}</p>
        {!ended && (doneBlocks > 0 ? <><label>{t.note}<textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000}/></label>
          <div className="form-footer"><button className="button primary" disabled={busy} onClick={() => void finish()}><CheckCircle2 size={18}/>{tt.saveAndFinish}</button></div></>
          : <><p>{tt.noWorkDone}</p><button className="button secondary" disabled={busy} onClick={() => void discard()}>{tt.discard}</button></>)}
      </div></section>;
  }
  const current = exerciseFor(phase.exerciseId);
  const nextPhase = routine.phases.slice(index + 1).find(p => p.exerciseId);
  const nextExercise = nextPhase ? exerciseFor(nextPhase.exerciseId) : null;
  const shown = phase.kind === 'rest' ? nextExercise : current;
  const paused = session.status === 'paused';
  return <section className="follow-player workout-dark" data-phase={phase.kind} data-index={index}>{intro && <BeeReaction state="encouraging" text={gt.mascot.workoutStarted} onDone={() => setIntro(false)}/>}
    {companion.bar}
    <div className="player-top"><span className="overline">{tt.followAlong} · {fill(tt.phaseOf, { n: index + 1, total: routine.phases.length })}</span>
      <button className="icon-button" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? tt.soundOn : tt.soundOff} title={tt.sound}>{sound ? <Volume2 size={20}/> : <VolumeX size={20}/>}</button></div>
    <div className="overall" aria-label={tt.overall}><div className="progress-track"><div style={{ width: `${overall}%` }}/></div><small>{clock(before + elapsedMs / 1000)} / {clock(routine.totalSeconds)}</small></div>
    <div className={`player-card panel ${phase.kind}`}>
      <div className="player-info">
        <span className={`phase-chip ${phase.kind}`}>{tt.phaseLabels[phase.kind]}{phase.round ? ` · ${tt.round} ${phase.round}` : ''}</span>
        <h1 lang={current?.translations.some(x => x.locale === locale) ? locale : undefined}>{phase.kind === 'rest' ? tt.restTimer : current ? localExercise(current, locale).name : tt.phaseLabels[phase.kind]}</h1>
        {phase.kind === 'exercise' && <p className="muted">{tt.target}: {phase.tracking === 'reps' ? fill(tt.repTarget, { reps: phase.reps, s: phase.seconds }) : fill(tt.timedTarget, { s: phase.seconds })}</p>}
        {(phase.kind === 'rest' || phase.kind === 'transition') && nextExercise && <p className="muted up-next">{phase.kind === 'rest' && <Mascot state="encouraging" size={44} label=""/>}<span>{tt.upNext}: <strong>{localExercise(nextExercise, locale).name}</strong></span></p>}
        <div className={`countdown ${remaining <= 3 && remaining > 0 ? 'urgent' : ''}`} role="timer" aria-live="off">{clock(Math.ceil(remaining))}</div>
        <div className="progress-track phase"><div style={{ width: `${(elapsedMs / (phase.seconds * 1000)) * 100}%` }}/></div>
        {paused && <p className="paused-label" role="status">{tt.paused}</p>}
        {phase.kind === 'exercise' && phase.tracking === 'reps' && <label className="reps-input">{tt.repsDone}<input type="number" min={1} max={200} value={reps} onChange={e => setReps(Number(e.target.value))} disabled={paused}/></label>}
        {phase.kind === 'exercise' && phase.tracking === 'timed' && remaining === 0 && <p role="status">{tt.timeUp}</p>}
        <div className="player-controls">
          {paused ? <button className="button primary" disabled={busy} onClick={() => void act('resume')}><Play size={18}/>{tt.resume}</button>
            : <button className="button secondary" disabled={busy} onClick={() => void act('pause')}><Pause size={18}/>{tt.pause}</button>}
          {phase.kind === 'exercise' && <button className="button primary" disabled={busy || paused || (phase.tracking === 'timed' ? remaining > 0 : reps < 1 || elapsedMs < Math.max(3000, reps * 1000))} onClick={() => void act('advance', { confirm: true, reps: phase.tracking === 'reps' ? reps : undefined })}><CheckCircle2 size={18}/>{tt.done}</button>}
          <button className="button ghost" disabled={busy || paused} onClick={() => void act('skip')}><SkipForward size={18}/>{tt.skip}</button>
          <button className="button ghost" disabled={busy} onClick={() => void exit()}><LogOut size={18}/>{tt.exit}</button>
        </div>
      </div>
      <div className="player-media">{shown ? <ExerciseMedia exercise={shown} autoPlay={!paused}/> : null}{shown && <PlayerSteps exercise={shown}/>}</div>
    </div>
    <ol className="phase-strip" aria-hidden="true">{routine.phases.map((p, i) => <li key={i} className={`${p.kind} ${i < index ? (logs.find(l => l.phaseIndex === i)?.status ?? 'done') : i === index ? 'current' : ''}`} style={{ flexGrow: p.seconds }}/>)}</ol>
  </section>;
}

// Compact how-to with coach voice for the exercise on screen (video stays the visual priority).
function PlayerSteps({ exercise }: { exercise: Exercise }) {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const steps = (exercise.steps ?? []) as ExerciseStep[]; const voice = useCoachVoice(exercise.id);
  if (!steps.length) return null;
  return <details className="player-steps"><summary>{tt.stepsTitle}</summary>
    <button type="button" className="text-button" onClick={() => voice.playing ? voice.stop() : voice.play('all', steps.map((s, i) => `Step ${i + 1}. ${s.en}`).join(' '))}>{voice.playing ? tt.stopVoice : tt.listenCoach}</button>
    {voice.error && <p className="error-text">{voice.error}</p>}
    <ol>{steps.map((s, i) => <li key={i} lang={locale === 'my-MM' && s.my ? 'my' : 'en'}>{locale === 'my-MM' ? s.my ?? s.en : s.en}</li>)}</ol>
  </details>;
}
