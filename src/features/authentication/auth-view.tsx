'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, Link2, Loader2, Mail } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { Logo } from '@/shared/ui';
import { authClient } from '@/shared/auth-client';
export function AuthView({ signedIn }: { signedIn: () => Promise<void> }) {
  const { t } = useLanguage();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [google, setGoogle] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [email, setEmail] = useState(false);
  useEffect(() => {
    void fetch('/api/auth-options', { cache: 'no-store' }).then(response => response.ok ? response.json() : null)
      .then(options => setGoogle(options?.google === true)).catch(() => setGoogle(false)).finally(() => setCheckingGoogle(false));
    const q = new URLSearchParams(window.location.search);
    // Same email already registered with a password: explain instead of a generic failure (accounts are never linked silently).
    if (q.has('authError')) {
      if (q.get('error') === 'account_not_linked') { setNotLinked(true); setEmail(true); setRegister(false); try { sessionStorage.setItem('mingalar-link-google', '1'); } catch { /* optional */ } }
      else setError(t.googleError);
      window.history.replaceState(null, '', '/');
    }
  }, [t.googleError, t.googleNotLinked]);
  async function googleLogin() {
    setBusy(true); setError('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/?authError=1' });
      if (result.error) { setError(t.googleError); setBusy(false); }
    } catch { setError(t.googleError); setBusy(false); }
  }
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
  // Google first and biggest; email/password stays available behind "Use email".
  return <div className="auth-page auth-v2"><section className="auth-hero" style={{ backgroundImage: 'url(/images/banners/fullbody.webp)' }}><Logo light/><div><h1>{t.heroTitle}</h1><p>{t.authBody}</p></div></section>
    <section className="auth-form-panel"><div className="auth-form-wrap">
      <button type="button" className="button google-login big" onClick={() => void googleLogin()} disabled={busy || checkingGoogle || !google} aria-busy={busy}>{busy && !email ? <><Loader2 className="spin" size={20}/>{t.loading}</> : <><span aria-hidden="true" className="google-letter">G</span>{t.googleLogin}</>}</button>
      {!checkingGoogle && !google && <p className="google-hint">{t.googleUnavailable}</p>}
      {notLinked && <div className="link-guide" role="status"><strong>{t.googleNotLinkedTitle}</strong><ol><li><i><KeyRound size={16}/></i>{t.googleStep1}</li><li><i><Link2 size={16}/></i>{t.googleStep2}</li></ol></div>}
      {!email ? <button type="button" className="text-button use-email" onClick={() => setEmail(true)}><Mail size={18}/>{t.useEmail}</button> : <>
        <div className="auth-tabs"><button type="button" className={!register ? 'selected' : ''} onClick={() => { setRegister(false); setError(''); }}>{t.login}</button><button type="button" className={register ? 'selected' : ''} onClick={() => { setRegister(true); setError(''); setNotLinked(false); }}>{t.register}</button></div>
        <form onSubmit={submit} className="form-stack">{register && <label>{t.name}<input name="name" required maxLength={80} autoComplete="name"/></label>}<label>{t.email}<input type="email" name="email" required autoComplete="email" maxLength={200}/></label><label>{t.password}<input type="password" name="password" required minLength={10} maxLength={128} autoFocus={notLinked} autoComplete={register ? 'new-password' : 'current-password'}/><small>{t.passwordHint}</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary large" disabled={busy}>{busy ? <><Loader2 className="spin" size={18}/>{t.loading}</> : <>{register ? t.register : t.login}<ArrowRight size={18}/></>}</button></form></>}
      {error && !email && <p className="form-error" role="alert">{error}</p>}
    </div></section></div>;
}
