'use client';
import { useState } from 'react';
import { useApp } from '@/shared/app-context';
import { trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { trainingErrorText } from './training-hub';
import { BeeMessage } from '../gamification/mascot';
import { useGameLanguage } from '@/shared/game-language';

const SORE = ['legs', 'core', 'push', 'pull'] as const;
const SORE_MUSCLES: Record<typeof SORE[number], string[]> = { legs: ['quadriceps', 'hamstring', 'gluteal', 'calves'], core: ['abs', 'obliques', 'lower-back'], push: ['chest', 'front-deltoids', 'triceps'], pull: ['upper-back', 'back-deltoids', 'biceps'] };

// Optional post-workout check-in. Answers only lower or keep future intensity; nothing is increased automatically.
export function FeedbackForm({ sessionId, done }: { sessionId: string; done: () => void }) {
  const { notify } = useApp(); const { t } = useLanguage(); const tt = useTrainingLanguage(); const gt = useGameLanguage();
  const [difficulty, setDifficulty] = useState<'too_easy' | 'right' | 'too_hard' | ''>('');
  const [sore, setSore] = useState<string[]>([]); const [pain, setPain] = useState(false); const [limitation, setLimitation] = useState('');
  const [next, setNext] = useState<'keep' | 'easier' | 'harder'>('keep'); const [busy, setBusy] = useState(false);
  async function submit() {
    if (!difficulty) return; setBusy(true);
    try {
      await trainingApi(`sessions/${sessionId}/feedback`, { difficulty, soreMuscles: sore.flatMap(g => SORE_MUSCLES[g as typeof SORE[number]]), pain, limitation, nextPreference: next });
      notify(tt.feedbackSaved); done();
    } catch (error) { notify(trainingErrorText(error, t, tt), true); } finally { setBusy(false); }
  }
  const choice = <T extends string>(value: T, current: T, set: (v: T) => void, label: string) => <button type="button" key={value} className={`filter ${current === value ? 'selected' : ''}`} aria-pressed={current === value} onClick={() => set(value)}>{label}</button>;
  return <section className="panel feedback-form" aria-label={tt.feedbackTitle}>
    <BeeMessage state="happy" size={56} text={gt.mascot.workoutCompleted}/>
    <h2>{tt.feedbackTitle}</h2>
    <fieldset><legend>{tt.feedbackDifficulty}</legend><div className="filter-row">{choice('too_easy', difficulty, setDifficulty, tt.tooEasy)}{choice('right', difficulty, setDifficulty, tt.right)}{choice('too_hard', difficulty, setDifficulty, tt.tooHard)}</div></fieldset>
    <fieldset><legend>{tt.feedbackSore}</legend><div className="check-grid">{SORE.map(g => <label key={g} className="check"><input type="checkbox" checked={sore.includes(g)} onChange={() => setSore(s => s.includes(g) ? s.filter(x => x !== g) : [...s, g])}/>{tt.focusGroups[g]}</label>)}</div></fieldset>
    <label className="check"><input type="checkbox" checked={pain} onChange={e => setPain(e.target.checked)}/>{tt.feedbackPain}</label>
    {pain && <><label>{tt.feedbackLimitation}<textarea value={limitation} onChange={e => setLimitation(e.target.value)} maxLength={300} rows={2}/></label><p className="explain-box" role="note">{tt.painAdvice}</p></>}
    <fieldset><legend>{tt.feedbackNext}</legend><div className="filter-row">{choice('keep', next, setNext, tt.keep)}{choice('easier', next, setNext, tt.easier)}{choice('harder', next, setNext, tt.harder)}</div></fieldset>
    <div className="form-footer"><button type="button" className="button ghost" onClick={done}>{tt.skipFeedback}</button><button type="button" className="button primary" disabled={!difficulty || busy} onClick={() => void submit()}>{t.save}</button></div>
  </section>;
}
