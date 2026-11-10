'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUp, Check, NotebookPen, Sparkles } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api, localExercise } from '@/shared/client';
import type { Exercise } from '@/shared/types';
import { errorText, useLanguage } from '@/shared/language';
import type { PlanInput } from '@/server/validation';
type CoachState = { configured: boolean; messages: { id: string; role: string; content: string }[]; proposals: { id: string; payload: PlanInput }[]; memories: { id: string; content: string }[] };
export function CoachView() {
  const [library, setLibrary] = useState<Exercise[]>([]);
  const { t, locale } = useLanguage(); const { notify, refresh, go } = useApp();
  const [coach, setCoach] = useState<CoachState | null>(null); const [message, setMessage] = useState(''); const [memory, setMemory] = useState(''); const [busy, setBusy] = useState(false);
  async function load() { try { const value = await api<CoachState>('coach'); setCoach(value); setMemory(value.memories[0]?.content ?? ''); } catch (error) { notify(errorText(error, t), true); } }
  useEffect(() => { void load(); void api<Exercise[]>('exercises').then(setLibrary).catch(() => {}); }, []);
  async function send(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api('coach/chat', { message, locale }); setMessage(''); await load(); }
    catch (error) { notify(errorText(error, t), true); await load(); } finally { setBusy(false); }
  }
  async function approve(id: string) {
    if (!confirm(t.approvalConfirm)) return;
    setBusy(true);
    try { await api(`proposals/${id}/approve`, { confirm: true }); await refresh(); await load(); notify(t.savedNotice); go('plans'); }
    catch (error) { notify(errorText(error, t), true); } finally { setBusy(false); }
  }
  async function saveMemory(event: FormEvent) { event.preventDefault(); try { await api('coach/memory', { content: memory }); notify(t.savedNotice); } catch (error) { notify(errorText(error, t), true); } }
  return <section><div className="page-heading"><span className="overline"><Sparkles size={14}/> {t.coach}</span><h1>{t.coachTitle}</h1><p>{t.coachBody}</p></div><div className="coach-layout"><div className="panel chat-panel">{coach && !coach.configured && <div className="connection-notice" role="status"><Sparkles size={20}/><p>{t.coachUnavailable}</p></div>}<div className="messages">{!coach ? <p>{t.loading}</p> : coach.messages.length ? coach.messages.map(item => <div className={`message ${item.role}`} key={item.id}><span className="message-label">{item.role === 'assistant' ? t.coach : t.profile}</span><p>{item.content}</p></div>) : <div className="chat-empty"><span className="coach-symbol"><Sparkles size={30}/></span><h3>{t.coach}</h3><p>{t.noMessages}</p></div>}{busy && <p className="muted">{t.thinking}</p>}</div>{coach?.proposals.map(proposal => <article className="proposal-card" key={proposal.id}><span className="overline">{t.proposedPlan}</span><h3>{proposal.payload.name}</h3><p>{proposal.payload.goal}</p><p>{proposal.payload.weeks} {t.weeks} · {proposal.payload.days.length} {t.weekdays}</p><details><summary>{t.details}</summary>{proposal.payload.days.map((day, index) => <p key={index}>{t.week} {day.week} · {t.weekdaysShort[day.weekday]}: {day.exercises.map(item => `${library.find(exercise => exercise.id === item.exerciseId) ? localExercise(library.find(exercise => exercise.id === item.exerciseId)!, locale).name : t.exercises} (${item.sets}×${item.reps})`).join(', ')}</p>)}</details><button className="button primary" disabled={busy} onClick={() => void approve(proposal.id)}><Check size={16}/>{t.approve}</button></article>)}<form className="chat-compose" onSubmit={send}><textarea aria-label={t.chatPlaceholder} placeholder={t.chatPlaceholder} value={message} onChange={event => setMessage(event.target.value)} maxLength={2000} rows={2} disabled={!coach?.configured || busy}/><button className="button primary send-button" disabled={!coach?.configured || busy || !message.trim()} aria-label={t.send}><ArrowUp size={20}/></button></form></div><aside className="panel coach-note"><NotebookPen size={24}/><h2>{t.memory}</h2><p className="muted small">{t.memoryHint}</p><form onSubmit={saveMemory} className="form-stack"><textarea aria-label={t.memory} value={memory} onChange={event => setMemory(event.target.value)} maxLength={500} rows={5}/><button className="button secondary" disabled={!memory.trim()}>{t.saveMemory}</button></form></aside></div></section>;
}

