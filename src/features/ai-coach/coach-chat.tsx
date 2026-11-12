'use client';
import { useEnglishServerVoice } from '@/shared/voice';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Square, Volume2 } from 'lucide-react';
import { useRef as useAudioRef } from 'react';
import { api } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { BeeAvatar } from '../gamification/mascot';

type Message = { id: string; role: string; content: string; pending?: boolean; failed?: boolean };
export type CoachState = { configured: boolean; messages: Message[] };

// Optimistic chat: the user's message appears immediately, then the Bee "thinking" row,
// then the answer. Enter sends, Shift+Enter adds a line, IME composition never sends.
export function CoachChat({ exerciseId, quickActions = [], compact = false, onAnswered, initialMessage = '' }: { exerciseId?: string; quickActions?: string[]; compact?: boolean; onAnswered?: () => void; initialMessage?: string }) {
  const { t, locale } = useLanguage(); const tt = useTrainingLanguage();
  const [state, setState] = useState<CoachState | null>(null); const [message, setMessage] = useState(initialMessage); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  // Read coach answers aloud: Burmese answers use the server voice; English uses the device speech engine.
  const audio = useAudioRef<HTMLAudioElement | null>(null); const [speaking, setSpeaking] = useState('');
  const stopVoice = () => { audio.current?.pause(); audio.current = null; if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); setSpeaking(''); };
  const enVoice = useEnglishServerVoice();
  const speak = (m: Message) => {
    if (speaking === m.id) { stopVoice(); return; }
    stopVoice(); setSpeaking(m.id);
    if (m.id.startsWith('answer-') || (!/[က-႟]/.test(m.content) && !enVoice)) {
      if (typeof speechSynthesis === 'undefined') { setSpeaking(''); return; }
      const u = new SpeechSynthesisUtterance(m.content.slice(0, 1500)); u.lang = /[က-႟]/.test(m.content) ? 'my-MM' : 'en-US'; u.onend = () => setSpeaking(''); speechSynthesis.speak(u); return;
    }
    const a = new Audio(`/api/training/tts/message/${encodeURIComponent(m.id)}`); audio.current = a;
    a.onended = () => setSpeaking(''); a.onerror = () => { setSpeaking(''); setError(tt.voiceUnavailable); };
    void a.play().catch(() => setSpeaking(''));
  };
  const path = exerciseId ? `coach?exerciseId=${encodeURIComponent(exerciseId)}` : 'coach';
  const load = async () => { try { const value = await api<CoachState>(path); setState(value); } catch (e) { setError(errorText(e, t)); } };
  useEffect(() => { void load(); }, [exerciseId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [state?.messages.length, busy]);
  async function send(text: string) {
    const content = text.trim(); if (busy || !state?.configured || !content) return;
    setBusy(true); setError(''); setMessage('');
    const temp: Message = { id: `pending-${Date.now()}`, role: 'user', content, pending: true };
    setState(s => s && { ...s, messages: [...s.messages, temp] });
    try {
      const { answer, id } = await api<{ answer: string; id?: string }>('coach/chat', { message: content, locale, ...(exerciseId ? { exerciseId } : {}) });
      setState(s => s && { ...s, messages: [...s.messages.map(m => m.id === temp.id ? { ...m, pending: false } : m), { id: id ?? `answer-${Date.now()}`, role: 'assistant', content: answer }] });
      onAnswered?.();
    } catch (e) {
      setState(s => s && { ...s, messages: s.messages.map(m => m.id === temp.id ? { ...m, pending: false, failed: true } : m) });
      setMessage(content); setError(errorText(e, t));
    } finally { setBusy(false); }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void send(message); };
  return <div className={`coach-chat ${compact ? 'compact' : ''}`}>
    {state && !state.configured && <div className="connection-notice" role="status"><BeeAvatar mood="idle" size={36}/><p>{t.coachUnavailable}</p></div>}
    <div className="messages" aria-live="polite">
      {!state ? <p>{t.loading}</p> : state.messages.length ? state.messages.map(item => <div className={`message ${item.role} ${item.failed ? 'failed' : ''}`} key={item.id} data-pending={item.pending ? 'true' : undefined}>
        {item.role === 'assistant' && <BeeAvatar mood="happy" size={32}/>}
        <div className="bubble"><span className="message-label">{item.role === 'assistant' ? t.coach : t.profile}</span><p>{item.content}</p>{item.role === 'assistant' && <button type="button" className="text-button speak-button" onClick={() => speak(item)} aria-label={speaking === item.id ? tt.stopVoice : tt.listenMessage}>{speaking === item.id ? <Square size={14}/> : <Volume2 size={14}/>}{speaking === item.id ? tt.stopVoice : tt.listenMessage}</button>}{item.failed && <small className="error-text">{tt.sendFailed}</small>}</div>
      </div>) : <div className="chat-empty"><BeeAvatar mood="idle" size={compact ? 56 : 72}/><p>{exerciseId ? tt.coachExerciseHint : t.noMessages}</p></div>}
      {busy && <div className="message assistant thinking-row" role="status"><BeeAvatar mood="idle" size={32} thinking/><div className="bubble"><span className="typing" aria-hidden="true"><i/><i/><i/></span><span className="sr-only">{t.thinking}</span><small>{t.thinking}</small></div></div>}
      <div ref={end}/>
    </div>
    {quickActions.length > 0 && state?.configured && <div className="quick-actions">{quickActions.map(q => <button key={q} type="button" className="filter" disabled={busy} onClick={() => void send(q)}>{q}</button>)}</div>}
    {error && <p className="error-text" role="alert">{error}</p>}
    <form className="chat-compose" onSubmit={submit}>
      <textarea onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); if (state?.configured && !busy && message.trim()) event.currentTarget.form?.requestSubmit(); } }}
        aria-label={t.chatPlaceholder} placeholder={t.chatPlaceholder} value={message} onChange={event => setMessage(event.target.value)} maxLength={2000} rows={compact ? 1 : 2} disabled={!state?.configured}/>
      <button className="button primary send-button" disabled={!state?.configured || busy || !message.trim()} aria-label={t.send}><ArrowUp size={20}/></button>
    </form>
  </div>;
}
