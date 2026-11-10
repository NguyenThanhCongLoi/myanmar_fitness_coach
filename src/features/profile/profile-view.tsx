'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, UserRound, LogOut } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { api } from '@/shared/client';
import { errorText, useLanguage } from '@/shared/language';
import type { Profile } from '@/shared/types';

const equipmentOptions = ['body weight', 'dumbbell', 'barbell', 'bench', 'cable', 'band'] as const;
export function ProfileView() {
  const { data, refresh, notify, go } = useApp();
  const { t, locale } = useLanguage();
  const onboarding = !data.profile?.onboarded;
  const [form, setForm] = useState({ goal: data.profile?.goal ?? 'general_fitness', experience: data.profile?.experience ?? 'beginner', equipment: data.profile?.equipment ?? ['body weight'], daysPerWeek: data.profile?.daysPerWeek ?? 3, limitations: data.profile?.limitations ?? '', weightUnit: data.profile?.weightUnit ?? 'kg', distanceUnit: data.profile?.distanceUnit ?? 'km' });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api('profile', { ...form, locale, timezone: 'Asia/Yangon' }); await refresh(); notify(t.savedNotice); go('home'); }
    catch (error) { notify(errorText(error, t), true); }
    finally { setBusy(false); }
  }
  return <section className="profile-page"><div className="page-heading"><span className="overline">{onboarding ? t.welcomeTag : t.profile}</span><h1>{onboarding ? t.onboardingTitle : t.personal}</h1><p>{t.onboardingBody}</p></div><div className="profile-layout"><form className="panel form-stack profile-form" onSubmit={submit}><div className="profile-identity"><span className="avatar large"><UserRound/></span><div><strong>{data.user.name}</strong><p className="muted small">{data.user.email}</p></div><button type="button" className="icon-button profile-logout" aria-label={t.logout} onClick={async()=>{await fetch("/api/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});await refresh();}}><LogOut size={20}/></button></div><div className="form-grid"><label>{t.goal}<select value={form.goal} onChange={event => setForm({ ...form, goal: event.target.value as Profile['goal'] })}>{(['general_fitness', 'build_strength', 'build_muscle', 'improve_endurance'] as const).map(goal => <option key={goal} value={goal}>{t[goal]}</option>)}</select></label><label>{t.experience}<select value={form.experience} onChange={event => setForm({ ...form, experience: event.target.value as Profile['experience'] })}>{(['beginner', 'intermediate', 'advanced'] as const).map(level => <option key={level} value={level}>{t[level]}</option>)}</select></label></div><fieldset><legend>{t.equipment}</legend><div className="choice-grid">{equipmentOptions.map(item => <button type="button" key={item} className={`choice ${form.equipment.includes(item) ? 'selected' : ''}`} aria-pressed={form.equipment.includes(item)} onClick={() => setForm({ ...form, equipment: form.equipment.includes(item) ? form.equipment.filter(value => value !== item) : [...form.equipment, item] })}><span>{t.equipmentLabels[item]}</span>{form.equipment.includes(item) && <Check size={16}/>}</button>)}</div></fieldset><label>{t.daysPerWeek}<select value={form.daysPerWeek} onChange={event => setForm({ ...form, daysPerWeek: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value}>{value}</option>)}</select></label><div className="form-grid"><label>{t.weightUnit}<select value={form.weightUnit} onChange={event => setForm({ ...form, weightUnit: event.target.value as 'kg' | 'lb' })}><option>kg</option><option>lb</option></select></label><label>{t.distanceUnit}<select value={form.distanceUnit} onChange={event => setForm({ ...form, distanceUnit: event.target.value as 'km' | 'mi' })}><option>km</option><option>mi</option></select></label></div><label>{t.limitations}<textarea value={form.limitations} onChange={event => setForm({ ...form, limitations: event.target.value })} maxLength={1000} rows={3}/><small>{t.limitationsHint}</small></label><div className="form-footer"><span className="muted small">{t.timezone}: Asia/Yangon</span><button className="button primary" disabled={busy || !form.equipment.length}>{busy ? t.working : onboarding ? t.getStarted : t.saveProfile}<ArrowRight size={17}/></button></div></form><aside className="profile-note"><span className="note-icon">✳</span><h2>{t.heroTitle}</h2><p>{t.heroBody}</p><div className="subtle-divider"/><p className="small">{t.provisional}</p></aside></div></section>;
}
