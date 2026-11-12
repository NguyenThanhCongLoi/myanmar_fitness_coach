'use client';
import { useEffect, useState } from 'react';
import { Angry, Frown, Laugh, Meh, Smile, X } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { track } from '@/shared/analytics';
import { useTrainingLanguage } from '@/shared/training-language';
import { Mascot } from './mascot';

// "Do you enjoy Mingalar Fit?" — asked after the 2nd completed workout, at most once per 30 days, always skippable.
// Stored only as an anonymous-ish usage event (score + optional favorite area).
const RATED = 'mingalar-rated-at', LATER = 'mingalar-rate-later-at';
const FAVS = ['workouts', 'voice', 'ai_coach', 'nutrition', 'progress', 'design'] as const;
const FACES = [Angry, Frown, Meh, Smile, Laugh];
const daysSince = (key: string) => { try { const v = Number(localStorage.getItem(key) ?? 0); return v ? (Date.now() - v) / 86400000 : Infinity; } catch { return 0; } };
const mark = (key: string) => { try { localStorage.setItem(key, String(Date.now())); } catch { /* optional */ } };

export function RatingPrompt() {
  const { data } = useApp(); const tt = useTrainingLanguage();
  const [step, setStep] = useState<'hidden' | 'ask' | 'fav' | 'thanks'>('hidden'); const [score, setScore] = useState(0);
  useEffect(() => { if ((data.stats?.completed ?? 0) >= 2 && daysSince(RATED) > 30 && daysSince(LATER) > 7) setStep('ask'); }, [data.stats?.completed]);
  if (step === 'hidden') return null;
  const finish = (fav?: string) => { track({ name: 'app_rating', props: fav ? { score, fav } : { score } }); mark(RATED); setStep('thanks'); setTimeout(() => setStep('hidden'), 3500); };
  return <section className="rating-prompt" aria-label={tt.rateTitle}>
    <Mascot state={step === 'thanks' ? 'happy' : 'pointing'} size={64}/>
    <div className="rating-body">
      {step === 'ask' && <><strong>{tt.rateTitle}</strong>
        <div className="rating-faces" role="radiogroup" aria-label={tt.rateTitle}>{FACES.map((Icon, i) => <button key={i} type="button" role="radio" aria-checked={false} aria-label={tt.rateScale[i]} title={tt.rateScale[i]} onClick={() => { setScore(i + 1); setStep('fav'); }}><Icon size={26}/><small>{tt.rateScale[i]}</small></button>)}</div></>}
      {step === 'fav' && <><strong>{tt.rateFavQ}</strong>
        <div className="rating-favs">{FAVS.map(f => <button key={f} type="button" className="filter" onClick={() => finish(f)}>{tt.rateFavs[f]}</button>)}<button type="button" className="text-button" onClick={() => finish()}>{tt.rateSkip}</button></div></>}
      {step === 'thanks' && <strong>{tt.rateThanks}</strong>}
    </div>
    {step === 'ask' && <button type="button" className="icon-button" aria-label={tt.rateLater} onClick={() => { mark(LATER); setStep('hidden'); }}><X size={18}/></button>}
  </section>;
}
