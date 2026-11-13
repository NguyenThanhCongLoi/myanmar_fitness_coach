'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Loader2, Play } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { useIntakeLanguage } from '@/shared/intake-language';
import type { Exercise } from '@/shared/types';
import type { PlanDay } from '@/shared/plan';
import { getLocation } from './plan-view';
import {playbackSource,prefersLightVideo} from '@/shared/video-source';
import { StartBar } from './workout-music';

export function WorkoutIntro({ focus, minutes, title, image, back }: { focus: string; minutes: number; title: string; image: string; back: () => void }) {
  const { data, openWorkout, notify, refresh } = useApp(), { locale } = useLanguage(), tt = useTrainingLanguage(), u = useIntakeLanguage();
  const [day, setDay] = useState<(PlanDay & {seconds:number})|null>(null), [library, setLibrary] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false), [selected, setSelected] = useState<string|null>(null);
  const location = getLocation(data.profile?.trainingLocation);
  useEffect(()=>{let cancelled=false;setError(false);
    Promise.all([trainingApi<PlanDay & {seconds:number}>('quick-plan',{focus,minutes,location}),trainingApi<Exercise[]>('exercises')])
      .then(([d,lib])=>{if(!cancelled){setDay(d);setLibrary(lib);}}).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[focus,minutes,location]);
  async function start() {
    if (data.activeSession) { openWorkout(data.activeSession.id); return; }
    if (!day || busy) return; setBusy(true);
    try {const s = await trainingApi<{id:string}>('free',{name:title,location,exercises:day.items.map(i=>({exerciseId:i.id,sets:i.sets*(i.perSide&&i.unit==='seconds'?2:1),reps:i.target,restSeconds:i.rest,targetKg:i.weightKg??0,timed:i.unit==='seconds'}))});await refresh();openWorkout(s.id);}
    catch {notify(u.saveError);setBusy(false);}
  }
  return <section className="workout-intro">
    <button className="icon-button" aria-label={tt.ux.back} onClick={back}><ArrowLeft size={26}/></button>
    <div className="wi-hero" style={{backgroundImage:`url(${image})`}}><h1>{title}</h1></div>
    {error ? <p className="explain-box" role="alert">{u.noMatch}</p> : !day ? <div className="sk sk-card"/> : <>
      <div className="wi-meta"><span><Clock size={20}/>{location==='gym'?'~':''}{Math.ceil(day.seconds/60)} {tt.ux.min}</span><span>{day.items.length} {tt.ux.exercises}</span><span>{tt[location]}</span><span>{[...new Set(day.items.flatMap(i=>library.find(e=>e.id===i.id)?.primaryMuscles??[]))].slice(0,3).map(m=>tt.muscleNames[m as keyof typeof tt.muscleNames]??m).join(' \u00b7 ')}</span></div>
      {day.minutes < minutes-2 && <p className="muted">{u.budgetHint}</p>}
      <ol className="wi-exercises">{day.items.map(i=>{const e=library.find(e=>e.id===i.id);if(!e)return null;return <li key={i.id}>
        <button className="wi-row" aria-expanded={selected===i.id} onClick={()=>setSelected(selected===i.id?null:i.id)}><img src={e.thumbnailUrl??image} alt=""/><span><strong>{localExercise(e,locale).name.split('—')[0]}</strong><small>{i.sets} × {i.target} {i.unit==='seconds'?tt.ux.sec:tt.ux.reps}{i.perSide?` · ${u.left} / ${u.right}`:''}</small><small>{u.rest} {i.rest}s</small></span><Play size={22}/></button>
        {selected===i.id&&e.videoUrl&&<video className="wi-video" src={playbackSource(e.videoUrl,prefersLightVideo())!} autoPlay muted loop playsInline controls/>}
      </li>;})}</ol>
      <StartBar label={busy?tt.ux.starting:data.activeSession?tt.ux.resume:tt.ux.start} busy={busy} icon={busy?<Loader2 className="spin" size={24}/>:undefined} onStart={()=>void start()}/>
    </>}
  </section>;
}
