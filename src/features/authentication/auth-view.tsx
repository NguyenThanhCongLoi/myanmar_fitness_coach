'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { Logo } from '@/shared/ui';
export function AuthView({ signedIn }: { signedIn: () => Promise<void> }) {
  const { t } = useLanguage();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${register ? 'sign-up/email' : 'sign-in/email'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: values.get('email'), password: values.get('password'), ...(register ? { name: values.get('name') } : {}) }) });
      if (!response.ok) { setError(t.error); return; }
      await signedIn();
    } catch { setError(t.error); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><section className="auth-story"><Logo light/><div className="story-content"><span className="eyebrow"><Activity size={16}/>{t.welcomeTag}</span><h1>{t.heroTitle}</h1><p>{t.authBody}</p><div className="story-art" aria-hidden="true"><svg viewBox="0 0 400 260" fill="none"><circle cx="220" cy="130" r="107" stroke="#bce59e" opacity=".25"/><circle cx="220" cy="130" r="79" stroke="#bce59e" opacity=".4"/><path d="M56 182h78l38-73 37 44 35-102 36 131h78" stroke="#d9f6a3" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="280" cy="182" r="13" fill="#d9f6a3"/></svg></div></div><div className="story-footer"><ShieldCheck size={17}/><span>{t.personal}</span></div></section><section className="auth-form-panel"><div className="auth-form-wrap"><span className="overline">MINGALAR FIT</span><h1>{register ? t.registerTitle : t.loginTitle}</h1><p className="muted">{t.heroBody}</p><div className="auth-tabs"><button type="button" className={!register ? 'selected' : ''} onClick={() => { setRegister(false); setError(''); }}>{t.login}</button><button type="button" className={register ? 'selected' : ''} onClick={() => { setRegister(true); setError(''); }}>{t.register}</button></div><form onSubmit={submit} className="form-stack">{register && <label>{t.name}<input name="name" required maxLength={80} autoComplete="name"/></label>}<label>{t.email}<input type="email" name="email" required autoComplete="email" maxLength={200}/></label><label>{t.password}<input type="password" name="password" required minLength={10} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'}/><small>{t.passwordHint}</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary large" disabled={busy}>{busy ? t.loading : register ? t.register : t.login}<ArrowRight size={18}/></button></form><p className="auth-switch">{register ? t.haveAccount : t.needAccount} <button onClick={() => setRegister(!register)}>{register ? t.login : t.register}</button></p></div></section></div>;
}
