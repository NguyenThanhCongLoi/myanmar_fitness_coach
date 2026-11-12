'use client';
import { ArrowUpRight, Dumbbell, Sparkles } from 'lucide-react';
import type { Exercise } from '@/shared/types';
import { useApp } from '@/shared/app-context';
import { localExercise } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { doseFor, type Level } from '@/shared/dose';
import { EVIDENCE, recommendFor } from '@/shared/program';
import { MuscleMap } from './muscle-map';
import { useLocationPref } from './exercise-guidance';

// Same-muscle alternatives from another angle + complementary exercises for the same session, with the reason for each.
export function ExerciseRecommendations({ exercise, library }: { exercise: Exercise; library: Exercise[] }) {
  const { data, openExercise, openTrain } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [location] = useLocationPref();
  const level = (data.profile?.experience ?? 'beginner') as Level;
  const r = recommendFor(exercise, library, location, level);
  if (!r.sameMuscle.length && !r.complementary.length) return null;
  const byId = (id: string) => library.find(e => e.id === id)!;
  const card = (id: string, reason: string) => { const e = byId(id); const image = e.steps?.find(s => s.image)?.image;
    return <button key={id} className="reco-card" onClick={() => openExercise(id)}>
      <span className="ex-thumb">{image ? <img src={image} alt="" loading="lazy"/> : <MuscleMap primary={e.primaryMuscles ?? []} secondary={[]} compact/>}</span>
      <span className="ex-text"><strong>{localExercise(e, locale).name}</strong><small>{tt.recoReasons[reason as keyof typeof tt.recoReasons] ?? reason}</small></span><ArrowUpRight size={16}/></button>; };
  const session = [exercise, ...r.complementary.map(x => byId(x.id))].slice(0, 5);
  return <section id="ex-reco" className="panel exercise-reco" aria-label={tt.recoTitle}>
    <h2><Sparkles size={18}/> {tt.recoTitle}</h2>
    {r.sameMuscle.length > 0 && <><h3>{tt.recoSameMuscle}</h3><div className="reco-grid">{r.sameMuscle.map(x => card(x.id, x.reason))}</div></>}
    {r.complementary.length > 0 && <><h3>{tt.recoComplement}</h3><div className="reco-grid">{r.complementary.map(x => card(x.id, x.reason))}</div>
      <button className="button secondary" onClick={() => openTrain({ mode: 'free', name: localExercise(exercise, locale).name, rows: session.map(e => { const d = doseFor({ tracking: e.tracking, equipment: e.equipment, tags: e.tags }, level); return { exerciseId: e.id, sets: Number(d.sets), reps: Number(d.target.split('–').pop()) || 10, restSeconds: Number(d.restSeconds.split('–').pop()) || 60 }; }) })}><Dumbbell size={17}/>{tt.buildSession}</button></>}
    <details className="evidence"><summary>{tt.evidenceTitle}</summary><ul lang="en">{EVIDENCE.map(x => <li key={x}>{x}</li>)}</ul></details>
  </section>;
}
