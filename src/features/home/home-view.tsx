'use client';
import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronRight, Clock, Dumbbell, Flame, GlassWater, Play, Plus } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { trainingApi } from '@/shared/client';
import { homeToday } from '@/locales/workout-voice';
import { buzz } from '@/shared/wake-lock';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { BeeAvatar } from '../gamification/mascot';
import { WorkoutIntro } from '../plan/workout-intro';
import { getLocation, type Plan } from '../plan/plan-view';

// Home = AI coach, My plan, a light "today" strip (water, streak, week), then workout banners (public/images/banners).
const BANNERS = [
  { key: 'all', img: '/images/banners/fullbody.webp', focus: 'all', minutes: 20, pos: '50% 40%' },
  { key: 'core', img: '/images/banners/core.webp', focus: 'core', minutes: 15, pos: '62% 50%' },
  { key: 'upper', img: '/images/banners/upper.webp', focus: 'upper', minutes: 15, pos: '50% 30%' },
  { key: 'legs', img: '/images/banners/jump.webp', focus: 'legs', minutes: 15, pos: '82% 40%' },
  { key: 'cardio', img: '/images/banners/cardio.webp', focus: 'cardio', minutes: 10, pos: '50% 35%' },
] as const;

export function HomeView() {
  const { data, go } = useApp(); const { t, locale } = useLanguage(); const w = homeToday[locale === 'my-MM' ? 'my' : 'en'];
  const [water, setWater] = useState<{ totalMl: number; targetMl: number } | null>(null), [adding, setAdding] = useState(false);
  useEffect(() => { trainingApi<{ totalMl: number; targetMl: number }>('water').then(setWater).catch(() => {}); }, []);
  async function addWater() { setAdding(true); try { setWater(await trainingApi<{ totalMl: number; targetMl: number }>('water', { ml: 250 })); buzz(20); } catch { /* keeps last value */ } finally { setAdding(false); } }
  // Coach nudges about water when intake is behind the pace for this time of day (Asia/Yangon, 7:00-21:00).
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: data.profile?.timezone ?? 'Asia/Yangon' }).format(new Date()));
  const waterLow = !!water && hour >= 10 && water.totalMl < water.targetMl * Math.min(1, (hour - 7) / 14) * 0.6;
  const waterPct = water ? Math.min(100, Math.round(water.totalMl / Math.max(1, water.targetMl) * 100)) : 0; const tt = useTrainingLanguage(); const u = tt.ux, h = u.home;
  const [selectedWorkout, setSelectedWorkout] = useState<typeof BANNERS[number]|null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => { trainingApi<Plan>(`plan?location=${getLocation(data.profile?.trainingLocation)}`).then(setPlan).catch(() => {}); }, []);
  const who = plan?.nickname || data.user.name.split(' ')[0];
  const next = plan?.days.find(d => d.day === plan.current) ?? null;
  const title = (split: string) => u.splits[split as keyof typeof u.splits] ?? split;
  const planLine = data.activeSession ? h.coachResume : next ? h.coachToday.replace('{title}', title(next.split)).replace('{min}', String(next.minutes)) : plan ? u.coachWeekDone : h.coachLoading;
  const line = !data.activeSession && waterLow ? w.waterLow.replace('{ml}', String(water!.totalMl)) : planLine;
  const liters = (ml: number) => (ml / 1000).toFixed(1);
  if (selectedWorkout) return <WorkoutIntro focus={selectedWorkout.focus} minutes={selectedWorkout.minutes} title={h.banners[selectedWorkout.key]} image={selectedWorkout.img} back={()=>setSelectedWorkout(null)}/>;
  return <section className="home-v2">
    <button type="button" className="hv-coach" onClick={() => go('coach')} aria-label={u.coachAsk}>
      <BeeAvatar mood="happy" size={52}/><span><strong>{u.coachHi.replace('{name}', who)}</strong><small>{line}</small></span><ChevronRight size={20}/>
    </button>

    <div className="hv-head"><h2>{u.planSection}</h2></div>
    {plan ? <button type="button" className="hv-plan" onClick={() => go('myplan')} style={{ backgroundImage: `url(${next?.thumb || '/images/banners/hiit.webp'})` }}>
      <span className="hv-plan-body">
        <small>{u.programs[plan.program].title} · {u.week} {plan.week}</small>
        <strong>{next ? `${u.day} ${next.day} · ${title(next.split)}` : u.coachWeekDone}</strong>
        {next && <span className="hv-meta"><Clock size={14}/>{next.minutes} {u.min}<Dumbbell size={14}/>{next.items.length} {u.exercises}</span>}
        <span className="hv-progress" aria-label={`${plan.completed}/${plan.total}`}><i style={{ width: `${plan.total ? plan.completed / plan.total * 100 : 0}%` }}/></span>
      </span>
      <span className="hv-plan-go"><Play size={20}/></span>
    </button> : <div className="hv-plan sk"/>}

    <div className="hv-head"><h2>{w.today}</h2></div>
    <div className="hv-today">
      <div className={`hv-water ${waterLow ? 'low' : ''}`}>
        <button type="button" className="hv-water-main" onClick={() => go('water')}>
          <span className="hv-ico"><GlassWater size={22}/></span>
          <span className="hv-water-text"><small>{w.water}</small><strong>{water ? `${liters(water.totalMl)} / ${liters(water.targetMl)} L` : '–'}</strong>
            <span className="hv-water-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={waterPct}><i style={{ width: `${waterPct}%` }}/></span></span>
        </button>
        <button type="button" className="hv-water-add" disabled={adding || !water} onClick={() => void addWater()} aria-label={`${w.water} ${w.addGlass}`}><Plus size={18}/>250</button>
      </div>
      <button type="button" className="hv-stat streak" onClick={() => go('target')}><span className="hv-ico flame"><Flame size={20}/></span><strong>{data.stats.streak}</strong><small>{w.streak}</small></button>
      <button type="button" className="hv-stat week" onClick={() => go('myplan')}><span className="hv-ico"><CalendarCheck size={20}/></span><strong>{plan ? `${plan.completed}/${plan.total}` : '–'}</strong><small>{w.week}</small></button>
    </div>

    <div className="hv-head"><h2>{h.forYou}</h2></div>
    <div className="hv-banners">{BANNERS.filter(b=>getLocation(data.profile?.trainingLocation)==='home'||!['core','cardio'].includes(b.key)).map(b => <button key={b.key} type="button" className="hv-banner" style={{ backgroundImage: `url(${b.img})`, backgroundPosition: b.pos }} onClick={() => setSelectedWorkout(b)}>
      <span><strong>{h.banners[b.key]}</strong><small>{b.minutes} {u.min}</small></span></button>)}</div>
    <span className="sr-only">{t.loading}</span>
  </section>;
}
