'use client';
import { BeeTip } from '../gamification/bee-tip';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, House, MessageCircle, PlayCircle, Search } from 'lucide-react';
import { localExercise, trainingApi } from '@/shared/client';
import { useApp } from '@/shared/app-context';
import { errorText, useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { Empty } from '@/shared/ui';
import type { Exercise } from '@/shared/types';
import { MuscleMap, MAPPED_MUSCLES } from './muscle-map';
import { ExerciseMedia } from './exercise-media';
import { ExerciseSteps } from './exercise-steps';
import { ExerciseGuidance, homeAvailable, useLocationPref } from './exercise-guidance';
import { HOME_EQUIPMENT, doseFor, type Level } from '@/shared/dose';
import { MuscleBrowser } from './muscle-browser';
import { ExerciseRecommendations } from './exercise-recommendations';
import { fill } from '@/shared/training-language';
import { CoachChat } from '../ai-coach/coach-chat';
import { BeeMessage } from '../gamification/mascot';

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
  const results = exercises.filter(exercise => (place !== 'home' || homeAvailable(exercise) || exercise.equipment.every(q => HOME_EQUIPMENT.includes(q))) && (filter === 'all' || exercise.equipment.includes(filter)) && `${exercise.name} ${localExercise(exercise, locale).name} ${(exercise.primaryMuscles ?? exercise.muscles).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <section><div className="page-heading"><span className="overline">{t.movement}</span><h1>{t.browse}</h1><p>{t.browseHint}</p></div><BeeTip context="library"/>
    <div className="seg-switch library-tabs" role="tablist">{(['muscles', 'all'] as const).map(x => <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'selected' : ''} onClick={() => setTab(x)}>{x === 'muscles' ? tt.byMuscle : tt.allExercises}</button>)}</div>
    {tab === 'muscles' ? (loading ? <p className="loading-inline">{t.loading}</p> : <MuscleBrowser library={exercises}/>) : <>
    <div className="library-toolbar"><div className="search-box"><Search size={19}/><input aria-label={t.search} placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)}/></div><span className="count-label">{results.length} {t.exercises}</span></div>
    <div className="seg-switch library-place" role="tablist">{(['all', 'home', 'gym'] as const).map(p => <button key={p} role="tab" aria-selected={place === p} className={place === p ? 'selected' : ''} onClick={() => { setPlace(p); if (p !== 'all') setLocation(p); }}>{p === 'all' ? t.all : tt[p]}</button>)}</div>
    <div className="filter-row">{['all', 'body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'].map(item => <button key={item} className={`filter ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item === 'all' ? t.all : t.equipmentLabels[item as keyof typeof t.equipmentLabels]}</button>)}</div>
    {loading ? <p className="loading-inline">{t.loading}</p> : <div className="exercise-grid">{results.map(exercise => {
      const primary = exercise.primaryMuscles ?? [];
      return <button key={exercise.id} className="exercise-card" onClick={() => openExercise(exercise.id)} data-exercise={exercise.canonicalId ?? exercise.id}>
        <div className="card-map"><MuscleMap primary={primary} secondary={exercise.secondaryMuscles ?? []} compact/><span className="card-badges">{exercise.videoUrl && <span className="card-badge"><PlayCircle size={13}/>{tt.video}</span>}{homeAvailable(exercise) && <span className="card-badge"><House size={13}/>{tt.home}</span>}</span></div><div className="exercise-card-body"><span className="overline">{primary.map(m => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m).join(' · ') || exercise.muscles[0]}</span><h3>{localExercise(exercise, locale).name}</h3>
          <div className="card-meta"><span>{exercise.equipment.map(item => t.equipmentLabels[item as keyof typeof t.equipmentLabels] ?? item).join(' · ')}</span><ArrowUpRight size={18}/></div></div></button>;
    })}</div>}
    {!loading && !results.length && <Empty title={t.noResults}/>}</>}<p className="translation-note">{t.provisional}</p></section>;
}

