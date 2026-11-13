'use client';
import { availableAt, hasCollectionVideo, isHomeExercise } from '@/shared/exercise-place';
import { BeeTip } from '../gamification/bee-tip';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, House, Loader2, Play, PlayCircle, Search } from 'lucide-react';
import { localExercise, trainingApi } from '@/shared/client';
import { useApp } from '@/shared/app-context';
import { errorText, useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { Empty } from '@/shared/ui';
import type { Exercise } from '@/shared/types';
import { MuscleMap, MAPPED_MUSCLES } from './muscle-map';
import { ExerciseMedia } from './exercise-media';
import { homeAvailable, useLocationPref } from './exercise-guidance';
import { MuscleBrowser } from './muscle-browser';
import type { PlanDay as GeneratedDay } from '@/shared/plan';
import { trainingErrorText } from '../training/training-hub';
import { music, StartBar } from '../plan/workout-music';
import { workoutVoice } from '@/locales/workout-voice';

export function ExerciseView() {
  const { notify, exerciseId, openExercise } = useApp(); const { locale, t } = useLanguage(); const tt = useTrainingLanguage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all');
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setExercises).catch(error => notify(errorText(error, t), true)).finally(() => setLoading(false)); }, []);
  const [location, setLocation] = useLocationPref(); const [place, setPlace] = useState<'all' | 'home' | 'gym'>('all');
  useEffect(() => { setPlace(location); }, [location]);
  const [tab, setTab] = useState<'muscles' | 'all'>('muscles');
  const selected = exercises.find(e => e.id === exerciseId);
  if (selected) return <ExerciseDetail exercise={selected} library={exercises}/>;
  const results = exercises.filter(exercise => (place === 'all' ? (availableAt(exercise,'home') || availableAt(exercise,'gym')) : availableAt(exercise,place)) && hasCollectionVideo(exercise) && (filter === 'all' || exercise.equipment.includes(filter)) && `${exercise.name} ${localExercise(exercise, locale).name} ${(exercise.primaryMuscles ?? exercise.muscles).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <section><div className="page-heading"><span className="overline">{t.movement}</span><h1>{t.browse}</h1><p>{t.browseHint}</p></div><BeeTip context="library"/>
    <div className="seg-switch library-tabs" role="tablist">{(['muscles', 'all'] as const).map(x => <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'selected' : ''} onClick={() => setTab(x)}>{x === 'muscles' ? tt.byMuscle : tt.allExercises}</button>)}</div>
    {tab === 'muscles' ? (loading ? <p className="loading-inline">{t.loading}</p> : <MuscleBrowser library={exercises.filter(e=>availableAt(e,location)&&hasCollectionVideo(e))}/>) : <>
    <div className="library-toolbar"><div className="search-box"><Search size={19}/><input aria-label={t.search} placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)}/></div><span className="count-label">{results.length} {t.exercises}</span></div>
    <div className="seg-switch library-place" role="tablist">{(['all', 'home', 'gym'] as const).map(p => <button key={p} role="tab" aria-selected={place === p} className={place === p ? 'selected' : ''} onClick={() => { setPlace(p); if (p !== 'all') setLocation(p); }}>{p === 'all' ? t.all : tt[p]}</button>)}</div>
    <div className="filter-row">{['all', 'body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'].map(item => <button key={item} className={`filter ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item === 'all' ? t.all : t.equipmentLabels[item as keyof typeof t.equipmentLabels]}</button>)}</div>
    {loading ? <p className="loading-inline">{t.loading}</p> : <div className="exercise-grid">{results.map(exercise => {
      const primary = exercise.primaryMuscles ?? [];
      return <button key={exercise.id} className="exercise-card" onClick={() => openExercise(exercise.id)} data-exercise={exercise.canonicalId ?? exercise.id}>
        <div className="card-map"><MuscleMap primary={primary} secondary={exercise.secondaryMuscles ?? []} compact/><span className="card-badges">{exercise.videoUrl && <span className="card-badge"><PlayCircle size={13}/>{tt.video}</span>}{isHomeExercise(exercise) && <span className="card-badge"><House size={13}/>{tt.home}</span>}</span></div><div className="exercise-card-body"><span className="overline">{primary.map(m => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m).join(' · ') || exercise.muscles[0]}</span><h3>{localExercise(exercise, locale).name}</h3>
          <div className="card-meta"><span>{exercise.equipment.map(item => t.equipmentLabels[item as keyof typeof t.equipmentLabels] ?? item).join(' · ')}</span><ArrowUpRight size={18}/></div></div></button>;
    })}</div>}
    {!loading && !results.length && <Empty title={t.noResults}/>}</>}<p className="translation-note">{t.provisional}</p></section>;
}

