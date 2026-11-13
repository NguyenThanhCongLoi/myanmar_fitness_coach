'use client';
import { useState } from 'react';
import { ArrowLeft, Check, Dumbbell, Flame, HeartPulse, Home, ShieldCheck, Sprout, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api, trainingApi } from '@/shared/client';
import { gameApi } from '@/shared/game-client';
import { errorText, useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { Mascot } from '../gamification/mascot';

// Five short questions -> profile + plan. Everything else (body data, reminders, focus areas) has defaults and is edited in Me.
type Goal = 'lose' | 'muscle' | 'strength' | 'fit';
type Level = 'beginner' | 'intermediate' | 'advanced';
type Minutes = 10 | 20 | 30 | 45;
const STEPS = ['goal', 'level', 'place', 'schedule', 'health'] as const;
// training days spread across the week (0 = Monday)
const SPREAD: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

export function QuickOnboarding() {
  const { data, refresh, notify, go } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const q = tt.quiz, o = tt.ux.onb;
  const [i, setI] = useState(0); const [making, setMaking] = useState(0); const [stage, setStage] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null); const [level, setLevel] = useState<Level | null>(null);
  const [place, setPlace] = useState<'home' | 'gym' | null>(null); const [days, setDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<Minutes | null>(null); const [health, setHealth] = useState<boolean | null>(null);
  const step = STEPS[i];
  const valid = step === 'goal' ? !!goal : step === 'level' ? !!level : step === 'place' ? !!place : step === 'schedule' ? !!days && !!minutes : health !== null;
  const lockedReason = step === 'schedule' ? (!days && !minutes ? o.needBoth : !days ? o.needDays : o.needMinutes) : o.needOne;

  async function finish() {
    setMaking(4); setStage(0);
    const done = (n: number) => { setStage(n); setMaking(Math.round(n / 3 * 100)); };
    try {
      const apiGoal = goal === 'muscle' ? 'build_muscle' : goal === 'strength' ? 'build_strength' : 'general_fitness';
      const equipment = place === 'gym' ? ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'machine'] : ['body weight'];
      const screening = { heart: !!health, chestPain: false, dizziness: false, joint: false, medication: false, pregnancy: false, other: false };
      await api('profile', { locale, goal: apiGoal, experience: level, equipment, daysPerWeek: days, limitations: '', weightUnit: data.profile?.weightUnit ?? 'kg', distanceUnit: data.profile?.distanceUnit ?? 'km', screening, timezone: 'Asia/Yangon' });
      done(1);
      await Promise.all([gameApi('schedule', { weekdays: SPREAD[days!] }), trainingApi('prefs', { sessionMinutes: minutes, nickname: data.user.name.split(' ')[0].slice(0, 30) })]);
      done(2);
      await trainingApi('program', { program: place === 'gym' && level === 'beginner' ? 'gym_beginner' : 'personal' });
      try { localStorage.setItem('mingalar-location', place!); } catch { /* optional */ }
      done(3); await new Promise(r => setTimeout(r, 300));
      await refresh(); go('home');
    } catch (error) { notify(errorText(error, t)); setMaking(0); }
  }

  if (making) return <section className="quiz quiz-making" aria-live="polite"><div className="making-ring" style={{ ['--p' as string]: `${making}%` }}><Mascot state="excited" size={92}/><strong>{making}%</strong></div><h2>{q.making}</h2>
    <ol className="making-steps">{o.makingSteps.map((label, k) => <li key={label} className={stage > k ? 'done' : stage === k ? 'now' : ''}><i>{stage > k ? <Check size={16}/> : k + 1}</i>{label}</li>)}</ol></section>;

  const Tile = ({ on, label, sub, icon, onPick }: { on: boolean; label: string; sub?: string; icon?: React.ReactNode; onPick: () => void }) =>
    <button type="button" className={`quiz-option tile ${on ? 'on' : ''}`} aria-pressed={on} aria-label={sub ? `${label}. ${sub}` : label} onClick={onPick}>{icon && <i className="qo-icon">{icon}</i>}<span><strong>{label}</strong>{sub && <small>{sub}</small>}</span>{on && <Check className="qo-check" size={18}/>}</button>;
  const Chip = ({ on, label, onPick }: { on: boolean; label: string; onPick: () => void }) => <button type="button" className={`onb-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={onPick}>{label}</button>;
  const titles: Record<typeof step, string> = { goal: q.titles.goal, level: q.titles.level, place: q.titles.place, schedule: o.scheduleTitle, health: o.healthTitle };

  return <section className="quiz onb">
    <div className="quiz-top">{i > 0 ? <button type="button" className="icon-button" aria-label={tt.ux.back} onClick={() => setI(i - 1)}><ArrowLeft size={22}/></button> : <span className="quiz-top-space"/>}
      <div className="quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}><i style={{ width: `${(i + 1) / STEPS.length * 100}%` }}/></div><small>{i + 1}/{STEPS.length}</small></div>
    <h1 key={`t-${step}`} className="quiz-title">{titles[step]}</h1>
    <div key={step} className="quiz-body">
      {step === 'goal' && <div className="quiz-grid">{([['lose', Flame], ['muscle', Dumbbell], ['strength', Zap], ['fit', HeartPulse]] as const).map(([g, I]) => <Tile key={g} on={goal === g} label={q.goals[g]} icon={<I size={22}/>} onPick={() => setGoal(g)}/>)}</div>}
      {step === 'level' && <div className="quiz-grid">{([['beginner', Sprout], ['intermediate', TrendingUp], ['advanced', Trophy]] as const).map(([l, I]) => <Tile key={l} on={level === l} label={q.levels[l]} sub={q.levelSubs[l]} icon={<I size={22}/>} onPick={() => setLevel(l)}/>)}</div>}
      {step === 'place' && <div className="quiz-grid"><Tile on={place === 'home'} label={q.places.home} sub={o.homeSub} icon={<Home size={22}/>} onPick={() => setPlace('home')}/><Tile on={place === 'gym'} label={q.places.gym} sub={q.places.gymSub} icon={<Dumbbell size={22}/>} onPick={() => setPlace('gym')}/></div>}
      {step === 'schedule' && <>
        <h2 className="onb-label">{o.daysLabel}</h2><div className="onb-chips">{[2, 3, 4, 5, 6].map(n => <Chip key={n} on={days === n} label={String(n)} onPick={() => setDays(n)}/>)}</div>
        <h2 className="onb-label">{o.minutesLabel}</h2><div className="quiz-grid">{([10, 20, 30, 45] as const).map(m => <Tile key={m} on={minutes === m} label={`${m} ${tt.ux.min}`} sub={q.minuteSubs[String(m) as '10']} onPick={() => setMinutes(m)}/>)}</div></>}
      {step === 'health' && <><p className="quiz-hint">{o.healthHint}</p><div className="quiz-grid"><Tile on={health === false} label={q.healthNo} icon={<ShieldCheck size={22}/>} onPick={() => setHealth(false)}/><Tile on={health === true} label={q.healthYes} icon={<HeartPulse size={22}/>} onPick={() => setHealth(true)}/></div>
        {health && <p className="explain-box">{q.healthAdvice}</p>}</>}
    </div>
    <div className="onb-footer">
      {!valid && <p className="onb-locked" role="status">{lockedReason}</p>}
      <button type="button" className="button primary quiz-next" disabled={!valid} aria-disabled={!valid} onClick={() => (i === STEPS.length - 1 ? void finish() : setI(i + 1))}>{i === STEPS.length - 1 ? q.create : q.next}</button>
    </div>
  </section>;
}
