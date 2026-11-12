'use client';
import { useEnglishServerVoice } from '@/shared/voice';
import { useEffect, useRef, useState } from 'react';
import { Apple, CalendarDays, Droplets, PlayCircle, Square, Volume2 } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';
import { nutritionGuidance, pickSession, weeklyPlan, type Goal, type Split } from '@/shared/program';
import type { Level } from '@/shared/dose';
import { MuscleMap } from '../exercises/muscle-map';
import { BeeMessage } from '../gamification/mascot';
import { useGameLanguage } from '@/shared/game-language';


type Today = { split: Split | null; recovery: boolean; reasons: { code: string }[]; exercises: { id: string; sets: string; target: string; unit: 'reps' | 'seconds'; restSeconds: string; perSide: boolean }[] };
// Personal trainer for today: server-built from the plan + real recovery signals, with an optional coach voice walkthrough.
function TodayPT({ library, location }: { library: Exercise[]; location: 'home' | 'gym' }) {
  const { openExercise, openTrain } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [today, setToday] = useState<Today | null>(null); const [voice, setVoice] = useState<'idle' | 'loading' | 'playing'>('idle'); const [error, setError] = useState('');
  const enVoice = useEnglishServerVoice();
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { setToday(null); trainingApi<Today>(`today?location=${location}`).then(setToday).catch(() => {}); return () => { audio.current?.pause(); }; }, [location]);
  if (!today) return null;
  const name = (id: string) => { const e = library.find(x => x.id === id); return e ? localExercise(e, locale).name : id; };
  async function listen() {
    if (voice !== 'idle') { audio.current?.pause(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); setVoice('idle'); return; }
    setError('');
    if (locale === 'en' && !enVoice && typeof speechSynthesis !== 'undefined') {
      const u = new SpeechSynthesisUtterance(today!.exercises.map((x, i) => `Exercise ${i + 1}: ${name(x.id)}, ${x.sets} sets of ${x.target} ${x.unit}, rest ${x.restSeconds} seconds.`).join(' '));
      u.lang = 'en-US'; u.onend = () => setVoice('idle'); setVoice('playing'); speechSynthesis.speak(u); return;
    }
    setVoice('loading');
    try {
      const r = await fetch('/api/training/tts/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ split: today!.split, exerciseIds: today!.exercises.map(x => x.id), ...(locale === 'en' ? { lang: 'en' } : {}) }) });
      if (!r.ok) throw new Error('voice');
      const a = new Audio(URL.createObjectURL(await r.blob())); audio.current = a; a.onended = () => setVoice('idle');
      setVoice('playing'); await a.play();
    } catch { setVoice('idle'); setError(tt.voiceUnavailable); }
  }
  return <section className="panel today-pt" aria-label={tt.ptTitle}>
    <div className="today-head"><BeeMessage state={today.recovery ? 'sleepy' : 'encouraging'} size={60} text={tt.ptTitle}/>
      {!today.recovery && today.exercises.length > 0 && <button className="button primary" onClick={() => void listen()}>{voice === 'idle' ? <Volume2 size={17}/> : <Square size={16}/>}{voice === 'loading' ? tt.ptPreparing : voice === 'playing' ? tt.stopVoice : tt.ptListen}</button>}</div>
    {error && <p className="error-text">{error}</p>}
    {today.recovery || !today.split ? <p className="explain-box">{tt.ptRecovery}</p> : <>
      <h3>{tt.splits[today.split]}</h3><p className="muted small">{tt.ptWarmup}</p>
      <ol className="plan-list">{today.exercises.map(x => <li key={x.id}><button className="ex-row" onClick={() => openExercise(x.id)}><span className="ex-thumb">{(() => { const e = library.find(y => y.id === x.id); const img = e?.steps?.find(s => s.image)?.image; return img ? <img src={img} alt="" loading="lazy"/> : <MuscleMap primary={e?.primaryMuscles ?? []} secondary={[]} compact/>; })()}</span>
        <span className="ex-text"><strong>{name(x.id)}</strong><small>{fill(x.unit === 'reps' ? tt.doseReps : tt.doseSeconds, { sets: x.sets, target: x.target })}{x.perSide ? ` · ${tt.perSide}` : ''} · {fill(tt.restBetween, { rest: x.restSeconds })}</small></span></button></li>)}</ol>
      <div className="split-actions"><button className="button secondary" onClick={() => openTrain({ mode: 'free', name: tt.splits[today.split!], rows: today.exercises.map(x => ({ exerciseId: x.id, sets: Number(x.sets), reps: Number(x.target.split('–').pop()) || 10, restSeconds: Number(x.restSeconds.split('–').pop()) || 60 })) })}>{tt.startFreeSession}</button></div>
    </>}
  </section>;
}

const SPLIT_FOCUS: Record<Split, string> = { push: 'push', pull: 'pull', legs: 'legs', core: 'core', full: 'all', upper: 'upper', lower: 'legs' };

