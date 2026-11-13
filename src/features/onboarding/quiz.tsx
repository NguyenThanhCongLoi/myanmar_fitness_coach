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
import { bodyPreferencesSchema, DEFAULT_BODY_PREFERENCES, type BodyPreferences } from '@/shared/body-preferences';
import { BodyVisual } from './body-visual';
import { BodyGoalFields, FocusChoices } from './body-goal-fields';

// One question per screen, big tap targets, progress bar. Answers create the profile and a personal plan.
type Goal = 'lose' | 'muscle' | 'strength' | 'fit';
type A = { trainTime: 'morning' | 'midday' | 'evening'; nickname: string; activity: 'sedentary' | 'light' | 'active'; minutes: 10 | 20 | 30 | 45; goal: Goal; sex: 'female' | 'male' | 'unspecified'; age: number; height: number; weight: number; target: number; place: 'home' | 'gym'; level: 'beginner' | 'intermediate' | 'advanced'; days: number[]; avoid: string[]; health: boolean | null; equipment: string[]; bodyPreferences: BodyPreferences; screening: Record<string, boolean> };
const AGES = [16, 22, 30, 40, 50, 60];
const STEPS = ['welcome', 'nickname', 'goal', 'focus', 'waist', 'glutes', 'sex', 'age', 'height', 'weight', 'target', 'activity', 'place', 'equipment', 'level', 'days', 'trainTime', 'minutes', 'avoid', 'health', 'review'] as const;

