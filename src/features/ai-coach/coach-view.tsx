'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Check, NotebookPen, Sparkles } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api, localExercise } from '@/shared/client';
import type { Exercise } from '@/shared/types';
import { errorText, useLanguage } from '@/shared/language';
import type { PlanInput } from '@/server/validation';
import { CoachChat } from './coach-chat';
import { trainingApi } from '@/shared/client';
import { fill, useTrainingLanguage } from '@/shared/training-language';
import { BeeAvatar } from '../gamification/mascot';
type CoachExtras = { proposals: { id: string; payload: PlanInput }[]; memories: { id: string; key: string; content: string }[] };
const MEMORY_KEYS = ['injuries', 'preferences', 'schedule', 'user_note'] as const;
export function CoachView() {
  const [library, setLibrary] = useState<Exercise[]>([]);
  const { t, locale } = useLanguage(); const { notify, refresh, go, coachDraft, clearCoachDraft } = useApp();
  const [extras, setExtras] = useState<CoachExtras | null>(null); const [memory, setMemory] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const [draft] = useState(coachDraft); const tt = useTrainingLanguage();
  const [insights, setInsights] = useState<{ code: string; values?: Record<string, string | number> }[]>([]);
  useEffect(() => { trainingApi<typeof insights>('insights').then(setInsights).catch(() => {}); }, []);
  async function load() { try { const value = await api<CoachExtras>('coach'); setExtras(value); setMemory(Object.fromEntries(MEMORY_KEYS.map(k => [k, value.memories.find(m => m.key === k)?.content ?? '']))); } catch (error) { notify(errorText(error, t), true); } }
  useEffect(() => { if (coachDraft) clearCoachDraft(); void load(); void api<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, []);
  async function approve(id: string) {
    if (!confirm(t.approvalConfirm)) return;
    setBusy(true);
    try { await api(`proposals/${id}/approve`, { confirm: true }); await refresh(); await load(); notify(t.savedNotice); go('plans'); }
    catch (error) { notify(errorText(error, t), true); } finally { setBusy(false); }
  }
  async function saveMemory(event: FormEvent) { event.preventDefault(); try { for (const k of MEMORY_KEYS) await api('coach/memory', { key: k, content: memory[k] ?? '' }); notify(t.savedNotice); } catch (error) { notify(errorText(error, t), true); } }
  const name = (id: string) => { const e = library.find(x => x.id === id); return e ? localExercise(e, locale).name : t.exercises; };
  return <section><div className="page-heading"><span className="overline"><Sparkles size={14}/> {t.coach}</span><h1>{t.coachTitle}</h1><p>{t.coachBody}</p></div>
    {insights.length > 0 && <section className="panel coach-insights" aria-label={tt.insightsTitle}><div className="insights-head"><BeeAvatar mood="happy" size={40}/><h2>{tt.insightsTitle}</h2></div>
      <ul className="cue-list">{insights.map(i => <li key={i.code}>{fill(tt.insights[i.code as keyof typeof tt.insights] ?? i.code, i.values ?? {})}</li>)}</ul></section>}
    <div className="coach-layout"><div className="panel chat-panel"><CoachChat onAnswered={() => void load()} initialMessage={draft}/>
      {extras?.proposals.map(proposal => <article className="proposal-card" key={proposal.id}><span className="overline">{t.proposedPlan}</span><h3>{proposal.payload.name}</h3><p>{proposal.payload.goal}</p><p>{proposal.payload.weeks} {t.weeks} · {proposal.payload.days.length} {t.weekdays}</p><details><summary>{t.details}</summary>{proposal.payload.days.map((day, index) => <p key={index}>{t.week} {day.week} · {t.weekdaysShort[day.weekday]}: {day.exercises.map(item => `${name(item.exerciseId)} (${item.sets}×${item.reps})`).join(', ')}</p>)}</details><button className="button primary" disabled={busy} onClick={() => void approve(proposal.id)}><Check size={16}/>{t.approve}</button></article>)}
    </div><aside className="panel coach-note"><NotebookPen size={24}/><h2>{t.memory}</h2><p className="muted small">{t.memoryHint}</p><form onSubmit={saveMemory} className="form-stack">{MEMORY_KEYS.map(k => <label key={k}>{tt.memoryFields[k]}<textarea aria-label={tt.memoryFields[k]} value={memory[k] ?? ''} onChange={event => setMemory({ ...memory, [k]: event.target.value })} maxLength={500} rows={2} placeholder={tt.memoryHints[k]}/></label>)}<button className="button secondary">{t.saveMemory}</button></form></aside></div></section>;
}
