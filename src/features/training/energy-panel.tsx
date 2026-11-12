'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Flame, Plus, Trash2, Utensils } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { ACTIVITIES, FOOD_PRESETS } from '@/shared/energy';
import { trainingErrorText } from './training-hub';
import { QuickFoodLog } from './quick-log';

type Day = { day: string; intake: number; protein: number; activity: number; workout: number; out: number | null; balance: number | null; logged: boolean };
type Energy = { body: { weightKg: number | null; heightCm: number | null; birthYear: number | null; sex: string | null }; weightGoal: 'lose' | 'maintain' | 'gain'; goalWeightKg: number | null;
  targetIntake: number | null; protein: number[] | null; daily: Day[]; projection: { weeklyKg: number; weeksToGoal: number | null } | null; loggedDays: number; missing: string[];
  foodsToday: { id: string; meal: string; description: string; kcal: number; proteinG: number }[]; activitiesToday: { id: string; kind: string; minutes: number; kcal: number }[] };

// Self-reported calories in/out with a weight-goal projection. All numbers are estimates.
export function EnergyPanel() {
  const { notify } = useApp(); const { t } = useLanguage(); const tt = useTrainingLanguage();
  const [e, setE] = useState<Energy | null>(null); const [busy, setBusy] = useState(false);
  const [body, setBody] = useState({ heightCm: '', birthYear: '', sex: 'unspecified', goalWeightKg: '', weightGoal: 'maintain' });
  const [food, setFood] = useState({ meal: 'lunch', description: '', kcal: '', proteinG: '' }); const [act, setAct] = useState({ kind: 'walking', minutes: '30' });
  const load = async () => { try { const v = await trainingApi<Energy>('energy'); setE(v); setBody({ heightCm: v.body.heightCm ? String(v.body.heightCm) : '', birthYear: v.body.birthYear ? String(v.body.birthYear) : '', sex: v.body.sex ?? 'unspecified', goalWeightKg: v.goalWeightKg ? String(v.goalWeightKg) : '', weightGoal: v.weightGoal }); } catch (err) { notify(trainingErrorText(err, t, tt), true); } };
  useEffect(() => { void load(); }, []);
  async function post(path: string, payload: unknown) { setBusy(true); try { await trainingApi(path, payload); await load(); notify(t.savedNotice); } catch (err) { notify(trainingErrorText(err, t, tt), true); } finally { setBusy(false); } }
  if (!e) return <p className="loading-inline">{t.loading}</p>;
  const today = e.daily[6]; const burned = today.out;
  const maxAbs = Math.max(1, ...e.daily.map(d => Math.abs(d.balance ?? 0)));
  const saveBody = (ev: FormEvent) => { ev.preventDefault(); void post('energy/body', { heightCm: body.heightCm ? Number(body.heightCm) : null, birthYear: body.birthYear ? Number(body.birthYear) : null, sex: body.sex, goalWeightKg: body.goalWeightKg ? Number(body.goalWeightKg) : null, weightGoal: body.weightGoal }); };
  return <section className="panel energy-panel" aria-label={tt.energyTitle}>
    <h2><Flame size={18}/> {tt.energyTitle}</h2>
    {e.missing.length > 0 && <p className="explain-box">{tt.missingBody}</p>}
    <div className="energy-today">
      <div className="stat-tile"><small>{tt.todayIntake}</small><strong>{today.intake}</strong><small>kcal</small></div>
      <div className="stat-tile"><small>{tt.targetIntake}</small><strong>{e.targetIntake ?? '—'}</strong><small>kcal</small></div>
      <div className="stat-tile"><small>{tt.burned}</small><strong>{burned ?? '—'}</strong><small>kcal</small></div>
      <div className="stat-tile"><small>{tt.proteinToday}</small><strong>{today.protein}</strong><small>{e.protein ? `/ ${e.protein[0]}–${e.protein[1]} g` : 'g'}</small></div>
    </div>
    <p className="muted">{e.projection?.weeksToGoal ? fill(tt.projectionLine, { weekly: e.projection.weeklyKg, weeks: e.projection.weeksToGoal }) : tt.projectionNone}</p>
    <div className="energy-grid">
      <form className="form-stack" onSubmit={ev => { ev.preventDefault(); void post('energy/food', { meal: food.meal, description: food.description, kcal: Number(food.kcal), proteinG: Number(food.proteinG || 0) }).then(() => setFood(f => ({ ...f, description: '', kcal: '', proteinG: '' }))); }}>
        <h3><Utensils size={16}/> {tt.logFood}</h3>
        <QuickFoodLog onSaved={load}/>
        <div className="quick-foods" aria-label={tt.quickFoods}>{FOOD_PRESETS.map(p => <button type="button" key={p.key} className="filter" onClick={() => setFood(f => ({ ...f, description: tt.foods[p.key], kcal: String(p.kcal), proteinG: String(p.protein) }))}>{tt.foods[p.key]} · {p.kcal}</button>)}</div>
        <div className="form-grid"><label>{tt.meals.breakfast} / {tt.meals.lunch}<select aria-label={tt.meals.lunch} value={food.meal} onChange={ev => setFood({ ...food, meal: ev.target.value })}>{(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(m => <option key={m} value={m}>{tt.meals[m]}</option>)}</select></label>
          <label>{tt.foodName}<input value={food.description} onChange={ev => setFood({ ...food, description: ev.target.value })} maxLength={120} required/></label>
          <label>{tt.kcal}<input type="number" min={1} max={3000} value={food.kcal} onChange={ev => setFood({ ...food, kcal: ev.target.value })} required/></label>
          <label>{tt.proteinG}<input type="number" min={0} max={200} value={food.proteinG} onChange={ev => setFood({ ...food, proteinG: ev.target.value })}/></label></div>
        <button className="button primary" disabled={busy}><Plus size={16}/>{tt.add}</button>
      </form>
      <form className="form-stack" onSubmit={ev => { ev.preventDefault(); void post('energy/activity', { kind: act.kind, minutes: Number(act.minutes) }); }}>
        <h3><Flame size={16}/> {tt.logActivity}</h3>
        <div className="form-grid"><label>{tt.logActivity}<select value={act.kind} onChange={ev => setAct({ ...act, kind: ev.target.value })}>{(Object.keys(ACTIVITIES) as (keyof typeof ACTIVITIES)[]).map(k => <option key={k} value={k}>{tt.activities[k]}</option>)}</select></label>
          <label>{tt.minutesLabel}<input type="number" min={1} max={600} value={act.minutes} onChange={ev => setAct({ ...act, minutes: ev.target.value })} required/></label></div>
        <button className="button secondary" disabled={busy}><Plus size={16}/>{tt.add}</button>
        <ul className="log-list">{[...e.foodsToday.map(f => ({ id: f.id, kind: 'food' as const, text: `${tt.meals[f.meal as keyof typeof tt.meals] ?? f.meal}: ${f.description} · ${f.kcal} kcal` })), ...e.activitiesToday.map(a => ({ id: a.id, kind: 'activity' as const, text: `${tt.activities[a.kind as keyof typeof tt.activities] ?? a.kind} ${a.minutes}′ · −${a.kcal} kcal` }))].map(x => <li key={x.id}><span>{x.text}</span><button type="button" className="icon-button" aria-label={tt.remove2} onClick={() => void post('energy/delete', { kind: x.kind, id: x.id })}><Trash2 size={15}/></button></li>)}
          {!e.foodsToday.length && !e.activitiesToday.length && <li className="muted">{tt.noLogs}</li>}</ul>
      </form>
    </div>
    <h3>{tt.last7}</h3>
    <div className="balance-chart">{e.daily.map(d => <div key={d.day} className="balance-col" title={`${d.day}: ${d.balance ?? '—'}`}><div className="balance-bar-wrap"><div className={`balance-bar ${d.balance === null ? 'empty' : d.balance > 0 ? 'plus' : 'minus'}`} style={{ height: `${d.balance === null ? 4 : Math.max(4, Math.abs(d.balance) / maxAbs * 100)}%` }}/></div><small>{d.day.slice(8)}</small><small className="muted">{d.balance === null ? '—' : d.balance > 0 ? `+${d.balance}` : d.balance}</small></div>)}</div>
    <details className="body-form"><summary>{tt.bodyTitle}</summary>
      <form className="form-grid" onSubmit={saveBody}>
        <label>{tt.height}<input type="number" min={120} max={230} value={body.heightCm} onChange={ev => setBody({ ...body, heightCm: ev.target.value })}/></label>
        <label>{tt.birthYear}<input type="number" min={1930} max={new Date().getFullYear() - 13} value={body.birthYear} onChange={ev => setBody({ ...body, birthYear: ev.target.value })}/></label>
        <label>{tt.sex}<select value={body.sex} onChange={ev => setBody({ ...body, sex: ev.target.value })}>{(['male', 'female', 'unspecified'] as const).map(s => <option key={s} value={s}>{tt.sexes[s]}</option>)}</select></label>
        <label>{tt.weightGoalLabel}<select value={body.weightGoal} onChange={ev => setBody({ ...body, weightGoal: ev.target.value })}>{(['lose', 'maintain', 'gain'] as const).map(g => <option key={g} value={g}>{tt.weightGoals[g]}</option>)}</select></label>
        <label>{tt.goalWeight}<input type="number" min={30} max={250} step="0.1" value={body.goalWeightKg} onChange={ev => setBody({ ...body, goalWeightKg: ev.target.value })}/></label>
        <div className="form-footer"><button className="button secondary" disabled={busy}>{t.save}</button></div>
      </form></details>
    <p className="muted small">{tt.energyNote}</p>
  </section>;
}