export function OnboardingQuiz() {
  const { data, refresh, notify, go } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const q = tt.quiz;
  const [i, setI] = useState(0); const [busy, setBusy] = useState(false); const [making, setMaking] = useState(0);
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState<A>({ trainTime: 'evening', nickname: '', activity: 'light', minutes: 20, goal: 'fit', sex: 'unspecified', age: 30, height: 165, weight: 65, target: 62, place: 'home', level: 'beginner', days: [0, 2, 4], avoid: [], health: null, equipment: [], bodyPreferences: DEFAULT_BODY_PREFERENCES, screening: {} });
  const step = STEPS[i]; const set = (p: Partial<A>) => setA(v => ({ ...v, ...p }));
  const details = q.details, titles = { ...q.titles, ...details.titles }, hints = { ...q.hints, ...details.hints };
  const advance = () => { setI(editing ? STEPS.length - 1 : i + 1); setEditing(false); };
  const edit = (s: typeof STEPS[number]) => { setEditing(true); setI(STEPS.indexOf(s)); };
  const bmi = bmiOf(a.weight, a.height), band = bmiBand(bmi);
  const canNext = step === 'days' ? a.days.length >= 2 && a.days.length <= 6 : step === 'health' ? a.health === false || (a.health === true && Object.values(a.screening).some(Boolean)) : (step === 'waist' || step === 'glutes' || step === 'review') ? bodyPreferencesSchema.safeParse(a.bodyPreferences).success : true;
  useEffect(() => { if (step === 'target' && a.target === 62) set({ target: a.goal === 'lose' ? Math.round(a.weight * 0.93) : a.goal === 'muscle' ? Math.round(a.weight * 1.03) : a.weight }); }, [step]);
  // Real progress: 4 save stages; independent saves run in parallel (profile first, programme last).
  const [stage, setStage] = useState(0);
  async function finish() {
    setBusy(true); setMaking(4); setStage(0);
    const done = (n: number) => { setStage(n); setMaking(Math.round(n / 4 * 100)); };
    try {
      const goal = a.goal === 'muscle' ? 'build_muscle' : a.goal === 'strength' ? 'build_strength' : 'general_fitness';
      const equipment = ['body weight', ...a.equipment];
      const screening = { heart: false, chestPain: false, dizziness: false, joint: a.avoid.length > 0, medication: false, pregnancy: false, other: false, ...(a.health ? a.screening : {}) };
      await api('profile', { locale, goal, experience: a.level, equipment, daysPerWeek: a.days.length, limitations: a.avoid.map(x => q.avoidOpts[x as keyof typeof q.avoidOpts]).join(', '), weightUnit: data.profile?.weightUnit ?? 'kg', distanceUnit: data.profile?.distanceUnit ?? 'km', screening, timezone: 'Asia/Yangon' });
      done(1);
      await Promise.all([
        api('measurements', { weight: a.weight, unit: 'kg', waistCm: a.bodyPreferences.waistCm ?? null }),
        trainingApi('energy/body', { heightCm: a.height, birthYear: new Date().getFullYear() - a.age, sex: a.sex, goalWeightKg: a.target, weightGoal: a.goal === 'lose' ? 'lose' : a.goal === 'muscle' ? 'gain' : 'maintain' }),
      ]);
      done(2);
      await Promise.all([
        gameApi('schedule', { weekdays: a.days }),
        trainingApi('prefs', { trainTime: a.trainTime, activityLevel: a.activity, sessionMinutes: a.minutes, nickname: a.nickname.trim(), bodyPreferences: { ...a.bodyPreferences, protectedAreas: a.avoid } }),
      ]);
      done(3);
      await trainingApi('program', { program: a.place === 'gym' && a.level === 'beginner' ? 'gym_beginner' : 'personal' });
      done(4);
      try { localStorage.setItem('mingalar-location', a.place); } catch { /* optional */ }
      await new Promise(r => setTimeout(r, 350));
      await refresh(); go('home');
    } catch (error) { notify(errorText(error, t)); setMaking(0); }
    finally { setBusy(false); }
  }
  if (making) return <section className="quiz quiz-making" aria-live="polite"><div className="making-ring" style={{ ['--p' as string]: `${making}%` }}><Mascot state="excited" size={92}/><strong>{making}%</strong></div><h2>{q.making}</h2>
    <ol className="making-steps">{q.makingSteps.map((label, k) => <li key={label} className={stage > k ? 'done' : stage === k ? 'now' : ''}><i>{stage > k ? <Check size={16}/> : k + 1}</i>{label}</li>)}</ol></section>;
  // Visual tiles: an icon disc, a short label, an optional one-line hint. Less reading, faster tapping.
  const Option = ({ on, label, sub, onClick, icon }: { on: boolean; label: string; sub?: string; onClick: () => void; icon?: React.ReactNode }) =>
    <button type="button" className={`quiz-option ${icon ? 'tile' : ''} ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>{icon && <i className="qo-icon">{icon}</i>}<span><strong>{label}</strong>{sub && <small>{sub}</small>}</span>{on && <Check className="qo-check" size={18}/>}</button>;
  const ic = (I: React.ComponentType<{ size?: number }>) => <I size={28}/>;
  const Stepper = ({ value, min, max, unit, onChange, stepBy = 1 }: { value: number; min: number; max: number; unit: string; onChange: (v: number) => void; stepBy?: number }) =>
    <div className="quiz-number"><strong>{value}<small> {unit}</small></strong>
      <input type="range" min={min} max={max} step={stepBy} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={unit}/>
      <div className="quiz-stepper"><button type="button" onClick={() => onChange(Math.max(min, value - stepBy))}>−</button><button type="button" onClick={() => onChange(Math.min(max, value + stepBy))}>+</button></div></div>;
  return <section className="quiz" data-step={step}>
    <div className="quiz-top">{i > 0 ? <button type="button" className="icon-button" aria-label={tt.ux.back} onClick={() => { setI(editing ? STEPS.length - 1 : i - 1); setEditing(false); }}><ArrowLeft size={26}/></button> : <span className="quiz-top-space"/>}
      <div className="quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}><i style={{ width: `${(i + 1) / STEPS.length * 100}%` }}/></div><small>{i + 1}/{STEPS.length}</small></div>
    <h1 key={`t-${step}`} className="quiz-title">{titles[step]}</h1>
    {hints[step] && <p key={`h-${step}`} className="quiz-hint">{hints[step]}</p>}
    <div key={step} className="quiz-body">
      {step === 'welcome' && <div className="quiz-welcome"><div className="welcome-visual"><BodyVisual area="full"/><div className="welcome-plan" aria-hidden="true"><Check size={26}/><span/><span/><span/><div>{[1, 2, 3, 4, 5, 6, 7].map(n => <i key={n} className={n % 2 ? 'on' : ''}/>)}</div></div></div><p className="intro-time"><Timer size={22}/>{details.introTime}</p><ul>{details.introPoints.map(point => <li key={point}><Check size={22}/>{point}</li>)}</ul></div>}
      {step === 'focus' && <><FocusChoices value={a.bodyPreferences} onChange={bodyPreferences => set({ bodyPreferences })}/><p className="goal-note">{details.balancedNote}</p></>}
      {(step === 'waist' || step === 'glutes') && <BodyGoalFields section={step} value={a.bodyPreferences} onChange={bodyPreferences => set({ bodyPreferences })}/>}
      {step === 'equipment' && <div className="quiz-grid"><Option on={!a.equipment.length} label={details.equipment.none} icon={ic(PersonStanding)} onClick={() => set({ equipment: [] })}/>{(a.place === 'gym' ? ['dumbbell', 'barbell', 'band', 'bench', 'cable', 'machine'] as const : ['dumbbell', 'band', 'bench'] as const).map(key => <Option key={key} on={a.equipment.includes(key)} label={t.equipmentLabels[key]} icon={ic(Dumbbell)} onClick={() => set({ equipment: a.equipment.includes(key) ? a.equipment.filter(e => e !== key) : [...a.equipment, key] })}/>)}</div>}
      {step === 'nickname' && <input className="quiz-text" value={a.nickname} maxLength={30} placeholder={q.nicknamePlaceholder} onChange={e => set({ nickname: e.target.value })} autoFocus/>}
      {step === 'trainTime' && <div className="quiz-grid">{([['morning', Sunrise], ['midday', Sun], ['evening', Sunset]] as const).map(([v, I]) => <Option key={v} on={a.trainTime === v} label={q.times[v]} sub={q.timeSubs[v]} icon={ic(I)} onClick={() => { set({ trainTime: v }); advance(); }}/>)}</div>}
      {step === 'activity' && <div className="quiz-grid">{([['sedentary', Sofa], ['light', Footprints], ['active', Bike]] as const).map(([v, I]) => <Option key={v} on={a.activity === v} label={q.activities[v]} sub={q.activitySubs[v]} icon={ic(I)} onClick={() => { set({ activity: v }); advance(); }}/>)}</div>}
      {step === 'minutes' && <div className="quiz-grid">{([10, 20, 30, 45] as const).map(v => <Option key={v} on={a.minutes === v} label={`${v} ${tt.ux.min}`} sub={q.minuteSubs[String(v) as '10']} icon={ic(Timer)} onClick={() => { set({ minutes: v }); advance(); }}/>)}</div>}
      {step === 'goal' && <div className="quiz-grid">{([['lose', Flame], ['muscle', Dumbbell], ['strength', Zap], ['fit', HeartPulse]] as const).map(([g, I]) => <Option key={g} on={a.goal === g} label={q.goals[g]} sub={details.goalSubs[g]} icon={ic(I)} onClick={() => { set({ goal: g }); advance(); }}/>)}</div>}
      {step === 'sex' && <div className="quiz-grid">{([['female', UserRound], ['male', UserRound], ['unspecified', Users]] as const).map(([s, I]) => <Option key={s} on={a.sex === s} label={q.sexes[s]} icon={ic(I)} onClick={() => { set({ sex: s }); advance(); }}/>)}</div>}
      {step === 'age' && <div className="quiz-grid">{AGES.map((v, k) => <Option key={v} on={a.age === v} label={q.ages[k]} onClick={() => { set({ age: v }); advance(); }}/>)}</div>}
      {step === 'height' && <Stepper value={a.height} min={130} max={210} unit="cm" onChange={v => set({ height: v })}/>}
      {step === 'weight' && <><Stepper value={a.weight} min={35} max={180} unit="kg" onChange={v => set({ weight: v })}/>
        {bmi !== null && <div className={`quiz-bmi bmi-${band}`}><span>BMI</span><strong>{bmi}</strong><small>{q.bmiBands[band!]}</small></div>}</>}
      {step === 'target' && <Stepper value={a.target} min={35} max={180} unit="kg" onChange={v => set({ target: v })}/>}
      {step === 'place' && <div className="quiz-grid"><Option on={a.place === 'home'} label={q.places.home} sub={q.places.homeSub} icon={ic(Home)} onClick={() => { set({ place: 'home', equipment: a.equipment.filter(e => !['barbell', 'cable', 'machine'].includes(e)) }); advance(); }}/>
        <Option on={a.place === 'gym'} label={q.places.gym} sub={q.places.gymSub} icon={ic(Dumbbell)} onClick={() => { set({ place: 'gym', equipment: a.place === 'gym' ? a.equipment : ['dumbbell', 'barbell', 'bench', 'cable', 'machine'] }); advance(); }}/></div>}
      {step === 'level' && <div className="quiz-grid">{([['beginner', Sprout], ['intermediate', TrendingUp], ['advanced', Trophy]] as const).map(([l, I]) => <Option key={l} on={a.level === l} label={q.levels[l]} sub={q.levelSubs[l]} icon={ic(I)} onClick={() => { set({ level: l }); advance(); }}/>)}</div>}
      {step === 'days' && <><div className="quiz-days">{t.weekdaysShort.map((d, k) => <button key={k} type="button" aria-pressed={a.days.includes(k)} className={a.days.includes(k) ? 'on' : ''} onClick={() => set({ days: a.days.includes(k) ? a.days.filter(x => x !== k) : [...a.days, k].sort() })}>{d}</button>)}</div>
        <p className="quiz-hint">{q.daysCount.replace('{n}', String(a.days.length))}</p></>}
      {step === 'avoid' && <div className="quiz-grid">{([['none', ShieldCheck], ['knees', Bone], ['back', PersonStanding], ['shoulders', Activity], ['wrists', Hand]] as const).map(([k, I]) => <Option key={k} on={k === 'none' ? !a.avoid.length : a.avoid.includes(k)} label={q.avoidOpts[k]} icon={ic(I)}
        onClick={() => set({ avoid: k === 'none' ? [] : a.avoid.includes(k) ? a.avoid.filter(x => x !== k) : [...a.avoid, k] })}/>)}</div>}
      {step === 'health' && <><div className="quiz-grid"><Option on={a.health === false} label={q.healthNo} icon={ic(ShieldCheck)} onClick={() => set({ health: false })}/><Option on={a.health === true} label={q.healthYes} icon={ic(HeartPulse)} onClick={() => set({ health: true })}/></div>
        {a.health && <><div className="health-options">{(['heart', 'chestPain', 'dizziness', 'joint', 'medication', 'pregnancy', 'other'] as const).map(key => <label className="check" key={key}><input type="checkbox" checked={!!a.screening[key]} onChange={e => set({ screening: { ...a.screening, [key]: e.target.checked } })}/>{tt.screeningQ[key]}</label>)}</div><p className="explain-box">{q.healthAdvice}</p></>}</>}
      {step === 'review' && <div className="quiz-review">
        <Review label={q.titles.nickname} editLabel={details.edit} edit={() => edit('nickname')}><p>{a.nickname || data.user.name}</p></Review>
        <Review label={details.overview} editLabel={details.edit} edit={() => edit('goal')}><strong>{q.goals[a.goal]}</strong></Review>
        <Review label={details.titles.focus} editLabel={details.edit} edit={() => edit('focus')}><p>{a.bodyPreferences.focusAreas.map(f => details.focus[f]).join(', ')}</p></Review>
        <Review label={details.waist} editLabel={details.edit} edit={() => edit('waist')}><p>{a.bodyPreferences.currentWaist === 'unsure' ? details.unsure : details.waistBuilds[a.bodyPreferences.currentWaist]} → {details.waistGoals[a.bodyPreferences.waistGoal]}</p>{a.bodyPreferences.waistCm != null && <p>{details.waistCm}: {a.bodyPreferences.waistCm}</p>}</Review>
        <Review label={details.glutes} editLabel={details.edit} edit={() => edit('glutes')}><p>{a.bodyPreferences.currentGlutes === 'unsure' ? details.unsure : details.gluteBuilds[a.bodyPreferences.currentGlutes]} → {details.gluteGoals[a.bodyPreferences.gluteGoal]}</p>{a.bodyPreferences.hipsCm != null && <p>{details.hipsCm}: {a.bodyPreferences.hipsCm}</p>}</Review>
        <Review label={q.titles.height} editLabel={details.edit} edit={() => edit('height')}><strong>{a.height} cm</strong></Review>
        <Review label={q.titles.weight} editLabel={details.edit} edit={() => edit('weight')}><strong>{a.weight} kg</strong></Review>
        <Review label={q.titles.target} editLabel={details.edit} edit={() => edit('target')}><strong>{a.target} kg</strong></Review>
        <Review label={q.titles.sex} editLabel={details.edit} edit={() => edit('sex')}><p>{q.sexes[a.sex]}</p></Review>
        <Review label={q.titles.age} editLabel={details.edit} edit={() => edit('age')}><p>{q.ages[AGES.indexOf(a.age)]}</p></Review>
        <Review label={q.titles.level} editLabel={details.edit} edit={() => edit('level')}><p>{q.levels[a.level]}</p></Review>
        <Review label={q.titles.activity} editLabel={details.edit} edit={() => edit('activity')}><p>{q.activities[a.activity]}</p></Review>
        <Review label={q.titles.place} editLabel={details.edit} edit={() => edit('place')}><p>{q.places[a.place]}</p></Review>
        <Review label={details.titles.equipment} editLabel={details.edit} edit={() => edit('equipment')}><p>{a.equipment.length ? a.equipment.map(e => t.equipmentLabels[e as 'dumbbell']).join(', ') : details.equipment.none}</p></Review>
        <Review label={q.titles.days} editLabel={details.edit} edit={() => edit('days')}><strong>{a.days.map(d => t.weekdaysShort[d]).join(', ')}</strong><p>{details.rest}</p></Review>
        <Review label={q.titles.minutes} editLabel={details.edit} edit={() => edit('minutes')}><strong>{a.minutes} {tt.ux.min}</strong></Review>
        <Review label={q.titles.trainTime} editLabel={details.edit} edit={() => edit('trainTime')}><p>{q.times[a.trainTime]}</p></Review>
        <Review label={details.recovery} editLabel={details.edit} edit={() => edit('avoid')}><p>{a.avoid.length ? a.avoid.map(k => q.avoidOpts[k as 'knees']).join(', ') : q.avoidOpts.none}</p></Review>
        <Review label={details.health} editLabel={details.edit} edit={() => edit('health')}><p>{a.health ? details.yes : details.no}</p></Review>
        <p className="goal-note">{details.balancedNote}</p>
      </div>}
    </div>
    {!['goal', 'sex', 'age', 'place', 'level', 'activity', 'minutes', 'trainTime'].includes(step) && <button type="button" className="button primary quiz-next" disabled={!canNext || busy} onClick={() => (i === STEPS.length - 1 ? void finish() : advance())}>{i === STEPS.length - 1 ? q.create : step === 'welcome' ? details.start : q.next}</button>}
  </section>;
}

function Review({ label, editLabel, edit, children }: { label: string; editLabel: string; edit: () => void; children: React.ReactNode }) {
  return <section className="review-row"><div><small>{label}</small>{children}</div><button type="button" className="text-button" onClick={edit}>{editLabel}</button></section>;
}
