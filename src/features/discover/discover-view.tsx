'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, ChevronRight, Compass, Dumbbell, ListPlus, PlayCircle, Timer } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';
import { BeeTip } from '../gamification/bee-tip';
import { groupOf, placeOf, type MuscleGroup } from '@/shared/plan';

// Gym-beginner machines first (simple, guided path), then cables and basic free weights.
const GYM_GUIDE = ['gym-leg-press', 'gym-machine-chest-press', 'gym-lat-pulldown', 'gym-seated-cable-row', 'gym-machine-shoulder-press', 'gym-lying-leg-curl', 'gym-leg-extension',
  'gym-lying-leg-curl-machine', 'gym-hip-adduction', 'gym-seated-calf-raise', 'gym-assisted-pullup', 'gym-pec-deck', 'gym-smith-squat', 'gym-hack-squat', 'gym-triceps-pushdown', 'gym-cable-biceps-curl', 'core-163', 'gym-cable-crossover'];

export function DiscoverView() {
  const { go, openTrain, openExercise } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux;
  const [library, setLibrary] = useState<Exercise[]>([]); const [gym, setGym] = useState(false); const [place, setPlace] = useState<'home' | 'gym'>('home'); const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, []);
  const name = (e: Exercise) => localExercise(e, locale).name.split('—')[0].trim();
  const card = (e: Exercise) => <button key={e.id} type="button" className="media-card" onClick={() => openExercise(e.id)}>
    <span className="media-card-img" style={e.thumbnailUrl ? { backgroundImage: `url(${e.thumbnailUrl})` } : undefined}>{e.videoUrl && <PlayCircle size={22}/>}<em className={`place-badge ${placeOf(e)}`}>{placeOf(e) === 'gym' ? u.placeGym : u.placeHome}</em></span>
    <span className="media-card-text"><strong>{name(e)}</strong><small>{(e.primaryMuscles ?? []).map(m => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m).join(' · ')}</small></span></button>;
  if (gym) {
    const machines = GYM_GUIDE.map(id => library.find(e => e.id === id)).filter((e): e is Exercise => !!e);
    return <section className="discover-view">
      <button type="button" className="text-button back-link" onClick={() => setGym(false)}><ArrowLeft size={16}/>{u.back}</button>
      <div className="page-heading"><span className="overline"><Dumbbell size={14}/> {u.gymGuide}</span><h1>{u.gymTitle}</h1><p>{u.gymIntro}</p></div>
      <section className="panel gym-tips"><h2>{u.firstVisit}</h2><ol>{u.gymTips.map(tip => <li key={tip}>{tip}</li>)}</ol></section>
      <button type="button" className="button primary big-start" onClick={async () => { await trainingApi('program', { program: 'gym_beginner' }); try { localStorage.setItem('mingalar-location', 'gym'); } catch { /* optional */ } go('home'); }}>{u.startGymProgram}</button>
      <h2 className="section-title">{u.machines}</h2><p className="muted small">{u.machinesHint}</p>
      <div className="media-grid">{machines.map(card)}</div>
    </section>;
  }
  const inPlace = library.filter(e => e.videoUrl && placeOf(e) === place);
  const groups = (['chest', 'back', 'legs', 'arms', 'core', 'shoulders'] as const).filter(g => inPlace.some(e => groupOf(e) === g));
  const videos = group === 'all' ? inPlace : inPlace.filter(e => groupOf(e) === group);
  return <section className="discover-view">
    <div className="page-heading"><span className="overline"><Compass size={14}/> {u.discover}</span><h1>{u.discoverTitle}</h1></div>
    <BeeTip context="library"/>
    <button type="button" className="feature-banner" onClick={() => setGym(true)}>
      <span><small>{u.newToGym}</small><strong>{u.gymTitle}</strong><em>{u.gymBannerHint}</em></span><ChevronRight size={22}/></button>
    <h2 className="section-title">{u.quick}</h2>
    <div className="quick-row">{[7, 15, 20].map(m => <button key={m} type="button" className="quick-card" onClick={() => openTrain({ mode: 'follow', focus: 'all', minutes: m })}><Timer size={22}/><strong>{m} {u.min}</strong><small>{u.quickHint}</small></button>)}</div>
    <h2 className="section-title">{u.withVideo}</h2>
    <div className="seg-switch">{(['home', 'gym'] as const).map(p => <button key={p} type="button" className={place === p ? 'selected' : ''} aria-pressed={place === p} onClick={() => { setPlace(p); setGroup('all'); }}>{p === 'home' ? u.placeHome : u.placeGym} · {library.filter(e => e.videoUrl && placeOf(e) === p).length}</button>)}</div>
    <p className="muted small">{place === 'home' ? u.placeHomeHint : u.placeGymHint}</p>
    <div className="chip-row" role="group">{(['all', ...groups] as const).map(g => <button key={g} type="button" className={`chip-filter ${group === g ? 'on' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>{g === 'all' ? u.groupAll : u.groupNames[g]}</button>)}</div>
    <div className="media-grid">{videos.map(card)}</div>
    <div className="link-list">
      <button type="button" onClick={() => go('exercises')}><BookOpen size={20}/><span><strong>{u.library}</strong><small>{u.libraryHint}</small></span><ChevronRight size={18}/></button>
      <button type="button" onClick={() => openTrain({ mode: 'free', name: u.myWorkout, rows: [] })}><ListPlus size={20}/><span><strong>{u.buildOwn}</strong><small>{u.buildOwnHint}</small></span><ChevronRight size={18}/></button>
      <button type="button" onClick={() => go('plans')}><Dumbbell size={20}/><span><strong>{tt.myPlans}</strong><small>{u.savedPlansHint}</small></span><ChevronRight size={18}/></button>
    </div>
  </section>;
}