function ExerciseDetail({ exercise, library }: { exercise: Exercise; library: Exercise[] }) {
  const { openExercise, openCoach, data } = useApp(); const { locale, t } = useLanguage(); const tt = useTrainingLanguage();
  const local = localExercise(exercise, locale);
  const primary = exercise.primaryMuscles ?? [], secondary = exercise.secondaryMuscles ?? [];
  const mapped = primary.some(m => MAPPED_MUSCLES.has(m));
  const name = (m: string) => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m;
  const alternatives = (exercise.alternatives ?? []).map(id => library.find(e => e.id === id)).filter((e): e is Exercise => Boolean(e));
  const g = exercise.guidance ?? {};
  const mistakes = (g.mistakes?.length ? g.mistakes : (exercise.commonMistakes ?? []).map(en => ({ en, my: null })));
  const level = (data.profile?.experience ?? 'beginner') as Level;
  const dose = doseFor({ tracking: exercise.tracking, equipment: exercise.equipment, tags: exercise.tags }, level, !!g.perSide);
  const doseText = fill(dose.unit === 'reps' ? tt.doseReps : tt.doseSeconds, { sets: dose.sets, target: dose.target }) + (dose.perSide ? ` · ${tt.perSide}` : '');
  const say = (c: { en: string; my: string | null }) => (locale === 'my-MM' ? c.my ?? c.en : c.en);
  const lang = (c: { my: string | null }) => (locale === 'my-MM' && c.my ? 'my' : 'en');
  const sections = [['how', tt.sectionHow], ['place', tt.whereTrain], ['reco', tt.recoTitle], ...(mistakes.length ? [['mistakes', tt.mistakes]] : []), ...(alternatives.length ? [['alternatives', tt.alternatives]] : []), ['coach', t.coach]] as [string, string][];
  useEffect(() => { window.scrollTo({ top: 0 }); }, [exercise.id]);
  return <section className="exercise-detail" data-exercise={exercise.canonicalId ?? exercise.id}>
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
        <div className="summary-dose"><span className="chip-label">{tt.yourDose}</span><strong>{doseText}</strong></div>
      </aside>
    </div>
    <nav className="section-nav" aria-label={tt.detailTitle}>{sections.map(([id, label]) => <a key={id} href={`#ex-${id}`}>{label}</a>)}</nav>
    <div id="ex-how"><ExerciseSteps exercise={exercise}/></div>
    <div id="ex-place"><ExerciseGuidance exercise={exercise} library={library}/></div>
    <ExerciseRecommendations exercise={exercise} library={library}/>
    {mistakes.length > 0 && <section id="ex-mistakes" className="panel"><h2>{tt.mistakes}</h2><ul className="cue-list mistakes">{mistakes.map((m, i) => <li key={i} lang={lang(m)}>{say(m)}</li>)}</ul></section>}
    {alternatives.length > 0 && <section id="ex-alternatives" className="panel"><h2>{tt.alternatives}</h2><div className="alt-grid">{alternatives.map(alt => <button key={alt.id} className="alt-card" onClick={() => openExercise(alt.id)}>
      <span className="alt-map"><MuscleMap primary={alt.primaryMuscles ?? []} secondary={alt.secondaryMuscles ?? []} compact/></span>
      <span className="alt-text"><strong>{localExercise(alt, locale).name}</strong><small>{tt.levels[alt.difficulty as keyof typeof tt.levels] ?? alt.difficulty} · {(alt.primaryMuscles ?? []).map(name).join(' · ')}</small></span><ArrowUpRight size={18}/></button>)}</div></section>}
    <section id="ex-coach" className="panel exercise-coach" aria-label={tt.coachPanelTitle}>
      <div className="exercise-coach-head"><h2><MessageCircle size={18}/> {tt.coachPanelTitle}</h2><BeeMessage state="pointing" size={56} text={tt.coachPanelBee}/></div>
      <CoachChat key={exercise.id} exerciseId={exercise.id} compact quickActions={[tt.quick.explain, tt.quick.technique, tt.quick.setsReps, tt.quick.load, tt.quick.history, tt.quick.alternatives, tt.quick.easier, tt.quick.harder, tt.quick.addToPlan]}/>
      <button className="text-button" onClick={() => openCoach(`${local.name} (ID: ${exercise.id}) — `)}>{tt.askCoach} →</button>
    </section>
    {locale === 'my-MM' && <p className="translation-note">{tt.stepsProvisional}</p>}
  </section>;
}
