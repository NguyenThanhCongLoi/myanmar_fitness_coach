'use client';
import { useState } from 'react';
import { Check, Wand2 } from 'lucide-react';
import { api, localExercise, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import type { Workout } from '@/shared/types';

// Natural-language set logging ("squat 3x10 40kg", Burmese too). The AI only proposes; nothing is saved until the user confirms.
export function QuickSetLog({ session, onSaved }: { session: Workout; onSaved: () => Promise<unknown> }) {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [text, setText] = useState(''); const [preview, setPreview] = useState<{ exerciseId: string; reps: number; weightKg: number }[] | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const name = (id: string) => { const p = session.prescriptions?.find(x => x.exerciseId === id); return p ? localExercise(p.exercise, locale).name : id; };
  async function parse() { setBusy(true); setError(''); try { const r = await trainingApi<{ sets: { exerciseId: string; reps: number; weightKg: number }[] }>('parse/sets', { sessionId: session.id, text }); setPreview(r.sets); if (!r.sets.length) setError(tt.quickNothing); } catch { setError(tt.reportUnavailable); } finally { setBusy(false); } }
  async function confirm() {
    if (!preview) return; setBusy(true);
    const used = new Map<string, number>();
    try {
      for (const s of preview) {
        const p = session.prescriptions?.find(x => x.exerciseId === s.exerciseId); if (!p) continue;
        const logged = new Set(session.sets.filter(x => x.exerciseId === s.exerciseId).map(x => x.setIndex));
        let idx = used.get(s.exerciseId) ?? 0; while (logged.has(idx)) idx++;
        if (idx >= p.sets) continue;
        await api(`sessions/${session.id}/sets`, { exerciseId: s.exerciseId, setIndex: idx, reps: s.reps, weight: s.weightKg, unit: 'kg', restSeconds: p.restSeconds });
        used.set(s.exerciseId, idx + 1);
      }
      setPreview(null); setText(''); await onSaved();
    } catch { setError(tt.reportUnavailable); } finally { setBusy(false); }
  }
  return <div className="panel quick-log"><label>{tt.quickLogLabel}<div className="quick-row"><input value={text} onChange={e => setText(e.target.value)} placeholder={tt.quickLogPlaceholder} maxLength={400}/><button type="button" className="button secondary" disabled={busy || text.trim().length < 2} onClick={() => void parse()}><Wand2 size={16}/>{tt.quickParse}</button></div></label>
    {preview && preview.length > 0 && <div className="quick-preview"><small>{tt.quickConfirmHint}</small><ul>{preview.map((s, i) => <li key={i}>{name(s.exerciseId)} — {s.weightKg} kg × {s.reps}</li>)}</ul><button type="button" className="button primary" disabled={busy} onClick={() => void confirm()}><Check size={16}/>{tt.quickConfirm}</button></div>}
    {error && <p className="error-text">{error}</p>}</div>;
}
export function QuickFoodLog({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [text, setText] = useState(''); const [items, setItems] = useState<{ description: string; kcal: number; proteinG: number; meal: string }[] | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function parse() { setBusy(true); setError(''); try { const r = await trainingApi<{ items: typeof items }>('energy/parse-food', { text, locale }); setItems(r.items); if (!r.items?.length) setError(tt.quickNothing); } catch { setError(tt.reportUnavailable); } finally { setBusy(false); } }
  async function confirm() { if (!items) return; setBusy(true); try { for (const i of items) await trainingApi('energy/food', i); setItems(null); setText(''); await onSaved(); } catch { setError(tt.reportUnavailable); } finally { setBusy(false); } }
  return <div className="quick-log"><label>{tt.quickFoodLabel}<div className="quick-row"><input value={text} onChange={e => setText(e.target.value)} placeholder={tt.quickFoodPlaceholder} maxLength={300}/><button type="button" className="button secondary" disabled={busy || text.trim().length < 2} onClick={() => void parse()}><Wand2 size={16}/>{tt.quickParse}</button></div></label>
    {items && items.length > 0 && <div className="quick-preview"><small>{tt.quickFoodHint}</small><ul>{items.map((i, n) => <li key={n}>{i.description} — {i.kcal} kcal · {Math.round(i.proteinG)} g</li>)}</ul><button type="button" className="button primary" disabled={busy} onClick={() => void confirm()}><Check size={16}/>{tt.quickConfirm}</button></div>}
    {error && <p className="error-text">{error}</p>}</div>;
}
