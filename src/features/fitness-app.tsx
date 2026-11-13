'use client';
import { track, setAnalyticsSignedIn } from '@/shared/analytics';
import { warmApp } from '@/shared/warmup';
import { ThemeToggle } from '@/shared/theme';
import { BeeTip } from './gamification/bee-tip';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Dumbbell, Activity, BookOpen, CalendarDays, ChartNoAxesCombined, Home, LogOut, MessageCircle, UserRound, ArrowUpRight, Compass, Droplets, Target } from 'lucide-react';
import { TargetView } from './target/target-view';
import { QuickOnboarding } from './onboarding/quick-onboarding';
import { HomeView } from './home/home-view';
import { PlanScreen } from './plan/plan-screen';
import { PlanView } from './plan/plan-view';
import { GuidedPlayer } from './plan/guided-player';
import { DiscoverView } from './discover/discover-view';
import { WaterView } from './water/water-view';
import { MeView } from './me/me-view';
import { LanguageProvider, useLanguage, errorText } from '@/shared/language';
import { AppContext, type View, type TrainPreset } from '@/shared/app-context';
import { api } from '@/shared/client';
import type { Bootstrap, Workout } from '@/shared/types';
import { Logo, Empty } from '@/shared/ui';
import { AuthView } from './authentication/auth-view';
import { ProfileView } from './profile/profile-view';
import { ExerciseView } from './exercises/exercise-view';
import { PlansView } from './workout-planner/plans-view';
import { SessionView } from './workout-session/session-view';
import { CoachView } from './ai-coach/coach-view';
import { GameView,CompletionCelebration } from './gamification/game-view';
import { InboxView } from './gamification/inbox-view';
import { TrainingHub } from './training/training-hub';
import { ProgressCharts } from './progress/progress-charts';
import { CreditsView } from './credits-view';
import { useTrainingLanguage } from '@/shared/training-language';
import { useGameLanguage } from '@/shared/game-language';
import { Bell, Award } from 'lucide-react';

