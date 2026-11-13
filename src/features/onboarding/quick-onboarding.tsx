'use client';
import { useState } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { useIntakeLanguage } from '@/shared/intake-language';
import { DEFAULT_BODY_PREFERENCES, readBodyPreferences, type BodyPreferences } from '@/shared/body-preferences';
import { FocusChoices } from './body-goal-fields';
import { BodyVisual } from './body-visual';
import { NumberPicker } from './number-picker';

const BASE_STEPS = ['age', 'height', 'weight', 'sex', 'goal', 'level', 'activity', 'place', 'days', 'minutes', 'health', 'focus', 'waistNow', 'waistGoal', 'glutesNow', 'glutesGoal', 'clearance', 'review'] as const;
type Goal = 'lose' | 'muscle' | 'strength' | 'fit';
const EMPTY_HEALTH = { heart: false, chestPain: false, dizziness: false, joint: false, medication: false, pregnancy: false, other: false };
export function QuickOnboarding() {
  const { data, refresh, go } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage(); const q = tt.quiz, u = useIntakeLanguage();
  const p = data.profile;
  const [i, setI] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [age, setAge] = useState(p?.birthYear ? String(new Date().getUTCFullYear() - p.birthYear) : '');
  const [height, setHeight] = useState(p?.heightCm ? String(p.heightCm) : '');
  const [weight, setWeight] = useState(data.measurements[0]?.weightKg ? String(data.measurements[0].weightKg) : '');
  const [sex, setSex] = useState<'male'|'female'|'unspecified'|null>(p?.sex as 'male'|'female'|'unspecified' ?? null);
  const [goal, setGoal] = useState<Goal|null>(p?.intakeVersion===1 ? p.weightGoal==='lose'?'lose':p.goal==='build_muscle'?'muscle':p.goal==='build_strength'?'strength':'fit' : null);
  const [level, setLevel] = useState<'beginner'|'intermediate'|'advanced'|null>(p?.experience ?? null);
  const [activity, setActivity] = useState<'sedentary'|'light'|'active'|null>(p?.activityLevel as 'sedentary'|'light'|'active' ?? null);
  const [place, setPlace] = useState<'home'|'gym'|null>(p?.intakeVersion === 1 ? p.trainingLocation ?? null : null);
  const [days, setDays] = useState<number|null>(p?.intakeVersion === 1 ? p.daysPerWeek : null);
  const [minutes, setMinutes] = useState<number|null>(p?.intakeVersion === 1 ? p.sessionMinutes ?? null : null);
  const [screening, setScreening] = useState({ ...EMPTY_HEALTH, ...p?.screening });
  const [healthAnswered, setHealthAnswered] = useState(false), [clearance, setClearance] = useState(false);
  const [bodyPreferences, setBodyPreferences] = useState<BodyPreferences>(() => readBodyPreferences((p as {bodyPreferences?:unknown})?.bodyPreferences ?? DEFAULT_BODY_PREFERENCES));
  const needsReview = screening.heart || screening.chestPain || screening.dizziness || screening.pregnancy;
  const STEPS = BASE_STEPS.filter(s => s !== 'clearance' || needsReview);
  const step = STEPS[i];
  const numeric = step === 'age' || step === 'height' || step === 'weight';
  const displayed = step === 'age' ? Number(age || 30) : step === 'height' ? Number(height || 165) : Number(weight || 65);
  const valid = numeric ? true : step === 'sex' ? !!sex : step === 'goal' ? !!goal : step === 'level' ? !!level : step === 'activity' ? !!activity : step === 'place' ? !!place : step === 'days' ? !!days : step === 'minutes' ? !!minutes : step === 'health' ? healthAnswered : step === 'clearance' ? clearance : true;
  const d = q.details;
  const titles = { age: u.age, height: u.height, weight: u.weight, sex: u.sex, goal: q.titles.goal, level: q.titles.level, activity: u.activity, place: q.titles.place, days: tt.ux.onb.daysLabel, minutes: u.available, health: u.health, focus: u.focus, waistNow: `${d.waist} · ${d.current}`, waistGoal: `${d.waist} · ${d.desired}`, glutesNow: `${d.glutes} · ${d.current}`, glutesGoal: `${d.glutes} · ${d.desired}`, clearance: u.health, review: u.review };
  // Keep a stable code, so an existing error changes language with the rest of this screen.
  const errorMessage = !error ? '' : error === 'GOAL_BMI_TOO_LOW' ? u.lowWeightGoal : error === 'HEALTH_REVIEW_REQUIRED' ? u.reviewRequired : error === 'UNAUTHORIZED' ? u.sessionExpired : error === 'INVALID_ORIGIN' ? u.retryConnection : error === 'INVALID_INPUT' ? u.checkAnswers : u.saveError;
  const indexOf = (name: typeof BASE_STEPS[number]) => STEPS.indexOf(name);
  function next() {
    // The footer explicitly confirms the visible value; mounting a picker never saves a default.
    if (step === 'age' && !age) setAge(String(displayed));
    if (step === 'height' && !height) setHeight(String(displayed));
    if (step === 'weight' && !weight) setWeight(String(displayed));
    setI(i + 1);
  }
  const shape = <T extends string,>(area: 'waist'|'glutes', values: readonly T[], selected: string, choose: (v:T)=>void, label: (v:T)=>string) => <div className="intake-shape-grid">{values.map(v => <button type="button" key={v} className={`intake-shape ${selected === v ? 'on' : ''}`} aria-pressed={selected === v} onClick={()=>choose(v)}><BodyVisual area={area} variant={v}/><strong>{label(v)}</strong>{selected === v && <Check size={22}/>}</button>)}</div>;
  const choices = <T extends string|number,>(values: readonly T[], selected: T|null, choose: (v:T)=>void, label:(v:T)=>string) => <div className="quiz-grid">{values.map(v => <button type="button" key={String(v)} className={`quiz-option tile ${selected === v ? 'on' : ''}`} aria-pressed={selected === v} onClick={()=>choose(v)}><strong>{label(v)}</strong>{selected === v && <Check size={20}/>}</button>)}</div>;
  async function finish() {
    if (busy) return; setBusy(true); setError('');
    try {
      await trainingApi('intake', { locale, heightCm: Number(height), weightKg: Number(weight), age: Number(age), sex,
        goal: goal === 'muscle' ? 'build_muscle' : goal === 'strength' ? 'build_strength' : 'general_fitness',
        weightGoal: goal === 'lose' ? 'lose' : 'maintain', experience: level, activityLevel: activity, trainingLocation: place,
        equipment: ['body weight'], daysPerWeek: days, sessionMinutes: minutes, limitations: p?.limitations ?? '',
        weightUnit: p?.weightUnit ?? 'kg', distanceUnit: p?.distanceUnit ?? 'km', timezone: p?.timezone ?? 'Asia/Yangon',
        screening, healthClearance: needsReview && clearance, bodyPreferences });
      try { localStorage.setItem('mingalar-location', place!); } catch { /* optional */ }
      await refresh(); go('home');
    } catch (e) { setError(e instanceof Error ? e.message : 'REQUEST_FAILED'); }
    finally { setBusy(false); }
  }
  const overview = [
    [u.age, age, indexOf('age')], [u.height, `${height} cm`, indexOf('height')], [u.weight, `${weight} kg`, indexOf('weight')], [u.sex, sex ? u.sexes[sex] : '', indexOf('sex')],
    [q.titles.goal, goal ? q.goals[goal] : '', indexOf('goal')], [q.titles.level, level ? q.levels[level] : '', indexOf('level')],
    [u.activity, activity ? u.activities[activity] : '', indexOf('activity')], [q.titles.place, place ? q.places[place] : '', indexOf('place')],
    [tt.ux.onb.daysLabel, String(days), indexOf('days')], [u.available, `${minutes} ${tt.ux.min}`, indexOf('minutes')], [u.health, Object.entries(screening).filter(([,v])=>v).map(([k])=>u.conditions[k as keyof typeof u.conditions]).join(' · ') || u.none, indexOf('health')],
    [u.focus, bodyPreferences.focusAreas.map(a=>d.focus[a]).join(' · '), indexOf('focus')],
    [d.waist, `${bodyPreferences.currentWaist === 'unsure' ? d.unsure : d.waistBuilds[bodyPreferences.currentWaist]} → ${d.waistGoals[bodyPreferences.waistGoal]}`, indexOf('waistNow')],
    [d.glutes, `${bodyPreferences.currentGlutes === 'unsure' ? d.unsure : d.gluteBuilds[bodyPreferences.currentGlutes]} → ${d.gluteGoals[bodyPreferences.gluteGoal]}`, indexOf('glutesNow')],
  ] as const;
  return <section className="quiz onb intake-v2" data-step={step}>
    <div className="quiz-top">{i > 0 ? <button className="icon-button" aria-label={tt.ux.back} disabled={busy} onClick={()=>setI(i-1)}><ArrowLeft size={24}/></button> : <span/>}<div className="quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i+1}><i style={{width:`${(i+1)/STEPS.length*100}%`}}/></div><small>{i+1}/{STEPS.length}</small></div>
    <h1 className="quiz-title">{titles[step]}</h1>
    <div className="quiz-body">
      {numeric && <NumberPicker key={step} label={titles[step]} value={displayed} min={step === 'age' ? 18 : step === 'height' ? 120 : 30} max={step === 'age' ? 90 : step === 'height' ? 230 : 250} step={step === 'weight' ? 0.5 : 1} unit={step === 'height' ? 'cm' : step === 'weight' ? 'kg' : undefined} vertical={step === 'age'} onChange={v=>(step === 'age' ? setAge : step === 'height' ? setHeight : setWeight)(String(v))}/>}
      {step === 'sex' && choices(['male','female','unspecified'] as const,sex,setSex,v=>u.sexes[v])}
      {step === 'goal' && choices(['lose','muscle','strength','fit'] as const,goal,setGoal,v=>q.goals[v])}
      {step === 'level' && choices(['beginner','intermediate','advanced'] as const,level,setLevel,v=>q.levels[v])}
      {step === 'activity' && choices(['sedentary','light','active'] as const,activity,setActivity,v=>u.activities[v])}
      {step === 'place' && choices(['home','gym'] as const,place,setPlace,v=>q.places[v])}
      {step === 'days' && choices([2,3,4,5,6],days,setDays,String)}
      {step === 'minutes' && choices([10,20,30,45],minutes,setMinutes,v=>`${v} ${tt.ux.min}`)}
      {step === 'health' && <><div className="intake-checks">{Object.keys(EMPTY_HEALTH).map(key=><label key={key} className="check"><input type="checkbox" checked={!!screening[key as keyof typeof screening]} onChange={e=>{setScreening(v=>({...v,[key]:e.target.checked}));setHealthAnswered(true);setClearance(false);}}/>{u.conditions[key as keyof typeof u.conditions]}</label>)}<label className="check"><input type="checkbox" checked={healthAnswered&&!Object.values(screening).some(Boolean)} onChange={()=>{setScreening(EMPTY_HEALTH);setHealthAnswered(true);setClearance(false);}}/>{u.none}</label></div>
      </>}
      {step === 'clearance' && <><p className="explain-box">{u.reviewRequired}</p><label className="check"><input type="checkbox" checked={clearance} onChange={e=>setClearance(e.target.checked)}/>{u.clearance}</label></>}
      {step === 'focus' && <FocusChoices value={bodyPreferences} onChange={setBodyPreferences}/>}
      {step === 'waistNow' && <>{shape('waist',['slim','medium','fuller'],bodyPreferences.currentWaist,v=>setBodyPreferences(p=>({...p,currentWaist:v})),v=>d.waistBuilds[v])}<button className="text-button" aria-pressed={bodyPreferences.currentWaist==='unsure'} onClick={()=>setBodyPreferences(p=>({...p,currentWaist:'unsure'}))}>{d.unsure}</button></>}
      {step === 'waistGoal' && <>{shape('waist',['reduce','strong','maintain'],bodyPreferences.waistGoal,v=>setBodyPreferences(p=>({...p,waistGoal:v})),v=>d.waistGoals[v])}<p className="quiz-hint">{d.waistNote}</p></>}
      {step === 'glutesNow' && <>{shape('glutes',['small','medium','fuller'],bodyPreferences.currentGlutes,v=>setBodyPreferences(p=>({...p,currentGlutes:v})),v=>d.gluteBuilds[v])}<button className="text-button" aria-pressed={bodyPreferences.currentGlutes==='unsure'} onClick={()=>setBodyPreferences(p=>({...p,currentGlutes:'unsure'}))}>{d.unsure}</button></>}
      {step === 'glutesGoal' && shape('glutes',['build','strong','maintain','reduce'],bodyPreferences.gluteGoal,v=>setBodyPreferences(p=>({...p,gluteGoal:v})),v=>d.gluteGoals[v])}
      {step === 'review' && <><div className="intake-review">{overview.map(([title,value,index])=><button key={title} disabled={busy} onClick={()=>setI(index)}><span><strong>{title}</strong><small>{value}</small></span><span>{u.edit}</span></button>)}</div><p className="quiz-hint">{u.changeLater}</p></>}
    </div>
    <div className="onb-footer">{errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}<button className="button primary quiz-next" disabled={!valid||busy} onClick={()=>i===STEPS.length-1?void finish():next()}>{busy?<><Loader2 className="spin" size={22}/>{q.making}</>:i===STEPS.length-1?q.create:numeric?`${u.confirm} ${displayed}${step === 'height' ? ' cm' : step === 'weight' ? ' kg' : ''}`:q.next}</button></div>
  </section>;
}
