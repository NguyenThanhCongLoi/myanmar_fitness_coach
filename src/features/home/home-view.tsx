'use client';
import { useEffect, useState } from 'react';
import { CalendarCheck, ChevronRight, Clock, Dumbbell, Flame, Play, Trophy } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { BeeAvatar } from '../gamification/mascot';
import { getLocation, type Plan } from '../plan/plan-view';

// Home = 4 sections only: AI coach, 3 metrics, My plan, workout banners (images in public/images/banners).
const BANNERS = [
  { key: 'all', img: '/images/banners/fullbody.webp', focus: 'all', minutes: 20, pos: '50% 40%' },
  { key: 'core', img: '/images/banners/core.webp', focus: 'core', minutes: 15, pos: '62% 50%' },
  { key: 'upper', img: '/images/banners/upper.webp', focus: 'upper', minutes: 15, pos: '50% 30%' },
  { key: 'legs', img: '/images/banners/jump.webp', focus: 'legs', minutes: 15, pos: '82% 40%' },
  { key: 'cardio', img: '/images/banners/cardio.webp', focus: 'all', minutes: 10, pos: '50% 35%' },
  { key: 'hiit', img: '/images/banners/hiit.webp', focus: 'all', minutes: 7, pos: '60% 45%' },
  { key: 'stretch', img: '/images/banners/stretch.webp', focus: 'all', minutes: 10, pos: '40% 45%' },
] as const;

export function HomeView() {
  const { data, go, openTrain } = useApp(); const { t } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux, h = u.home;
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => { trainingApi<Plan>(`plan?location=${getLocation()}`).then(setPlan).catch(() => {}); }, []);
  const who = plan?.nickname || data.user.name.split(' ')[0];
  const next = plan?.days.find(d => d.day === plan.current) ?? null;
  const title = (split: string) => u.splits[split as keyof typeof u.splits] ?? split;
  const line = data.activeSession ? h.coachResume : next ? h.coachToday.replace('{title}', title(next.split)).replace('{min}', String(next.minutes)) : plan ? u.coachWeekDone : h.coachLoading;
  const metrics = [
    { icon: Flame, value: data.stats.streak, label: h.streak },
    { icon: Trophy, value: data.stats.completed, label: h.workouts },
    { icon: CalendarCheck, value: plan ? `${plan.completed}/${plan.total}` : '–', label: h.thisWeek },
  ];
  return <section className="home-v2">
    <button type="button" className="hv-coach" onClick={() => go('coach')} aria-label={u.coachAsk}>
      <BeeAvatar mood="happy" size={52}/><span><strong>{u.coachHi.replace('{name}', who)}</strong><small>{line}</small></span><ChevronRight size={20}/>
    </button>

    <div className="hv-metrics">{metrics.map(m => <div key={m.label} className="hv-metric"><m.icon size={18}/><strong>{m.value}</strong><small>{m.label}</small></div>)}</div>

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

    <div className="hv-head"><h2>{h.forYou}</h2></div>
    <div className="hv-banners">{BANNERS.map(b => <button key={b.key} type="button" className="hv-banner" style={{ backgroundImage: `url(${b.img})`, backgroundPosition: b.pos }} onClick={() => openTrain({ mode: 'follow', focus: b.focus, minutes: b.minutes })}>
      <span><strong>{h.banners[b.key]}</strong><small>{b.minutes} {u.min}</small></span></button>)}</div>
    <span className="sr-only">{t.loading}</span>
  </section>;
}
