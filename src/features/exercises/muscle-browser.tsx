'use client';
import { useState } from 'react';
import { ArrowUpRight, Building2, House, PlayCircle } from 'lucide-react';
import type { Exercise } from '@/shared/types';
import { useApp } from '@/shared/app-context';
import { localExercise } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { exercisesFor, MUSCLE_GROUPS, pickSession, SPLITS, type MuscleGroup } from '@/shared/program';
import type { Level } from '@/shared/dose';
import { MuscleMap } from './muscle-map';

type Selection = { kind: 'group'; id: MuscleGroup } | { kind: 'split'; id: keyof typeof SPLITS };

// Browse exercises by muscle group or by muscles trained together, each split into Home and Gym.
export function MuscleBrowser({ library }: { library: Exercise[] }) {
  const { openExercise, openTrain, data } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [selected, setSelected] = useState<Selection>({ kind: 'group', id: 'chest' });
  const muscles = selected.kind === 'group' ? MUSCLE_GROUPS[selected.id] : SPLITS[selected.id];
  const title = selected.kind === 'group' ? tt.groups[selected.id] : tt.splits[selected.id];
  const level = (data.profile?.experience ?? 'beginner') as Level;
  const picks = new Set([...pickSession(selected.kind === 'group' ? 'full' : selected.id, library.filter(e => (e.primaryMuscles ?? []).some(m => (muscles as readonly string[]).includes(m))), 'home', level, 2), ...pickSession(selected.kind === 'group' ? 'full' : selected.id, library.filter(e => (e.primaryMuscles ?? []).some(m => (muscles as readonly string[]).includes(m))), 'gym', level, 2)].map(p => p.exercise.id));
  const row = (e: Exercise) => {
    const image = e.steps?.find(s => s.image)?.image;
    return <button key={e.id} className="ex-row" onClick={() => openExercise(e.id)} data-exercise={e.canonicalId ?? e.id}>
      <span className="ex-thumb">{image ? <img src={image} alt="" loading="lazy" decoding="async"/> : <MuscleMap primary={e.primaryMuscles ?? []} secondary={e.secondaryMuscles ?? []} compact/>}</span>
      <span className="ex-text">{picks.has(e.id) && <span className="top-pick">★ {tt.topPick}</span>}<strong>{localExercise(e, locale).name}</strong><small>{tt.levels[e.difficulty as keyof typeof tt.levels] ?? e.difficulty}{e.videoUrl ? <> · <PlayCircle size={12}/> {tt.video}</> : null}</small></span>
      <ArrowUpRight size={16}/>
    </button>;
  };
  const home = exercisesFor(muscles, library, 'home') as Exercise[];
  const gym = (exercisesFor(muscles, library, 'gym') as Exercise[]).filter(e => !home.includes(e));
  return <div className="muscle-browser">
    <div className="group-grid" role="tablist" aria-label={tt.byMuscle}>
      {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map(g => {
        const count = exercisesFor(MUSCLE_GROUPS[g], library).length;
        return <button key={g} role="tab" aria-selected={selected.kind === 'group' && selected.id === g} className={`group-card ${selected.kind === 'group' && selected.id === g ? 'selected' : ''}`} onClick={() => setSelected({ kind: 'group', id: g })}>
          <span className="group-map"><MuscleMap primary={[...MUSCLE_GROUPS[g]]} secondary={[]} compact/></span>
          <strong>{tt.groups[g]}</strong><small>{fill(tt.exercisesN, { n: count })}</small></button>;
      })}
    </div>
    <h2 className="section-title">{tt.splitsTitle}</h2>
    <p className="muted small">{tt.splitsHint}</p>
    <div className="split-row">{(Object.keys(SPLITS) as (keyof typeof SPLITS)[]).map(s => <button key={s} className={`split-chip ${selected.kind === 'split' && selected.id === s ? 'selected' : ''}`} aria-pressed={selected.kind === 'split' && selected.id === s} onClick={() => setSelected({ kind: 'split', id: s })}>{tt.splits[s]}</button>)}</div>
    <section className="panel group-detail" aria-label={title}>
      <div className="group-detail-head">
        <div className="group-detail-map"><MuscleMap primary={[...muscles]} secondary={[]} compact/></div>
        <div><h2>{title}</h2><p className="muted small">{fill(tt.exercisesN, { n: home.length + gym.length })}</p>
          {selected.kind === 'split' && <div className="split-actions">
            <button className="button primary" onClick={() => openTrain({ mode: 'follow', focus: selected.id, minutes: 20 })}><PlayCircle size={17}/>{tt.startFollowSession}</button>
            <button className="button secondary" onClick={() => openTrain({ mode: 'free', name: tt.splits[selected.id], rows: pickSession(selected.id, library, 'gym', level).map(p => ({ exerciseId: p.exercise.id, sets: Number(p.dose.sets), reps: Number(String(p.dose.target).split('–').pop()) || 10, restSeconds: Number(String(p.dose.restSeconds).split('–').pop()) || 60 })) })}>{tt.startFreeSession}</button>
          </div>}</div>
      </div>
      <div className="place-columns">
        <div><h3><House size={16}/> {tt.atHome}</h3>{home.length ? home.map(row) : <p className="muted small">{tt.noneHere}</p>}</div>
        <div><h3><Building2 size={16}/> {tt.atGym}</h3>{gym.length ? gym.map(row) : <p className="muted small">{tt.noneHere}</p>}</div>
      </div>
    </section>
  </div>;
}
