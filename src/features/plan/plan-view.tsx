'use client';
import { useEffect, useState } from 'react';
import { ArrowLeftRight, Camera, Check, ChevronDown, Clock, Droplets, Dumbbell, Flame, Home, ListPlus, MessageCircle, Play, Repeat, Timer, TrendingDown, TrendingUp, Undo2, Utensils, X } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { localExercise, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';
import { groupOf, placeOf, type BalanceIssue, type PlanDay, type PlanItem, type ProgramKey, type StepStage } from '@/shared/plan';
import { Modal } from '@/shared/ui';
import { Button } from '@/components/ui/button';
import { trainingErrorText } from '../training/training-hub';
import { RatingPrompt } from '../gamification/rating-prompt';
import { BeeMessage, Mascot } from '../gamification/mascot';

export type PlanDayView = PlanDay & { kcal: number; done: boolean; pct: number | null; doneOn: string | null; thumb: string | null };
export type Plan = { program: ProgramKey; location: 'home' | 'gym'; bmi: number | null; band: string | null; week: number; step: number; stage: StepStage; deload: boolean;
  lastChange: { week: number; avg: number; change: 'up' | 'same' | 'down' } | null; lastAdapt: { change: 'up' | 'same' | 'down'; reason: string; pct: number | null } | null; tired: boolean; pastWeeks: { week: number; done: number; avg: number }[]; sessionMinutes: number; nickname: string;
  current: number | null; completed: number; total: number; days: PlanDayView[]; balance?: { plan: BalanceIssue[]; done: BalanceIssue[] } };
type Scores = { today: string; days: { day: string; score: number | null; workout: number | null; water: number | null; food: number | null; rest: boolean }[] };
const LOC = 'mingalar-location';
export const getLocation = (): 'home' | 'gym' => { try { return localStorage.getItem(LOC) === 'gym' ? 'gym' : 'home'; } catch { return 'home'; } };
// % colour scale: light green (good) → yellow → red; grey when there is no data yet.
export const pctColor = (p: number | null | undefined) => (p === null || p === undefined ? 'var(--line)' : p >= 100 ? 'var(--st-great)' : p >= 80 ? 'var(--st-good)' : p >= 50 ? 'var(--st-warn)' : 'var(--st-low)');

export async function startPlanDay(day: PlanDayView, program: ProgramKey, title: string) {
  return trainingApi<{ id: string }>('free', { name: title.slice(0, 100), program: { key: program, day: day.day },
    exercises: day.items.map(i => ({ exerciseId: i.id, sets: i.sets, reps: i.target, restSeconds: Math.max(10, i.rest), targetKg: 0, timed: i.unit === 'seconds' })) });
}

export function PlanView() {
  const { data, openWorkout, notify, go, openTrain } = useApp(); const { t, locale } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux;
  const [plan, setPlan] = useState<Plan | null>(null); const [scores, setScores] = useState<Scores | null>(null); const [library, setLibrary] = useState<Exercise[]>([]); const [error, setError] = useState('');
  const [location, setLocation] = useState<'home' | 'gym'>('home'); const [open, setOpen] = useState<PlanDayView | null>(null); const [programs, setPrograms] = useState(false);
  const [busy, setBusy] = useState(false); const [history, setHistory] = useState(false); const [swapFor, setSwapFor] = useState<PlanItem | null>(null); const [quick, setQuick] = useState(false);
  const load = (loc = location) => trainingApi<Plan>(`plan?location=${loc}`).then(p => { setPlan(p); setError(''); }).catch(e => setError(trainingErrorText(e, t, tt)));
  useEffect(() => { const loc = getLocation(); setLocation(loc); void load(loc); trainingApi<Exercise[]>('exercises').then(setLibrary).catch(() => {}); trainingApi<Scores>('day-scores').then(setScores).catch(() => {}); }, []);
  const ex = (id: string) => library.find(e => e.id === id);
  const name = (id: string) => { const e = ex(id); return e ? localExercise(e, locale).name.split('—')[0].trim() : id; };
  const dayTitle = (d: PlanDayView) => u.splits[d.split as keyof typeof u.splits] ?? d.split;
  async function start(d: PlanDayView) {
    if (data.activeSession) { openWorkout(data.activeSession.id); return; }
    setBusy(true);
    try { const s = await startPlanDay(d, plan!.program, `${u.day} ${d.day} · ${dayTitle(d)}`); openWorkout(s.id); }
    catch (e) { notify(trainingErrorText(e, t, tt)); } finally { setBusy(false); }
  }
  async function changeProgram(p: ProgramKey) { await trainingApi('program', { program: p }); setPrograms(false); await load(); }
  function switchLocation(l: 'home' | 'gym') { setLocation(l); try { localStorage.setItem(LOC, l); } catch { /* optional */ } void load(l); }
  async function swap(item: PlanItem, to: string | null) {
    if (!open) return; setBusy(true);
    try { const p = await trainingApi<Plan>('plan/swap', { from: item.swappedFrom ?? item.id, to, location }); setPlan(p); setOpen(p.days.find(d => d.day === open.day) ?? null); setSwapFor(null); notify(u.swapSaved); }
    catch (e) { notify(trainingErrorText(e, t, tt)); } finally { setBusy(false); }
  }
  const alternatives = (item: PlanItem) => { const cur = ex(item.id), g = cur ? groupOf(cur) : null;
    return library.filter(e => e.id !== item.id && !open?.items.some(i => i.id === e.id) && g && groupOf(e) === g && (location === 'gym' || placeOf(e) === 'home'))
      .sort((a, b) => Number(!!b.videoUrl) - Number(!!a.videoUrl)).slice(0, 8); };
  const goPlan = (l: 'home' | 'gym') => { if (l !== location) switchLocation(l); requestAnimationFrame(() => document.getElementById('my-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  if (error) return <section className="plan-view"><p className="error-text" role="alert">{error}</p></section>;
  if (!plan) return <section className="plan-view"><div className="sk sk-title"/><div className="sk sk-hero"/><div className="sk sk-card"/></section>;
  const today = plan.days.find(d => d.day === plan.current) ?? null;
  const todayScore = scores?.days.at(-1);
  const who = plan.nickname || data.user.name.split(' ')[0];
  const todayDone = plan.days.some(d => d.doneOn && new Date(d.doneOn).toDateString() === new Date().toDateString());
  const fill = (x: string, v: Record<string, string | number> = {}) => Object.entries(v).reduce((r, [k, val]) => r.replaceAll(`{${k}}`, String(val)), x);
  const issueText = (i: BalanceIssue) => fill(tt.insights[i.code as keyof typeof tt.insights] ?? i.code, i.values ?? {});
  const warnings = [...(plan.balance?.done ?? []).map(issueText), ...(plan.balance?.plan ?? []).filter(i => !plan.balance?.done.some(d => d.code === i.code)).map(i => `${u.coachPlanWarn} ${issueText(i)}`)].slice(0, 2);
  return <section className="plan-view">
    <header className="plan-head">
      <div><span className="date-line">{dateLine(locale, t.weekdaysShort)}</span><h1>{who}</h1></div>
      <div className="plan-chips"><button type="button" className="chip-stat" onClick={() => go('achievements')} aria-label={u.streak}><Flame size={16}/>{data.stats.streak}</button></div>
    </header>

    <CoachBubble state={warnings.length ? 'concerned' : todayDone ? 'celebrating' : 'waving'} lines={[
      fill(u.coachHi, { name: who }),
      todayDone ? u.coachDoneToday : today ? fill(u.coachToday, { title: dayTitle(today), min: today.minutes }) : u.coachWeekDone, ...warnings]}
      warn={warnings.length > 0} action={!todayDone && today ? { label: data.activeSession ? u.resume : u.start, run: () => void start(today) } : null}
      ask={{ label: u.coachAsk, run: () => go('coach') }} closeLabel={u.coachClose} busy={busy}/>

    <section className="score-card" aria-label={u.todayScore}>
      <div className="score-main"><small>{u.todayScore}</small><strong><CountUp to={todayScore?.score ?? 0}/><em>%</em></strong>
        <div className="score-bar"><i style={{ width: `${todayScore?.score ?? 0}%`, background: pctColor(todayScore?.score ?? null) }}/></div></div>
      <div className="score-tiles">
        {([['workout', Dumbbell, u.partWorkout, () => goPlan(location)], ['water', Droplets, u.partWater, () => go('water')], ['food', Utensils, u.partFood, () => go('water')]] as const).map(([k, Icon, label, act]) =>
          <button key={k} type="button" className={`score-tile st-${k}`} onClick={act}><span className="st-head"><Icon size={14}/><small>{label}</small></span><strong>{todayScore?.[k] ?? 0}<em>%</em></strong></button>)}
      </div>
      {scores && <div className="score-bars" role="img" aria-label={`${u.last7}: ${scores.days.map(d => `${d.score ?? '—'}%`).join(', ')}`}>{scores.days.map(d => <span key={d.day} title={`${d.day}: ${d.score ?? '—'}%`} className={d.day === scores.today ? 'is-today' : ''}><b>{d.score ?? ''}</b><i style={{ height: `${Math.max(6, d.score ?? 0)}%`, background: d.score === null ? undefined : pctColor(d.score) }}/><small>{locale.startsWith('my') ? Number(d.day.slice(8)) : t.weekdaysShort[(new Date(d.day + 'T12:00:00Z').getUTCDay() + 6) % 7]}</small></span>)}</div>}
    </section>

    <section className="home-section" aria-labelledby="h-training">
      <div className="section-head"><div><h2 id="h-training">{u.training}</h2><small>{u.trainingHint}</small></div><button type="button" className="see-all" onClick={() => go('discover')}>{u.seeAll}</button></div>
      <div className="train-grid">
        <button type="button" className="train-card tc-home" onClick={() => goPlan('home')}><span><small>{u.trainCards.home.sub}</small><strong>{u.trainCards.home.title}</strong></span><Home className="tc-art" size={72} aria-hidden="true"/></button>
        <button type="button" className="train-card tc-gym" onClick={() => goPlan('gym')}><span><small>{u.trainCards.gym.sub}</small><strong>{u.trainCards.gym.title}</strong></span><Dumbbell className="tc-art" size={72} aria-hidden="true"/></button>
        <button type="button" className="train-card tc-quick" onClick={() => setQuick(true)}><span><small>{u.trainCards.quick.sub}</small><strong>{u.trainCards.quick.title}</strong></span><Timer className="tc-art" size={72} aria-hidden="true"/></button>
        <button type="button" className="train-card tc-build" onClick={() => openTrain({ mode: 'free', name: u.myWorkout, rows: [] })}><span><small>{u.trainCards.build.sub}</small><strong>{u.trainCards.build.title}</strong></span><ListPlus className="tc-art" size={72} aria-hidden="true"/></button>
      </div>
    </section>

    <section className="home-section" id="my-plan" aria-labelledby="h-plan">
      <div className="section-head"><div><h2 id="h-plan">{u.planSection}</h2><small>{u.planHint}</small></div><button type="button" className="see-all" onClick={() => setPrograms(true)}>{u.changePlan}</button></div>
      {today ? <article className="today-hero" onClick={() => setOpen(today)}>
        <div className="today-hero-media" style={today.thumb ? { backgroundImage: `url(${today.thumb})` } : undefined}><span className="today-badge">{u.today}</span></div>
        <div className="today-hero-body">
          <small>{u.day} {today.day}</small><h2>{dayTitle(today)}</h2>
          <p className="day-meta"><span className="meta-chip"><Clock size={14}/>{today.minutes} {u.min}</span><span className="meta-chip"><Flame size={14}/>{today.kcal} kcal</span><span className="meta-chip">{today.items.length} {u.exercises}</span><span className="meta-chip">{location === 'home' ? u.followTimer : u.gymReps}</span></p>
          <button type="button" className="button primary big-start" disabled={busy} onClick={e => { e.stopPropagation(); void start(today); }}><Play size={20}/>{data.activeSession ? u.resume : u.start}</button>
        </div></article>
        : <article className="today-hero done"><BeeMessage state="celebrating" size={72} text={u.weekDone}/></article>}

      <section className="week-card">
        <div className="program-row"><div><small>{u.program}: {u.programs[plan.program].title}</small><strong>{u.week} {plan.week} · {u.stages[plan.stage]}{plan.deload ? ` · ${u.deloadWeek}` : ''}</strong></div>
          <div className="seg-switch place-switch">{(['home', 'gym'] as const).map(l => <button key={l} type="button" className={location === l ? 'selected' : ''} aria-pressed={location === l} onClick={() => switchLocation(l)}>{l === 'home' ? <Home size={15}/> : <Dumbbell size={15}/>}{tt[l]}</button>)}</div></div>
        {plan.lastAdapt && <p className={`change-note ${plan.lastAdapt.change}`}>{plan.lastAdapt.change === 'up' ? <TrendingUp size={16}/> : plan.lastAdapt.change === 'down' ? <TrendingDown size={16}/> : <Check size={16}/>}
          {u.lastSession.replace('{pct}', String(plan.lastAdapt.pct ?? 100))} {u.adaptReason[plan.lastAdapt.reason as keyof typeof u.adaptReason]} {u.adaptChange[plan.lastAdapt.change]}</p>}
        {plan.tired && <p className="change-note down">{u.tiredToday}</p>}
        {!plan.lastAdapt && plan.lastChange && <p className={`change-note ${plan.lastChange.change}`}>{plan.lastChange.change === 'up' ? <TrendingUp size={16}/> : plan.lastChange.change === 'down' ? <TrendingDown size={16}/> : <Check size={16}/>}
          {u.changeNote[plan.lastChange.change].replace('{pct}', String(plan.lastChange.avg))}</p>}
        <div className="week-days">{plan.days.map(d => <button key={d.day} type="button" className={`week-day ${d.day === plan.current ? 'current' : ''} ${d.done ? 'done' : ''}`} onClick={() => setOpen(d)}>
          <span className="wd-dot" style={d.done ? { background: pctColor(d.pct), borderColor: 'transparent', color: '#fff' } : undefined}>{d.done ? ((d.pct ?? 100) >= 100 ? <Check size={16}/> : `${d.pct}`) : d.day}</span><small>{dayTitle(d)}</small></button>)}</div>
      </section>

      <div className="section-head sub"><h3>{u.recommended}</h3></div>
      <div className="program-rail">{(['personal', 'four_day', 'gym_beginner'] as const).map(p => <button key={p} type="button" className={`program-tile pt-${p} ${plan.program === p ? 'on' : ''}`} onClick={() => { if (plan.program !== p) void changeProgram(p); }}>
        {plan.program === p && <em>{u.currentPlan}</em>}<strong>{u.programs[p].title}</strong><small>{u.programs[p].desc}</small></button>)}</div>
    </section>

    <button type="button" className="meal-cta" onClick={() => { try { sessionStorage.setItem('mingalar-tab', 'food'); } catch { /* optional */ } go('water'); }}><Camera size={22}/><span><strong>{u.mealPhoto}</strong><small>{u.mealPhotoHint}</small></span></button>
    <RatingPrompt/>

    {plan.pastWeeks.length > 0 && <section className="past-weeks"><button type="button" className="text-button" onClick={() => setHistory(h => !h)}><ChevronDown size={16}/>{u.pastWeeks}</button>
      {history && <ul>{plan.pastWeeks.map(w => <li key={w.week}><span>{u.week} {w.week}</span><i style={{ background: pctColor(w.avg) }}/><strong>{w.avg}%</strong></li>)}</ul>}</section>}

    {quick && <Modal title={u.quickPick} close={() => setQuick(false)}>
      <div className="quick-row">{[7, 15, 20].map(m => <button key={m} type="button" className="quick-card" onClick={() => { setQuick(false); openTrain({ mode: 'follow', focus: 'all', minutes: m }); }}><Timer size={22}/><strong>{m} {u.min}</strong><small>{u.quickHint}</small></button>)}</div>
    </Modal>}
    {open && <Modal title={`${u.day} ${open.day} · ${dayTitle(open)}`} close={() => { setOpen(null); setSwapFor(null); }}>
      <p className="day-meta"><Clock size={15}/>{open.minutes} {u.min} · <Flame size={15}/>{open.kcal} kcal{open.done ? ` · ${open.pct ?? 100}%` : ''}</p>
      {open.split === 'cardio' && <p className="explain-box">{u.cardioNote.replace('{bmi}', plan.bmi ? String(plan.bmi) : '—')}</p>}
      {swapFor ? <div className="swap-panel">
        <div className="swap-head"><strong>{fill(u.swapTitle, { name: name(swapFor.id) })}</strong><button type="button" className="icon-button" aria-label={u.coachClose} onClick={() => setSwapFor(null)}><X size={18}/></button></div>
        <small className="muted">{u.swapHint}</small>
        {swapFor.swappedFrom && <button type="button" className="button secondary" disabled={busy} onClick={() => void swap(swapFor, null)}><Undo2 size={16}/>{u.undoSwap}: {name(swapFor.swappedFrom)}</button>}
        {alternatives(swapFor).length ? <ul className="sheet-exercises">{alternatives(swapFor).map(e => <li key={e.id}><button type="button" className="swap-option" disabled={busy} onClick={() => void swap(swapFor, e.id)}>
          <span className="ex-thumb" style={e.thumbnailUrl ? { backgroundImage: `url(${e.thumbnailUrl})` } : undefined}/><span><strong>{name(e.id)}</strong><small>{(e.primaryMuscles ?? []).map(m => tt.muscleNames[m as keyof typeof tt.muscleNames] ?? m).join(' · ')}</small></span></button></li>)}</ul>
          : <p className="muted small">{u.swapNone}</p>}
      </div> : <ul className="sheet-exercises">{open.items.map(i => { const e = ex(i.id); return <li key={i.id}>
        <span className="ex-thumb" style={e?.thumbnailUrl ? { backgroundImage: `url(${e.thumbnailUrl})` } : undefined}/>
        <span><strong>{name(i.id)}</strong><small>{i.sets} × {i.target} {i.unit === 'reps' ? u.reps : u.sec}{i.perSide ? ` · ${tt.perSide}` : ''}{i.swappedFrom ? ` · ${u.swapped}` : ''}</small></span>
        {!open.done && <button type="button" className="swap-btn" onClick={() => setSwapFor(i)} aria-label={`${u.swap}: ${name(i.id)}`}><ArrowLeftRight size={16}/>{u.swap}</button>}</li>; })}</ul>}
      {(plan.balance?.plan.length ?? 0) > 0 && <p className="change-note down">{u.coachPlanWarn} {plan.balance!.plan.map(issueText).join(' ')}</p>}
      <button type="button" className={`button ${open.done ? 'secondary' : 'primary'} big-start`} disabled={busy} onClick={() => void start(open)}>{open.done ? <><Repeat size={18}/>{u.again}</> : <><Play size={20}/>{u.start}</>}</button>
    </Modal>}
    {programs && <Modal title={u.chooseProgram} close={() => setPrograms(false)}>
      <div className="program-options">{(['personal', 'four_day', 'gym_beginner'] as const).map(p => <button key={p} type="button" className={`quiz-option ${plan.program === p ? 'on' : ''}`} onClick={() => void changeProgram(p)}>
        <span><strong>{u.programs[p].title}</strong><small>{u.programs[p].desc}</small></span>{plan.program === p && <Check size={20}/>}</button>)}</div>
    </Modal>}
  </section>;
}

// The bee coach greets the user at the top of Home like a chat: typing dots, then short lines (today's session, balance warnings).
// Closing hides it for the rest of the day (per tab session); it comes back when the message set changes.
function CoachBubble({ state, lines, warn, action, ask, closeLabel, busy }: { state: 'concerned' | 'celebrating' | 'waving'; lines: string[]; warn: boolean;
  action: { label: string; run: () => void } | null; ask: { label: string; run: () => void }; closeLabel: string; busy: boolean }) {
  const KEY = `mingalar-coach-${new Date().toDateString()}-${lines.length}`;
  const [hidden, setHidden] = useState(false); const [shown, setShown] = useState(0);
  useEffect(() => {
    try { if (sessionStorage.getItem(KEY)) { setHidden(true); return; } } catch { /* optional */ }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(lines.length); return; }
    const timers = lines.map((_, i) => setTimeout(() => setShown(i + 1), 450 + i * 650)); return () => timers.forEach(clearTimeout);
  }, [KEY, lines.length]);
  if (hidden) return null;
  return <section className={`coach-bubble ${warn ? 'warn' : ''}`} aria-live="polite">
    <div className="cb-bee"><Mascot state={state} size={64} label=""/></div>
    <div className="cb-chat">
      {lines.slice(0, shown).map((l, i) => <p key={i} className={`cb-msg ${i >= 2 ? 'alert' : ''}`}>{l}</p>)}
      {shown < lines.length && <p className="cb-msg typing" aria-hidden="true"><i/><i/><i/></p>}
    </div>
    {shown >= lines.length && <div className="cb-actions">
      {action && <Button size="sm" disabled={busy} onClick={action.run}><Play/>{action.label}</Button>}
      <Button size="sm" variant="outline" onClick={ask.run}><MessageCircle/>{ask.label}</Button></div>}
    <button type="button" className="cb-close icon-button" aria-label={closeLabel} onClick={() => { setHidden(true); try { sessionStorage.setItem(KEY, '1'); } catch { /* optional */ } }}><X size={16}/></button>
  </section>;
}

// The day's score counts up once when Home opens (the one orchestrated moment); instant under reduced motion.
function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || to <= 0) { setV(to); return; }
    let raf = 0; const t0 = performance.now(), dur = 700;
    const step = (now: number) => { const k = Math.min(1, (now - t0) / dur); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    setV(0); raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v}</>;
}

// Some browsers ship no Burmese calendar data and silently fall back to English; then build the line from our own labels.
function dateLine(locale: string, weekdays: readonly string[]) {
  const d = new Date(), fmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  if (!locale.startsWith('my') || fmt.resolvedOptions().locale.startsWith('my')) return fmt.format(d);
  return `${weekdays[(d.getDay() + 6) % 7]}, ${d.getDate()}/${d.getMonth() + 1}`;
}