export function FitnessApp() { return <LanguageProvider><Shell/></LanguageProvider>; }
function Shell() {
  const gameText=useGameLanguage();const trainText=useTrainingLanguage();
  const [celebration,celebrate]=useState<{awarded:boolean;xp:number;streak?:number}|null>(null);
  const { t, locale, setLocale } = useLanguage();
  const [data, setData] = useState<Bootstrap | null>(null), [loading, setLoading] = useState(true), [view, setView] = useState<View>('home');
  const [exerciseId, setExerciseId] = useState(''), [coachDraft, setCoachDraft] = useState(''), [trainPreset, setTrainPreset] = useState<TrainPreset | null>(null);
  const [sessionId, setSessionId] = useState(''), [plannerOpen, setPlanner] = useState(false), [notice, setNotice] = useState('');
  const notify = useCallback((message: string) => { setNotice(message); setTimeout(() => setNotice(''), 6000); }, []);
  // Ask Better Auth first (200 with null when signed out) so a signed-out visit makes no 401 calls.
  const refresh = useCallback(async () => { try {
    const session = await fetch('/api/auth/get-session', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (!session?.user) { setData(null); setAnalyticsSignedIn(false); return; }
    const result = await api<Bootstrap>('bootstrap'); setData(result); setAnalyticsSignedIn(true);
  } catch(error) { if(error instanceof Error&&error.message==='UNAUTHORIZED') { setData(null); setAnalyticsSignedIn(false); } } finally { setLoading(false); } }, []);
  useEffect(() => { try { if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js'); } catch { /* optional */ } }, []);
  useEffect(() => { if (data) warmApp(); }, [!!data]);
  const go = useCallback((next: View) => {
    const order: View[] = ['home', 'discover', 'me'];
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduced || next === view) { setView(next); return; }
    const a = order.indexOf(view), b = order.indexOf(next);
    document.documentElement.dataset.navDir = a >= 0 && b >= 0 ? (b > a ? 'forward' : 'back') : 'forward';
    doc.startViewTransition(() => flushSync(() => setView(next)));
  }, [view]);
  const screenStart = useRef<{ view: View; at: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = screenStart.current;
    if (prev && prev.view !== view) { const s = Math.round((Date.now() - prev.at) / 1000); if (s >= 1) track({ name: 'screen_time', screen: prev.view, props: { s: Math.min(s, 1800) } }); }
    if (!prev || prev.view !== view) { screenStart.current = { view, at: Date.now() }; track({ name: 'screen_view', screen: view }); }
  }, [view, !!data]);
  useEffect(() => {
    const onVisibility = () => { const cur = screenStart.current; if (!cur) return;
      if (document.visibilityState === 'hidden') { const s = Math.round((Date.now() - cur.at) / 1000); if (s >= 1) track({ name: 'screen_time', screen: cur.view, props: { s: Math.min(s, 1800) } }); }
      cur.at = Date.now(); };
    addEventListener('visibilitychange', onVisibility); return () => removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => { void refresh();if(new URLSearchParams(window.location.search).get('view')==='inbox')go('inbox'); }, [refresh]);
  useEffect(() => { if (!data?.profile?.onboarded) return; try { if (sessionStorage.getItem('mingalar-link-google')) { sessionStorage.removeItem('mingalar-link-google'); sessionStorage.setItem('mingalar-focus-google', '1'); go('profile'); } } catch { /* optional */ } }, [data?.profile?.onboarded]);
  const [listMode, setListMode] = useState(false);
  const openWorkout = (id: string) => { setSessionId(id); setListMode(false); go('workout'); };
  const start = async (dayId: string) => { try { const result = await api<{id: string}>('sessions', { dayId }); await refresh(); openWorkout(result.id); } catch (e) { notify(errorText(e, t)); } };
  // Four simple tabs; the AI coach is a floating button. Other screens are reached from these.
const navigation = [{id:'home', icon:Home}, {id:'discover', icon:Compass}, {id:'me', icon:UserRound}] as const;
const TAB_OF: Partial<Record<View, View>> = { myplan: 'home', water: 'me', target: 'me', coach: 'home', train: 'discover', exercises: 'discover', plans: 'discover', progress: 'me', achievements: 'me', inbox: 'me', profile: 'me', credits: 'me' };
  const language = <button className="language-switch" onClick={() => { const next = locale === 'en' ? 'my-MM' : 'en'; setLocale(next); track({ name: 'language_switched', props: { to: next } }); if (data?.profile) void api('preferences', {locale:next}).catch(() => {}); }} aria-label="Language">{locale === 'en' ? 'မြန်မာ' : 'English'}</button>;
  if (loading) return <div className="loading-screen skeleton-shell" aria-busy="true" aria-label={t.loading}><div className="sk-top"><Logo/></div><div className="sk sk-title"/><div className="sk sk-hero"/><div className="sk-row"><div className="sk sk-card"/><div className="sk sk-card"/></div><div className="sk sk-line"/><div className="sk sk-line short"/><div className="sk-tabbar">{[0,1,2,3,4].map(i => <span key={i} className="sk sk-tab"/>)}</div></div>;
  if (!data) return <><div className="auth-language">{language}<ThemeToggle/></div><AuthView signedIn={refresh}/></>;
  return <AppContext.Provider value={{data,refresh,go,start,openWorkout,notify,celebrate,newPlan:()=>{go('plans');setPlanner(true);},exerciseId,openExercise:(id:string)=>{track({name:'exercise_opened'});setExerciseId(id);go('exercises');},openCoach:(draft:string)=>{setCoachDraft(draft);go('coach');},coachDraft,clearCoachDraft:()=>setCoachDraft(''),trainPreset,openTrain:(p:TrainPreset)=>{setTrainPreset(p);go('train');},clearTrainPreset:()=>setTrainPreset(null)}}><div className={`app-shell ${!data.profile?.onboarded?'onboarding-mode':''} ${view==='workout'?'focus-mode':''}`}><aside className="sidebar"><Logo/><p className="sidebar-label">{t.subtitle}</p><nav>{navigation.map(({id,icon:Icon})=><button key={id} className={(TAB_OF[view]??view)===id?'active':''} onClick={()=>go(id)}><Icon size={20}/>{trainText.ux.nav[id]}</button>)}</nav><div className="sidebar-bottom"><button onClick={()=>go('profile')}><UserRound size={19}/>{t.profile}</button><button onClick={async()=>{await fetch('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});await refresh();}}><LogOut size={19}/>{t.logout}</button></div></aside><div className="main-column"><header className="topbar"><span className="topbar-brand"><Activity size={22}/> Mingalar Fit</span><span className="desktop-greeting">{t.hello}, {data.user.name.split(' ')[0]}</span><div className="topbar-actions"><button className="icon-button" aria-label={gameText.inbox} onClick={()=>go('inbox')}><Bell size={21}/></button>{language}<ThemeToggle/><button className="avatar" aria-label={t.profile} onClick={()=>go('profile')}>{data.user.name.slice(0,1).toUpperCase()}</button></div></header><main className="page-transition">{!data.profile?.onboarded?<QuickOnboarding/>:view==='profile'?<ProfileView/>:view==='home'?<HomeView/>:view==='myplan'?<PlanScreen/>:view==='discover'?<DiscoverView/>:view==='water'?<WaterView/>:view==='target'?<TargetView/>:view==='me'?<MeView/>:view==='train'?<TrainingHub/>:view==='exercises'?<ExerciseView/>:view==='plans'?<PlansView plannerOpen={plannerOpen} closePlanner={()=>setPlanner(false)}/>:view==='workout'?(listMode?<SessionView sessionId={sessionId}/>:<GuidedPlayer sessionId={sessionId} listView={()=>setListMode(true)}/>):view==='coach'?<CoachView/>:view==='achievements'?<GameView screen={view}/>:view==='inbox'?<InboxView/>:view==='credits'?<CreditsView/>:<Overview progress={view==='progress'} data={data} go={go} openWorkout={openWorkout} notify={notify} refresh={refresh}/>}</main></div><nav className="mobile-nav">{navigation.map(({id,icon:Icon})=><button key={id} className={(TAB_OF[view]??view)===id?'active':''} onClick={()=>go(id)}><Icon size={20}/><span>{trainText.ux.nav[id]}</span></button>)}</nav>{celebration&&<CompletionCelebration reward={celebration} close={()=>celebrate(null)}/>} {notice&&<div className="toast" role="status">{notice}</div>}</div></AppContext.Provider>;
}
function Overview({progress,data,go,openWorkout,notify,refresh}:{progress:boolean;data:Bootstrap;go:(v:View)=>void;openWorkout:(id:string)=>void;notify:(s:string)=>void;refresh:()=>Promise<void>}) {
  const {t,locale}=useLanguage(); const [history,setHistory]=useState<Workout[]>([]),[weight,setWeight]=useState(''),[waist,setWaist]=useState('');
  const tt=useTrainingLanguage();
  useEffect(()=>{api<Workout[]>('history').then(setHistory).catch(()=>{});},[data.stats.completed]);
  const unit=data.profile?.weightUnit??'kg';
  return <><div className="page-heading"><span className="overline">{progress?t.progress:t.today}</span><h1>{progress?t.progressTitle:t.heroTitle}</h1><p>{t.heroBody}</p></div>{progress&&<BeeTip context="progress"/>}{progress&&<ProgressCharts/>}{!progress&&<section className="hero panel"><div><span className="eyebrow">{t.welcomeTag}</span><h2>{t.yourPlans}</h2><p>{t.noPlansHint}</p><button className="button lime" onClick={()=>go('plans')}>{t.startPlan}<ArrowUpRight size={18}/></button>{data.activeSession&&<button className="button ghost" onClick={()=>openWorkout(data.activeSession!.id)}>{t.resume}</button>}</div><svg className="hero-art" viewBox="0 0 240 180" aria-hidden="true"><circle cx="120" cy="90" r="78" fill="none" stroke="currentColor" opacity=".2"/><path d="M30 110h40l22-55 30 85 22-62 20 32h46" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg></section>}<div className="stats-grid">{[[t.workouts,data.stats.completed],[t.streak,data.stats.streak],[t.loggedSets,data.stats.sets]].map(([label,value])=><div className="panel stat" key={label}><span>{label}</span><strong>{value}</strong><Activity size={20}/></div>)}</div><div className="dashboard-grid"><section className="panel"><div className="section-heading"><h2>{t.yourWeek}</h2><span className="muted small">{t.weeklyHint.replace('Asia/Yangon',data.profile?.timezone??'Asia/Yangon')}</span></div><div className="week-chart">{data.stats.week.map(day=><div key={day.date}><strong>{day.count}</strong><div className="bar-track"><div style={{height:`${Math.max(3,day.count/Math.max(1,...data.stats.week.map(x=>x.count))*100)}%`}}/></div><small>{new Date(`${day.date}T12:00:00+06:30`).toLocaleDateString(locale,{weekday:'short',timeZone:data.profile?.timezone??'Asia/Yangon'})}</small></div>)}</div></section><section className="panel body-weight"><h2>{t.bodyTracking}</h2><strong>{data.measurements[0]?`${(data.measurements[0].weightKg*(unit==='lb'?2.2046226218:1)).toFixed(1)} ${unit}`:'—'}</strong><p className="muted small">{data.measurements[0]?t.latestWeight:t.noWeight}{data.measurements.find(m=>m.waistCm)?` · ${tt.waistLatest}: ${data.measurements.find(m=>m.waistCm)!.waistCm} cm`:''}</p><form onSubmit={async e=>{e.preventDefault();try{await api('measurements',{weight:Number(weight),unit,waistCm:waist?Number(waist):null});setWeight('');setWaist('');await refresh();notify(t.savedNotice);}catch(e){notify(errorText(e,t));}}}><label>{t.weight} ({unit})<input type="number" min={unit==='kg'?20:45} max={unit==='kg'?350:770} step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} required/></label><label>{tt.waistLabel}<input type="number" min={40} max={200} step="0.5" value={waist} onChange={e=>setWaist(e.target.value)} placeholder={tt.waistHint}/></label><button className="button secondary">{t.addWeight}</button></form></section></div><section className="panel history-panel"><div className="section-heading"><h2>{t.history}</h2><span className="badge">{data.stats.completed}</span></div>{!history.length?<Empty title={t.noHistory}/>:history.map(workout=><button className="history-row" key={workout.id} onClick={()=>openWorkout(workout.id)}><span className="history-icon"><CalendarDays size={20}/></span><span><strong>{workout.plan.name}</strong><small>{new Date(workout.startedAt).toLocaleDateString(locale,{timeZone:data.profile?.timezone??'Asia/Yangon'})} · {workout.sets.length} {t.loggedSets}</small></span><span className="badge">{workout.status==='completed'?t.completed:t.active}</span><ArrowUpRight size={18}/></button>)}</section></>;
}

