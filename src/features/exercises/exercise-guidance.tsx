'use client';
import { useEffect, useState } from 'react';
import { Building2, House } from 'lucide-react';
import type { Exercise } from '@/shared/types';
import { useApp } from '@/shared/app-context';
import { localExercise } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { doseFor, type Level } from '@/shared/dose';

type Cue = { en: string; my: string | null };
export type Guidance = { perSide?: boolean; home?: Cue[]; gym?: Cue[] };
export function homeAvailable(e: Exercise) { return ((e.guidance as Guidance | undefined)?.home?.length ?? 0) > 0; }
export function useLocationPref(): ['home' | 'gym', (v: 'home' | 'gym') => void] {
  const [location, set] = useState<'home' | 'gym'>('home');
  useEffect(() => { try { const v = localStorage.getItem('mingalar-location'); if (v === 'home' || v === 'gym') set(v); } catch { /* optional */ } }, []);
  return [location, (v) => { set(v); try { localStorage.setItem('mingalar-location', v); } catch { /* optional */ } }];
}

// Home / Gym tabs: where the move fits, location-specific form cues, and a starting dose for the user's level.
export function ExerciseGuidance({ exercise, library }: { exercise: Exercise; library: Exercise[] }) {
  const { data, openExercise } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [location, setLocation] = useLocationPref();
  const g = (exercise.guidance ?? {}) as Guidance;
  const cues = (location === 'home' ? g.home : g.gym) ?? [];
  const level = (data.profile?.experience ?? 'beginner') as Level;
  const levels: Level[] = ['beginner', 'intermediate', 'advanced'];
  const text = (c: Cue) => (locale === 'my-MM' ? c.my ?? c.en : c.en);
  const homeAlternatives = !homeAvailable(exercise) ? (exercise.alternatives ?? []).map(id => library.find(e => e.id === id)).filter((e): e is Exercise => !!e && homeAvailable(e)) : [];
  const doseLine = (lv: Level) => { const d = doseFor({ tracking: exercise.tracking, equipment: exercise.equipment, tags: exercise.tags }, lv, !!g.perSide);
    return fill(d.unit === 'reps' ? tt.doseReps : tt.doseSeconds, { sets: d.sets, target: d.target }) + (d.perSide ? ` · ${tt.perSide}` : '') + (d.restSeconds !== '0' ? ` · ${fill(tt.restBetween, { rest: d.restSeconds })}` : ''); };
  const showLoadTip = doseFor({ tracking: exercise.tracking, equipment: exercise.equipment, tags: exercise.tags }, level).loadTip;
  return <section className="panel exercise-guidance" aria-label={tt.whereTrain}>
    <div className="guidance-head"><h2>{tt.whereTrain}</h2>
      <div className="seg-switch" role="tablist">{(['home', 'gym'] as const).map(l => <button key={l} role="tab" aria-selected={location === l} className={location === l ? 'selected' : ''} onClick={() => setLocation(l)}>{l === 'home' ? <House size={16}/> : <Building2 size={16}/>}{tt[l]}</button>)}</div></div>
    {location === 'home' && !homeAvailable(exercise) ? <div className="explain-box"><p>{tt.gymOnly}</p>
      {homeAlternatives.length > 0 && <p>{tt.homeAlternatives}: {homeAlternatives.map((a, i) => <button key={a.id} className="text-button" onClick={() => openExercise(a.id)}>{localExercise(a, locale).name}{i < homeAlternatives.length - 1 ? ',' : ''}</button>)}</p>}</div>
      : <><h3>{location === 'home' ? tt.homeCues : tt.gymCues}</h3><ul className="cue-list">{cues.map((c, i) => <li key={i} lang={locale === 'my-MM' && c.my ? 'my' : 'en'}>{text(c)}</li>)}</ul></>}
    <h3>{tt.recommendedDose}</h3>
    <table className="dose-table"><tbody>{levels.map(lv => <tr key={lv} className={lv === level ? 'mine' : ''}><th scope="row">{tt.levels[lv]}{lv === level ? ` · ${tt.yourLevel}` : ''}</th><td>{doseLine(lv)}</td></tr>)}</tbody></table>
    {showLoadTip && <p className="muted small">{tt.loadTip}</p>}
    <p className="muted small">{tt.doseNote}</p>
  </section>;
}