// Exercise intro: video + muscles at a glance, "Try this" for the single move, and a same-muscle set with a sticky Start bar.
function ExerciseDetail({ exercise, library }: { exercise: Exercise; library: Exercise[] }) {
  const { openExercise, openWorkout, refresh, notify, data } = useApp(); const { locale, t } = useLanguage(); const tt = useTrainingLanguage();
  const v = workoutVoice[locale === 'my-MM' ? 'my' : 'en'];
  const [pref] = useLocationPref();
  const [busy, setBusy] = useState<'one' | 'set' | null>(null);
  const local = localExercise(exercise, locale);
  const primary = exercise.primaryMuscles ?? [], secondary = exercise.secondaryMuscles ?? [];
  const mapped = primary.some(m => MAPPED_MUSCLES.has(m));
  const name = (m: string) => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m;
  const place: 'home' | 'gym' = availableAt(exercise, pref) ? pref : pref === 'home' ? 'gym' : 'home';
  const [preview,setPreview]=useState<GeneratedDay|null>(null);
  const [previewError,setPreviewError]=useState(false);
  useEffect(()=>{let cancelled=false;setPreview(null);setPreviewError(false);
    trainingApi<GeneratedDay>('quick-plan',{focus:'all',minutes:20,location:place,exerciseId:exercise.id})
      .then(d=>{if(!cancelled)setPreview(d);}).catch(()=>{if(!cancelled)setPreviewError(true);});
    return()=>{cancelled=true;};
  },[exercise.id,place]);
  const doseText=(e:Exercise)=>{const i=preview?.items.find(i=>i.id===e.id);return i?`${i.sets} \u00d7 ${i.target} ${i.unit==='seconds'?tt.ux.sec:tt.ux.reps}${i.perSide?` \u00b7 ${tt.perSide}`:''}`:t.loading;};
  const set = (preview?.items??[]).map(i=>library.find(e=>e.id===i.id)).filter((e):e is Exercise=>!!e);
  const minutes = preview?.minutes??0;
  async function start(_list: Exercise[], kind: 'one' | 'set') {
    if (data.activeSession) { openWorkout(data.activeSession.id); return; }
    setBusy(kind);
    const title = (kind === 'one' ? local.name : `${v.setTitle} · ${local.name}`).split('—')[0].trim().slice(0, 100);
    try { const plan=kind==='one'?await trainingApi<GeneratedDay>('quick-plan',{focus:'all',minutes:15,location:place,exerciseId:exercise.id,single:true}):preview;
      if(!plan?.items.length)throw new Error('NO_EXERCISE_MATCH');
      const s = await trainingApi<{ id: string }>('free', { name: title.length >= 2 ? title : v.setTitle, location: place, exercises: plan.items.map(i=>({exerciseId:i.id,sets:i.sets*(i.perSide&&i.unit==='seconds'?2:1),reps:i.target,restSeconds:i.rest,targetKg:i.weightKg??0,timed:i.unit==='seconds'})) }); await refresh(); openWorkout(s.id); }
    catch (e) { notify(trainingErrorText(e, t, tt)); setBusy(null); }
  }
  useEffect(() => { window.scrollTo({ top: 0 }); }, [exercise.id]);
  return <section className="exercise-detail ex-intro" data-exercise={exercise.canonicalId ?? exercise.id}>
    <button className="text-button back-link" onClick={() => openExercise('')}><ArrowLeft size={18}/>{tt.back}</button>
    <header className="detail-header">
      <span className="overline">{tt.detailTitle}</span>
      <h1 lang={exercise.translations.some(x => x.locale === locale) ? locale : 'en'}>{local.name}</h1>
      <div className="detail-tags">
        <span>{tt.levels[exercise.difficulty as keyof typeof tt.levels] ?? exercise.difficulty}</span>
        <span>{exercise.equipment.map(item => t.equipmentLabels[item as keyof typeof t.equipmentLabels] ?? item).join(' · ')}</span>
        <span>{exercise.tracking === 'timed' ? tt.trackingTimed : tt.trackingReps}</span>
        <span className={homeAvailable(exercise) ? 'ok' : 'muted-tag'}><House size={14}/>{homeAvailable(exercise) ? tt.home : tt.gymOnlyShort}</span>
      </div>
    </header>
    <div className="detail-hero">
      <div className="panel hero-media"><ExerciseMedia exercise={exercise} autoPlay/></div>
      <aside className="panel hero-summary">
        <h2>{tt.summary}</h2>
        {mapped && <div className="summary-map"><MuscleMap primary={primary} secondary={secondary} compact label={`${tt.primary}: ${primary.map(name).join(', ')}`}/></div>}
        <div className="chip-group"><span className="chip-label">{tt.primary}</span>{primary.map(m => <span key={m} className="chip primary">{name(m)}</span>)}</div>
        {secondary.length > 0 && <div className="chip-group"><span className="chip-label">{tt.secondary}</span>{secondary.map(m => <span key={m} className="chip secondary">{name(m)}</span>)}</div>}
        <div className="summary-dose"><span className="chip-label">{tt.yourDose}</span><strong>{doseText(exercise)}</strong></div>
        {<button type="button" className="button secondary ex-try" disabled={busy !== null || !preview} onClick={() => { music.prime(); void start([exercise], 'one'); }}>{busy === 'one' ? <Loader2 className="spin" size={20}/> : <Play size={20}/>}{v.tryThis}</button>}
      </aside>
    </div>
    {set.length > 1 && <section className="panel ex-set" aria-label={v.setTitle}>
      <div className="ex-set-head"><h2>{v.setTitle}</h2><small>{fill(v.setHint, { n: set.length, min: minutes })}</small></div>
      <ol className="ex-set-list">{set.map(e => <li key={e.id}><button type="button" className={e.id === exercise.id ? 'current' : ''} onClick={() => { if (e.id !== exercise.id) openExercise(e.id); }}>
        <span className="ex-set-thumb" style={e.thumbnailUrl ? { backgroundImage: `url(${e.thumbnailUrl})` } : undefined}>{!e.thumbnailUrl && <MuscleMap primary={e.primaryMuscles ?? []} secondary={[]} compact/>}</span>
        <span className="ex-set-text"><strong>{localExercise(e, locale).name.split('—')[0].trim()}</strong><small>{(e.primaryMuscles ?? []).map(name).join(' · ')}</small><small>{doseText(e)}</small></span>
        {e.id !== exercise.id && <ArrowUpRight size={18}/>}</button></li>)}</ol>
    </section>}
    {locale === 'my-MM' && <p className="translation-note">{tt.stepsProvisional}</p>}
    {previewError&&<p className="explain-box" role="alert">{tt.errors.NO_EXERCISE_MATCH}</p>}
    <StartBar disabled={!preview} label={busy === 'set' ? tt.ux.starting : data.activeSession ? tt.ux.resume : set.length > 1 ? v.startSet : tt.ux.start} busy={busy !== null} icon={busy === 'set' ? <Loader2 className="spin" size={24}/> : undefined} onStart={() => void start(set, 'set')}/>
  </section>;
}
