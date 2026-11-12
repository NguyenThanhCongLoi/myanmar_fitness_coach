'use client';
import { useEffect, useState } from 'react';
import { PlayCircle, Dumbbell, CalendarDays } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';
import { BeeMessage } from '../gamification/mascot';
import { MuscleMap } from '../exercises/muscle-map';
import { ReadinessCheck } from './readiness';
import { gameApi } from '@/shared/game-client';

type Today = { anyway?: boolean; canTrainAnyway?: boolean; scheduleChosen?: boolean; weekdays?: number[]; weekInBlock?: number; deload?: boolean; readiness: { sleep: number; energy: number; soreness: number; score: number } | null; reasons: { code: string }[]; split: string | null; recovery: boolean; exercises: { id: string; sets: string; target: string; restSeconds: string }[] };
const FOCUS: Record<string, string> = { push: 'push', pull: 'pull', legs: 'legs', core: 'core', full: 'all', upper: 'upper', lower: 'legs' };
// Home hero: today's coach session first (or a recovery day), one tap to start.
export function TodayCard() {
  const { openTrain, data, notify } = useApp(); const { locale, t } = useLanguage(); const tt = useTrainingLanguage();
  const [anyway, setAnyway] = useState(false); const [editDays, setEditDays] = useState(false); const [days, setDays] = useState<number[]>([]); const [savingDays, setSavingDays] = useState(false);
  const [today, setToday] = useState<Today | null>(null); const [library, setLibrary] = useState<Exercise[]>([]);
  const location = (() => { try { return localStorage.getItem('mingalar-location') === 'gym' ? 'gym' : 'home'; } catch { return 'home'; } })();
  const loadToday = (force = anyway) => trainingApi<Today>(`today?location=${location}${force ? '&anyway=1' : ''}`).then(v => { setToday(v); setDays(v.weekdays ?? []); }).catch(() => {});
  async function saveDays() {
    setSavingDays(true);
    try { await gameApi('schedule', { weekdays: days }); setEditDays(false); notify(tt.daysSaved); await loadToday(); }
    catch { notify(t.error, true); } finally { setSavingDays(false); }
  }
  useEffect(() => { if (!data.profile?.onboarded) return; void loadToday(); trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, []);
  if (!today) return null;
  const items = today.exercises.map(x => library.find(e => e.id === x.id)).filter((e): e is Exercise => !!e);
  const muscles = [...new Set(items.flatMap(e => e.primaryMuscles ?? []))];
  return <section className="today-card" aria-label={tt.todayCardTitle}>
    <div className="today-card-text">
      <span className="overline">{tt.todayCardTitle} · {location === 'gym' ? tt.gym : tt.home}</span>
      <ReadinessCheck existing={today.readiness} onSaved={() => void loadToday()} dark/>
      {today.reasons.some(r => r.code === 'LOW_READINESS') && <p className="today-note">{tt.lowReadiness}</p>}
      {today.weekInBlock && <p className="today-note">{fill(tt.blockWeek, { n: locale === 'my-MM' ? String(today.weekInBlock).replace(/\d/g, d => '၀၁၂၃၄၅၆၇၈၉'[Number(d)]) : today.weekInBlock })}{today.deload ? ` · ${tt.deloadNote}` : ''}</p>}
      {today.reasons.some(r => r.code === 'SCREENING_CAUTION') && <p className="today-note">{tt.screeningCaution}</p>}
      {(!today.scheduleChosen || editDays) ? <fieldset className="today-days"><legend><CalendarDays size={16}/> {tt.chooseDaysTitle}</legend><p className="small">{tt.chooseDaysHint}</p>
        <div className="weekday-choices">{t.weekdaysShort.map((d, i) => <button type="button" key={i} aria-pressed={days.includes(i)} className={`day-choice ${days.includes(i) ? 'selected' : ''}`} onClick={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])}>{d}</button>)}</div>
        <button type="button" className="button lime" disabled={savingDays || !days.length || days.length > 6} onClick={() => void saveDays()}>{fill(tt.saveDays, { n: days.length })}</button></fieldset>
      : <p className="today-days-line"><CalendarDays size={15}/> {(today.weekdays ?? []).map(i => t.weekdaysShort[i]).join(' · ')} <button type="button" className="text-button" onClick={() => setEditDays(true)}>{tt.editDays}</button></p>}
      {today.anyway && <p className="today-note">{tt.trainAnywayNote}</p>}
      {today.recovery || !today.split ? <><h2>{tt.restDayLabel}</h2><p>{tt.ptRecovery}</p>{today.canTrainAnyway && <button type="button" className="button ghost-light" onClick={() => { setAnyway(true); void loadToday(true); }}><Dumbbell size={17}/>{tt.trainAnyway}</button>}</> : <>
        <h2>{tt.splits[today.split as keyof typeof tt.splits]}</h2>
        <p className="today-list">{items.map(e => localExercise(e, locale).name.split('—')[0].trim()).join(' · ')}</p>
        <div className="split-actions">
          <button className="button lime" onClick={() => openTrain({ mode: 'free', name: tt.splits[today.split as keyof typeof tt.splits], rows: today.exercises.map(x => ({ exerciseId: x.id, sets: Number(x.sets), reps: Number(x.target.split('–').pop()) || 10, restSeconds: Number(x.restSeconds.split('–').pop()) || 60 })) })}><Dumbbell size={17}/>{tt.startNow}</button>
          <button className="button ghost-light" onClick={() => openTrain({ mode: 'follow', focus: FOCUS[today.split!] ?? 'all', minutes: 20 })}><PlayCircle size={17}/>{tt.followAlong}</button>
        </div></>}
    </div>
    {today.split && !today.recovery ? <div className="today-card-map"><MuscleMap primary={muscles} secondary={[]} compact/></div> : <BeeMessage state="resting" size={72} text=""/>}
  </section>;
}
