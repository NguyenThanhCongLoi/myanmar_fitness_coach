'use client';
import { useEffect, useState } from 'react';
import { bodyPreferencesSchema, type BodyPreferences } from '@/shared/body-preferences';
import { useApp } from '@/shared/app-context';
import { trainingApi } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { BodyGoalFields, FocusChoices } from '../onboarding/body-goal-fields';

export function BodyPreferencesEditor() {
  const q = useTrainingLanguage().quiz.details; const { t } = useLanguage(); const { notify } = useApp();
  const [value, setValue] = useState<BodyPreferences | null>(null); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open && !value) trainingApi<{ bodyPreferences: BodyPreferences }>('prefs').then(r => setValue(r.bodyPreferences)).catch(e => { notify(errorText(e, t)); setOpen(false); }); }, [open]);
  async function save() {
    setBusy(true);
    try { await trainingApi('prefs', { bodyPreferences: value }); notify(q.saved); setOpen(false); } catch (e) { notify(errorText(e, t)); } finally { setBusy(false); }
  }
  return <section className="panel body-pref-editor"><h2>{q.editTitle}</h2><p className="muted">{q.balancedNote}</p><button type="button" className="button secondary" onClick={() => setOpen(v => !v)} aria-expanded={open}>{q.edit}</button>
    {open && value && <><FocusChoices value={value} onChange={setValue}/><BodyGoalFields value={value} onChange={setValue}/><button type="button" className="button primary" disabled={busy || !bodyPreferencesSchema.safeParse(value).success} onClick={() => void save()}>{q.save}</button></>}
  </section>;
}
