'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Check, UserRound, LogOut } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api, trainingApi } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import type { Profile } from '@/shared/types';
import { useTrainingLanguage } from '@/shared/training-language';
import { GoogleLink } from './google-link';
import { BodyPreferencesEditor } from './body-preferences-editor';

const equipmentOptions = ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band', 'machine'] as const;
export function ProfileView() {
  const { data, refresh, notify, go } = useApp();
  const { t, locale } = useLanguage(); const tt = useTrainingLanguage();
  const onboarding = !data.profile?.onboarded;
  const [form, setForm] = useState({ goal: data.profile?.goal ?? 'general_fitness', experience: data.profile?.experience ?? 'beginner', equipment: data.profile?.equipment ?? ['body weight'], daysPerWeek: data.profile?.daysPerWeek ?? 3, limitations: data.profile?.limitations ?? '', screening: { heart: false, chestPain: false, dizziness: false, joint: false, medication: false, pregnancy: false, other: false, ...((data.profile as { screening?: Record<string, boolean> } | null)?.screening ?? {}) }, weightUnit: data.profile?.weightUnit ?? 'kg', distanceUnit: data.profile?.distanceUnit ?? 'km' });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api('profile', { ...form, locale, timezone: 'Asia/Yangon' }); await refresh(); notify(t.savedNotice); go('home'); }
    catch (error) { notify(errorText(error, t), true); }
    finally { setBusy(false); }
  }
  return <section className="profile-page"><div className="page-heading"><span className="overline">{onboarding ? t.welcomeTag : t.profile}</span><h1>{onboarding ? t.onboardingTitle : t.personal}</h1><p>{t.onboardingBody}</p></div><div className="profile-layout"><form className="panel form-stack profile-form" onSubmit={submit}><div className="profile-identity"><span className="avatar large"><UserRound/></span><div><strong>{data.user.name}</strong><p className="muted small">{data.user.email}</p></div><button type="button" className="icon-button profile-logout" aria-label={t.logout} onClick={async()=>{await fetch("/api/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});await refresh();}}><LogOut size={20}/></button></div><div className="form-grid"><label>{t.goal}<select value={form.goal} onChange={event => setForm({ ...form, goal: event.target.value as Profile['goal'] })}>{(['general_fitness', 'build_strength', 'build_muscle', 'improve_endurance'] as const).map(goal => <option key={goal} value={goal}>{t[goal]}</option>)}</select></label><label>{t.experience}<select value={form.experience} onChange={event => setForm({ ...form, experience: event.target.value as Profile['experience'] })}>{(['beginner', 'intermediate', 'advanced'] as const).map(level => <option key={level} value={level}>{t[level]}</option>)}</select></label></div><fieldset><legend>{t.equipment}</legend><div className="choice-grid">{equipmentOptions.map(item => <button type="button" key={item} className={`choice ${form.equipment.includes(item) ? 'selected' : ''}`} aria-pressed={form.equipment.includes(item)} onClick={() => setForm({ ...form, equipment: form.equipment.includes(item) ? form.equipment.filter(value => value !== item) : [...form.equipment, item] })}><span>{t.equipmentLabels[item]}</span>{form.equipment.includes(item) && <Check size={16}/>}</button>)}</div></fieldset><label>{t.daysPerWeek}<select value={form.daysPerWeek} onChange={event => setForm({ ...form, daysPerWeek: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value}>{value}</option>)}</select></label><div className="form-grid"><label>{t.weightUnit}<select value={form.weightUnit} onChange={event => setForm({ ...form, weightUnit: event.target.value as 'kg' | 'lb' })}><option>kg</option><option>lb</option></select></label><label>{t.distanceUnit}<select value={form.distanceUnit} onChange={event => setForm({ ...form, distanceUnit: event.target.value as 'km' | 'mi' })}><option>km</option><option>mi</option></select></label></div><label>{t.limitations}<textarea value={form.limitations} onChange={event => setForm({ ...form, limitations: event.target.value })} maxLength={1000} rows={3}/><small>{t.limitationsHint}</small></label><fieldset className="screening"><legend>{tt.screeningTitle}</legend><p className="muted small">{tt.screeningHint}</p>{(['heart','chestPain','dizziness','joint','medication','pregnancy','other'] as const).map(k => <label key={k} className="check"><input type="checkbox" checked={form.screening[k]} onChange={e => setForm({ ...form, screening: { ...form.screening, [k]: e.target.checked } })}/>{tt.screeningQ[k]}</label>)}{Object.values(form.screening).some(Boolean) && <p className="explain-box" role="note">{tt.screeningCaution}</p>}</fieldset><div className="form-footer"><span className="muted small">{t.timezone}: Asia/Yangon</span><button className="button primary" disabled={busy || !form.equipment.length}>{busy ? t.working : onboarding ? t.getStarted : t.saveProfile}<ArrowRight size={17}/></button></div></form><aside className="profile-note"><span className="note-icon">✳</span><h2>{t.heroTitle}</h2><p>{t.heroBody}</p><div className="subtle-divider"/><p className="small">{t.provisional}</p></aside></div>{!onboarding&&<BodyPreferencesEditor/>}<LowDataToggle/>{!onboarding&&<GoogleLink/>}{!onboarding&&<UsageToggle/>}{!onboarding&&<p className="credits-link"><button type="button" className="text-button" onClick={()=>go('credits')}>{tt.viewCredits}</button></p>}</section>;
}

function LowDataToggle() {
  const tt = useTrainingLanguage(); const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(localStorage.getItem('mingalar-lowdata') === 'on'); } catch { /* optional */ } }, []);
  return <label className="check low-data"><input type="checkbox" checked={on} onChange={e => { setOn(e.target.checked); try { localStorage.setItem('mingalar-lowdata', e.target.checked ? 'on' : 'off'); } catch { /* optional */ } }}/>{tt.lowData}<small className="muted"> {tt.lowDataHint}</small></label>;
}

// Usage statistics opt-out (first-party, names only; turning it off also deletes this user's past events).
function UsageToggle() {
  const { data, refresh } = useApp(); const tt = useTrainingLanguage();
  const [on, setOn] = useState(!(data.profile as { analyticsOptOut?: boolean } | null)?.analyticsOptOut);
  async function change(value: boolean) { setOn(value); try { await trainingApi('analytics-pref', { optOut: !value }); await refresh(); } catch { setOn(!value); } }
  return <label className="check low-data usage-toggle"><input type="checkbox" checked={on} onChange={e => void change(e.target.checked)}/><span><strong>{tt.usageStatsLabel}</strong><small className="muted">{tt.usageStatsHint}</small></span></label>;
}
