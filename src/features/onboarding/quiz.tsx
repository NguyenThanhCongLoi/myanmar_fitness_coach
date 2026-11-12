'use client';
import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, Bike, Bone, Check, Dumbbell, Flame, Footprints, Hand, HeartPulse, Home, PersonStanding, ShieldCheck, Sofa, Sprout, Sun, Sunrise, Sunset, Timer, TrendingUp, Trophy, UserRound, Users, Zap } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api, trainingApi } from '@/shared/client';
import { gameApi } from '@/shared/game-client';
import { errorText, useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { bmiBand, bmiOf } from '@/shared/plan';
import { Mascot } from '../gamification/mascot';

// One question per screen, big tap targets, progress bar. Answers create the profile and a personal plan.
type Goal = 'lose' | 'muscle' | 'strength' | 'fit';
type A = { trainTime: 'morning' | 'midday' | 'evening'; nickname: string; activity: 'sedentary' | 'light' | 'active'; minutes: 10 | 20 | 30 | 45; goal: Goal; sex: 'female' | 'male' | 'unspecified'; age: number; height: number; weight: number; target: number; place: 'home' | 'gym'; level: 'beginner' | 'intermediate' | 'advanced'; days: number[]; avoid: string[]; health: boolean | null };
const AGES = [16, 22, 30, 40, 50, 60];
const STEPS = ['nickname', 'goal', 'sex', 'age', 'height', 'weight', 'target', 'activity', 'place', 'level', 'days', 'trainTime', 'minutes', 'avoid', 'health'] as const;

export function OnboardingQuiz() {
  const { data, refresh, notify, go } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const q = tt.quiz;
  const [i, setI] = useState(0); const [busy, setBusy] = useState(false); const [making, setMaking] = useState(0);
  const [a, setA] = useState<A>({ trainTime: 'evening', nickname: '', activity: 'light', minutes: 20, goal: 'fit', sex: 'unspecified', age: 30, height: 165, weight: 65, target: 62, place: 'home', level: 'beginner', days: [0, 2, 4], avoid: [], health: null });
  const step = STEPS[i]; const set = (p: Partial<A>) => setA(v => ({ ...v, ...p }));
  const bmi = bmiOf(a.weight, a.height), band = bmiBand(bmi);
  const canNext = step === 'days' ? a.days.length >= 2 && a.days.length <= 6 : step === 'health' ? a.health !== null : true;
  useEffect(() => { if (step === 'target' && a.target === 62) set({ target: a.goal === 'lose' ? Math.round(a.weight * 0.93) : a.goal === 'muscle' ? Math.round(a.weight * 1.03) : a.weight }); }, [step]);
  async function finish() {
    setBusy(true); setMaking(5);
    const tick = setInterval(() => setMaking(m => Math.min(95, m + 7)), 160);
    try {
      const goal = a.goal === 'muscle' ? 'build_muscle' : a.goal === 'strength' ? 'build_strength' : 'general_fitness';
      const equipment = a.place === 'gym' ? ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'machine'] : ['body weight'];
      const screening = { heart: !!a.health, chestPain: false, dizziness: false, joint: a.avoid.length > 0, medication: false, pregnancy: false, other: false };
      await api('profile', { locale, goal, experience: a.level, equipment, daysPerWeek: a.days.length, limitations: a.avoid.map(x => q.avoidOpts[x as keyof typeof q.avoidOpts]).join(', '), weightUnit: data.profile?.weightUnit ?? 'kg', distanceUnit: data.profile?.distanceUnit ?? 'km', screening, timezone: 'Asia/Yangon' });
      await api('measurements', { weight: a.weight, unit: 'kg', waistCm: null });
      await trainingApi('energy/body', { heightCm: a.height, birthYear: new Date().getFullYear() - a.age, sex: a.sex, goalWeightKg: a.target, weightGoal: a.goal === 'lose' ? 'lose' : a.goal === 'muscle' ? 'gain' : 'maintain' });
      await gameApi('schedule', { weekdays: a.days });
      await trainingApi('prefs', { trainTime: a.trainTime, activityLevel: a.activity, sessionMinutes: a.minutes, nickname: a.nickname.trim() });
      await trainingApi('program', { program: a.place === 'gym' && a.level === 'beginner' ? 'gym_beginner' : 'personal' });
      try { localStorage.setItem('mingalar-location', a.place); } catch { /* optional */ }
      setMaking(100); await new Promise(r => setTimeout(r, 400));
      await refresh(); go('home');
    } catch (error) { notify(errorText(error, t)); setMaking(0); }
    finally { clearInterval(tick); setBusy(false); }
  }
  if (making) return <section className="quiz quiz-making"><Mascot state="excited" size={140}/><div className="quiz-ring" style={{ ['--p' as string]: `${making}%` }}><strong>{making}%</strong></div><h2>{q.making}</h2><p className="muted">{q.makingHint}</p></section>;
  // Visual tiles: an icon disc, a short label, an optional one-line hint. Less reading, faster tapping.
  const Option = ({ on, label, sub, onClick, icon }: { on: boolean; label: string; sub?: string; onClick: () => void; icon?: React.ReactNode }) =>
    <button type="button" className={`quiz-option ${icon ? 'tile' : ''} ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>{icon && <i className="qo-icon">{icon}</i>}<span><strong>{label}</strong>{sub && <small>{sub}</small>}</span>{on && <Check className="qo-check" size={18}/>}</button>;
  const ic = (I: React.ComponentType<{ size?: number }>) => <I size={22}/>;
  const Stepper = ({ value, min, max, unit, onChange, stepBy = 1 }: { value: number; min: number; max: number; unit: string; onChange: (v: number) => void; stepBy?: number }) =>
    <div className="quiz-number"><strong>{value}<small> {unit}</small></strong>
      <input type="range" min={min} max={max} step={stepBy} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={unit}/>
      <div className="quiz-stepper"><button type="button" onClick={() => onChange(Math.max(min, value - stepBy))}>−</button><button type="button" onClick={() => onChange(Math.min(max, value + stepBy))}>+</button></div></div>;
  return <section className="quiz">
    <div className="quiz-top">{i > 0 ? <button type="button" className="icon-button" aria-label={tt.ux.back} onClick={() => setI(i - 1)}><ArrowLeft size={22}/></button> : <span className="quiz-top-space"/>}
      <div className="quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}><i style={{ width: `${(i + 1) / STEPS.length * 100}%` }}/></div><small>{i + 1}/{STEPS.length}</small></div>
    <h1 key={`t-${step}`} className="quiz-title">{q.titles[step]}</h1>
    {q.hints[step] && <p key={`h-${step}`} className="quiz-hint">{q.hints[step]}</p>}
    <div key={step} className="quiz-body">
      {step === 'nickname' && <input className="quiz-text" value={a.nickname} maxLength={30} placeholder={q.nicknamePlaceholder} onChange={e => set({ nickname: e.target.value })} autoFocus/>}
      {step === 'trainTime' && <div className="quiz-grid">{([['morning', Sunrise], ['midday', Sun], ['evening', Sunset]] as const).map(([v, I]) => <Option key={v} on={a.trainTime === v} label={q.times[v]} sub={q.timeSubs[v]} icon={ic(I)} onClick={() => { set({ trainTime: v }); setI(i + 1); }}/>)}</div>}
      {step === 'activity' && <div className="quiz-grid">{([['sedentary', Sofa], ['light', Footprints], ['active', Bike]] as const).map(([v, I]) => <Option key={v} on={a.activity === v} label={q.activities[v]} sub={q.activitySubs[v]} icon={ic(I)} onClick={() => { set({ activity: v }); setI(i + 1); }}/>)}</div>}
      {step === 'minutes' && <div className="quiz-grid">{([10, 20, 30, 45] as const).map(v => <Option key={v} on={a.minutes === v} label={`${v} ${tt.ux.min}`} sub={q.minuteSubs[String(v) as '10']} icon={ic(Timer)} onClick={() => { set({ minutes: v }); setI(i + 1); }}/>)}</div>}
      {step === 'goal' && <div className="quiz-grid">{([['lose', Flame], ['muscle', Dumbbell], ['strength', Zap], ['fit', HeartPulse]] as const).map(([g, I]) => <Option key={g} on={a.goal === g} label={q.goals[g]} icon={ic(I)} onClick={() => { set({ goal: g }); setI(i + 1); }}/>)}</div>}
      {step === 'sex' && <div className="quiz-grid">{([['female', UserRound], ['male', UserRound], ['unspecified', Users]] as const).map(([s, I]) => <Option key={s} on={a.sex === s} label={q.sexes[s]} icon={ic(I)} onClick={() => { set({ sex: s }); setI(i + 1); }}/>)}</div>}
      {step === 'age' && <div className="quiz-grid">{AGES.map((v, k) => <Option key={v} on={a.age === v} label={q.ages[k]} onClick={() => { set({ age: v }); setI(i + 1); }}/>)}</div>}
      {step === 'height' && <Stepper value={a.height} min={130} max={210} unit="cm" onChange={v => set({ height: v })}/>}
      {step === 'weight' && <><Stepper value={a.weight} min={35} max={180} unit="kg" onChange={v => set({ weight: v })}/>
        {bmi !== null && <div className={`quiz-bmi bmi-${band}`}><span>BMI</span><strong>{bmi}</strong><small>{q.bmiBands[band!]}</small></div>}</>}
      {step === 'target' && <Stepper value={a.target} min={35} max={180} unit="kg" onChange={v => set({ target: v })}/>}
      {step === 'place' && <div className="quiz-grid"><Option on={a.place === 'home'} label={q.places.home} sub={q.places.homeSub} icon={ic(Home)} onClick={() => { set({ place: 'home' }); setI(i + 1); }}/>
        <Option on={a.place === 'gym'} label={q.places.gym} sub={q.places.gymSub} icon={ic(Dumbbell)} onClick={() => { set({ place: 'gym' }); setI(i + 1); }}/></div>}
      {step === 'level' && <div className="quiz-grid">{([['beginner', Sprout], ['intermediate', TrendingUp], ['advanced', Trophy]] as const).map(([l, I]) => <Option key={l} on={a.level === l} label={q.levels[l]} sub={q.levelSubs[l]} icon={ic(I)} onClick={() => { set({ level: l }); setI(i + 1); }}/>)}</div>}
      {step === 'days' && <><div className="quiz-days">{t.weekdaysShort.map((d, k) => <button key={k} type="button" aria-pressed={a.days.includes(k)} className={a.days.includes(k) ? 'on' : ''} onClick={() => set({ days: a.days.includes(k) ? a.days.filter(x => x !== k) : [...a.days, k].sort() })}>{d}</button>)}</div>
        <p className="quiz-hint">{q.daysCount.replace('{n}', String(a.days.length))}</p></>}
      {step === 'avoid' && <div className="quiz-grid">{([['none', ShieldCheck], ['knees', Bone], ['back', PersonStanding], ['shoulders', Activity], ['wrists', Hand]] as const).map(([k, I]) => <Option key={k} on={k === 'none' ? !a.avoid.length : a.avoid.includes(k)} label={q.avoidOpts[k]} icon={ic(I)}
        onClick={() => set({ avoid: k === 'none' ? [] : a.avoid.includes(k) ? a.avoid.filter(x => x !== k) : [...a.avoid, k] })}/>)}</div>}
      {step === 'health' && <><div className="quiz-grid"><Option on={a.health === false} label={q.healthNo} icon={ic(ShieldCheck)} onClick={() => set({ health: false })}/><Option on={a.health === true} label={q.healthYes} icon={ic(HeartPulse)} onClick={() => set({ health: true })}/></div>
        {a.health && <p className="explain-box">{q.healthAdvice}</p>}</>}
    </div>
    {!['goal', 'sex', 'age', 'place', 'level', 'activity', 'minutes', 'trainTime'].includes(step) && <button type="button" className="button primary quiz-next" disabled={!canNext || busy} onClick={() => (i === STEPS.length - 1 ? void finish() : setI(i + 1))}>{i === STEPS.length - 1 ? q.create : q.next}</button>}
  </section>;
}
