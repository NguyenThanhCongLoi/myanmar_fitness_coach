'use client';
import { useState } from 'react';
import { CalendarCheck, SlidersHorizontal } from 'lucide-react';
import { trainingApi } from '@/shared/client';
import { useTrainingLanguage } from '@/shared/training-language';
import { useApp } from '@/shared/app-context';
import { Modal } from '@/shared/ui';
import type { WeekCheck, AdaptReason } from '@/shared/adaptation';
import type { Plan } from './plan-view';

export function AdaptiveControls({ plan, reload }: { plan: Plan; reload: () => Promise<unknown> }) {
  const a = useTrainingLanguage().adaptive, { notify } = useApp();
  const [mode, setMode] = useState<'today' | 'week' | null>(null), [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<WeekCheck>({ energy: 3, sleep: 3, soreness: 2, preference: 'same', minutes: [10,20,30,45].includes(plan.sessionMinutes) ? plan.sessionMinutes as WeekCheck['minutes'] : 20 });
  const [lighter, setLighter] = useState(false);
  async function save(finishWeek = false) {
    setBusy(true);
    try { await trainingApi(mode === 'today' ? 'plan/today' : 'plan/review', mode === 'today' ? { minutes: check.minutes, lighter } : { ...check, expectedWeek: plan.week, finishWeek }); await reload(); setMode(null); }
    catch { notify(a.saveError); } finally { setBusy(false); }
  }
  return <section className="adaptive-card">
    {plan.adaptive && <p className="muted">{plan.adaptive.decision.reasons.map((r: AdaptReason) => a.reasons[r]).join(' ')}</p>}
    <div className="adaptive-actions"><button type="button" className="button secondary" onClick={() => setMode('today')}><SlidersHorizontal size={22}/>{a.today}</button><button type="button" className="button secondary" onClick={() => setMode('week')}><CalendarCheck size={22}/>{a.week}</button></div>
    {mode && <Modal title={mode === 'today' ? a.today : a.week} close={() => !busy && setMode(null)}>
      <div className="adaptive-form"><label>{a.minutes}<select value={check.minutes} onChange={e => setCheck(c => ({ ...c, minutes: Number(e.target.value) as WeekCheck['minutes'] }))}>{[10,20,30,45].map(m => <option key={m} value={m}>{m} min</option>)}</select></label>
      {mode === 'today' ? <label className="check-row"><input type="checkbox" checked={lighter} onChange={e => setLighter(e.target.checked)}/>{a.lighter}</label> : <>
        {(['energy','sleep','soreness'] as const).map(k => <fieldset key={k}><legend>{a[k]}</legend><div className="adaptive-scale">{[1,2,3,4,5].map(n => <button type="button" key={n} aria-pressed={check[k] === n} className={`button ${check[k] === n ? 'primary' : 'secondary'}`} onClick={() => setCheck(c => ({ ...c, [k]: n }))}>{n}</button>)}</div><small className="scale-ends">{a.low}<span>{a.high}</span></small></fieldset>)}
        <label>{a.preference}<select value={check.preference} onChange={e => setCheck(c => ({ ...c, preference: e.target.value as WeekCheck['preference'] }))}>{(['lighter','same','harder'] as const).map(k => <option value={k} key={k}>{a.choices[k]}</option>)}</select></label>
      </>}
      <button type="button" disabled={busy} className="button primary" onClick={() => void save()}>{a.save}</button>
      {mode === 'week' && <><p className="muted">{a.closeHint}</p><button type="button" disabled={busy} className="button secondary" onClick={() => void save(true)}>{a.next}</button></>}
      </div>
    </Modal>}
  </section>;
}