// A coach-style week: which muscles on which day, the exercises for home or gym, a starting dose, and eating guidance.
export function CoachPlan({ library, location }: { library: Exercise[]; location: 'home' | 'gym' }) {
  const { data, openExercise, openTrain } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage(); const gt = useGameLanguage();
  const [weekdays, setWeekdays] = useState<number[]>([]);
  useEffect(() => { fetch('/api/game/summary', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(g => setWeekdays(g?.state?.weekdays ?? [])).catch(() => {}); }, []);
  const level = (data.profile?.experience ?? 'beginner') as Level;
  const plan = weeklyPlan(weekdays, data.profile?.daysPerWeek ?? 3);
  const today = (new Date(new Date().toLocaleString('en-US', { timeZone: data.profile?.timezone ?? 'Asia/Yangon' })).getDay() + 6) % 7;
  const [open, setOpen] = useState<number>(() => today);
  const day = plan[open];
  const session = day.split ? pickSession(day.split, library, location, level) : [];
  const weight = data.measurements[0]?.weightKg ?? null;
  const food = nutritionGuidance(weight, (data.profile?.goal ?? 'general_fitness') as Goal);
  const muscles = day.split ? [...new Set(session.flatMap(s => s.exercise.primaryMuscles ?? []))] : [];
  const doseText = (d: ReturnType<typeof pickSession>[number]['dose']) => fill(d.unit === 'reps' ? tt.doseReps : tt.doseSeconds, { sets: d.sets, target: d.target }) + (d.perSide ? ` · ${tt.perSide}` : '');
  return <div className="coach-plan">
    <TodayPT library={library} location={location}/>
    <p className="muted small">{tt.planHint}</p>
    <section className="panel">
      <h2><CalendarDays size={18}/> {tt.planTitle}</h2>
      <div className="week-strip" role="tablist">{plan.map(d => <button key={d.weekday} role="tab" aria-selected={open === d.weekday} className={`week-day ${open === d.weekday ? 'selected' : ''} ${d.split ? 'train' : 'rest'}`} onClick={() => setOpen(d.weekday)}>
        <span className="wd">{tt.weekdayNames[d.weekday as unknown as keyof typeof tt.weekdayNames]}{d.weekday === today ? ' •' : ''}</span>
        <small>{d.split ? tt.splits[d.split] : tt.restDayLabel}</small></button>)}</div>
      <p className="muted small">{tt.changeDays}</p>
      {day.split ? <div className="plan-day-detail">
        <div className="plan-day-head"><div className="plan-map"><MuscleMap primary={muscles} secondary={[]} compact/></div>
          <div><h3>{tt.splits[day.split]}{open === today ? ` · ${tt.todayLabel}` : ''}</h3>
            <div className="split-actions">
              <button className="button primary" onClick={() => openTrain({ mode: 'follow', focus: SPLIT_FOCUS[day.split!], minutes: 20 })}><PlayCircle size={17}/>{tt.startFollowSession}</button>
              <button className="button secondary" onClick={() => openTrain({ mode: 'free', name: tt.splits[day.split!], rows: session.map(p => ({ exerciseId: p.exercise.id, sets: Number(p.dose.sets), reps: Number(String(p.dose.target).split('–').pop()) || 10, restSeconds: Number(String(p.dose.restSeconds).split('–').pop()) || 60 })) })}>{tt.startFreeSession}</button>
            </div></div></div>
        <ol className="plan-list">{session.map(({ exercise, dose }) => { const e = exercise as Exercise; const image = e.steps?.find(s => s.image)?.image;
          return <li key={e.id}><button className="ex-row" onClick={() => openExercise(e.id)}>
            <span className="ex-thumb">{image ? <img src={image} alt="" loading="lazy"/> : <MuscleMap primary={e.primaryMuscles ?? []} secondary={[]} compact/>}</span>
            <span className="ex-text"><strong>{localExercise(e, locale).name}</strong><small>{doseText(dose)}</small></span></button></li>; })}</ol>
      </div> : <div className="explain-box"><p>{gt.mascot.restDay}</p></div>}
    </section>
    <section className="panel nutrition">
      <h2><Apple size={18}/> {tt.nutritionTitle}</h2>
      {food.proteinG ? <ul className="cue-list">
        <li>{fill(tt.proteinLine, { min: food.proteinG[0], max: food.proteinG[1], per: `${food.proteinPerKg[0]}–${food.proteinPerKg[1]}` })}</li>
        <li><Droplets size={14}/> {fill(tt.waterLine, { min: food.waterL![0], max: food.waterL![1] })}</li>
      </ul> : <p className="explain-box">{tt.nutritionNoWeight}</p>}
      <p>{tt.energy[food.energy as keyof typeof tt.energy]}</p>
      <p>{tt.mealTips}</p>
      <p className="muted">{tt.foodExamples}</p>
      <p className="muted small">{tt.nutritionNote}</p>
    </section>
  </div>;
}
