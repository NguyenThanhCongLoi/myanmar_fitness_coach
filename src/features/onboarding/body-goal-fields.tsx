'use client';
import { Check } from 'lucide-react';
import { FOCUS_AREAS, toggleFocus, type BodyPreferences } from '@/shared/body-preferences';
import { useTrainingLanguage } from '@/shared/training-language';
import { BodyVisual } from './body-visual';

export function FocusChoices({ value, onChange }: { value: BodyPreferences; onChange: (p: BodyPreferences) => void }) {
  const q = useTrainingLanguage().quiz.details;
  return <div className="focus-choices">{FOCUS_AREAS.map(area => <button type="button" key={area} className={`focus-choice ${value.focusAreas.includes(area) ? 'on' : ''}`} aria-pressed={value.focusAreas.includes(area)} onClick={() => onChange({ ...value, focusAreas: toggleFocus(value.focusAreas, area) })}>
    <BodyVisual area={area}/><span><strong>{q.focus[area]}</strong><small>{q.focusSubs[area]}</small></span>{value.focusAreas.includes(area) && <Check className="focus-check" size={22}/>}</button>)}</div>;
}
export function BodyGoalFields({ value, onChange, section }: { value: BodyPreferences; onChange: (p: BodyPreferences) => void; section?: 'waist' | 'glutes' }) {
  const q = useTrainingLanguage().quiz.details;
  return <div className="body-goals">
    {section !== 'glutes' && <fieldset><legend>{q.waist}</legend><h3>{q.current}</h3><div className="current-shapes">{(['slim', 'medium', 'fuller'] as const).map(build => <button type="button" key={build} aria-pressed={value.currentWaist === build} className={`current-shape ${value.currentWaist === build ? 'on' : ''}`} onClick={() => onChange({ ...value, currentWaist: build })}><BodyVisual area="waist" variant={build}/><strong>{q.waistBuilds[build]}</strong></button>)}</div><button className="text-button current-skip" type="button" aria-pressed={value.currentWaist === 'unsure'} onClick={() => onChange({ ...value, currentWaist: 'unsure' })}>{q.unsure}</button><h3>{q.desired}</h3><div className="shape-options">{(['reduce', 'strong', 'maintain'] as const).map(goal => <button type="button" key={goal} aria-pressed={value.waistGoal === goal} className={`shape-option ${value.waistGoal === goal ? 'on' : ''}`} onClick={() => onChange({ ...value, waistGoal: goal })}>
      <BodyVisual area="waist" variant={goal}/><span><strong>{q.waistGoals[goal]}</strong><small>{q.waistExamples[goal]}</small></span>{value.waistGoal === goal && <Check size={20}/>}</button>)}</div><p className="goal-note">{q.waistNote}</p></fieldset>}
    {section !== 'waist' && <fieldset><legend>{q.glutes}</legend><h3>{q.current}</h3><div className="current-shapes">{(['small', 'medium', 'fuller'] as const).map(build => <button type="button" key={build} aria-pressed={value.currentGlutes === build} className={`current-shape ${value.currentGlutes === build ? 'on' : ''}`} onClick={() => onChange({ ...value, currentGlutes: build })}><BodyVisual area="glutes" variant={build}/><strong>{q.gluteBuilds[build]}</strong></button>)}</div><button className="text-button current-skip" type="button" aria-pressed={value.currentGlutes === 'unsure'} onClick={() => onChange({ ...value, currentGlutes: 'unsure' })}>{q.unsure}</button><h3>{q.desired}</h3><div className="shape-options">{(['build', 'strong', 'maintain', 'reduce'] as const).map(goal => <button type="button" key={goal} aria-pressed={value.gluteGoal === goal} className={`shape-option ${value.gluteGoal === goal ? 'on' : ''}`} onClick={() => onChange({ ...value, gluteGoal: goal })}>
      <BodyVisual area="glutes" variant={goal}/><span><strong>{q.gluteGoals[goal]}</strong><small>{q.gluteExamples[goal]}</small></span>{value.gluteGoal === goal && <Check size={20}/>}</button>)}</div></fieldset>}
    <p className="goal-note">{q.diagramNote}</p>
    <details className="goal-measurements"><summary>{q.measurements}</summary><p className="goal-note">{q.measurementHint}</p><div className="form-grid">{(['waistCm', 'hipsCm'] as const).map(key => <label key={key}>{q[key]}<input type="number" min="40" max="250" inputMode="decimal" value={value[key] ?? ''} onChange={e => onChange({ ...value, [key]: e.target.value === '' ? null : Number(e.target.value) })}/></label>)}</div></details>
  </div>;
}
