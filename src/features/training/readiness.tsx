'use client';
import { useState } from 'react';
import { trainingApi } from '@/shared/client';
import { useTrainingLanguage } from '@/shared/training-language';

// Quick pre-workout check-in (sleep, energy, soreness 1-5). A low score lowers today's volume; it never raises it.
export function ReadinessCheck({ existing, onSaved, dark = false }: { existing: { sleep: number; energy: number; soreness: number; score: number } | null; onSaved: () => void; dark?: boolean }) {
  const tt = useTrainingLanguage();
  const [v, setV] = useState({ sleep: existing?.sleep ?? 3, energy: existing?.energy ?? 3, soreness: existing?.soreness ?? 2 });
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  if (!open && !existing) return <button type="button" className={`readiness-pill ask ${dark ? 'dark' : ''}`} onClick={() => setOpen(true)}><span className="ring">?</span>{tt.readinessTitle}<span className="readiness-cta">{tt.readinessCheckIn}</span></button>;
  if (!open && existing) return <button type="button" className={`readiness-pill ${dark ? 'dark' : ''}`} onClick={() => setOpen(true)}><span className="ring" style={{ ['--p' as string]: `${existing.score / 5 * 100}%` }}>{existing.score}</span>{tt.readinessTitle}</button>;
  const row = (k: 'sleep' | 'energy' | 'soreness') => <div className="readiness-row" key={k}><span>{tt.readiness[k]}</span><div className="scale" role="radiogroup" aria-label={tt.readiness[k]}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={v[k] === n} className={v[k] === n ? 'on' : ''} onClick={() => setV({ ...v, [k]: n })}>{n}</button>)}</div></div>;
  return <div className={`readiness ${dark ? 'dark' : ''}`}><strong>{tt.readinessTitle}</strong><small>{tt.readinessHint}</small>{row('sleep')}{row('energy')}{row('soreness')}
    <button type="button" className="button secondary" disabled={busy} onClick={async () => { setBusy(true); try { await trainingApi('readiness', v); setOpen(false); onSaved(); } finally { setBusy(false); } }}>{tt.save}</button></div>;
}
