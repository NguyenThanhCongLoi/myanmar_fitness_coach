'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { authClient } from '@/shared/auth-client';
import { useTrainingLanguage } from '@/shared/training-language';
// Explicit, signed-in linking of Google to an existing password account (no silent auto-linking of unverified emails).
export function GoogleLink() {
  const tt = useTrainingLanguage();
  const [enabled, setEnabled] = useState(false); const [linked, setLinked] = useState<boolean | null>(null); const [error, setError] = useState('');
  const box = useRef<HTMLFieldSetElement>(null); const [focus, setFocus] = useState(false);
  useEffect(() => {
    void fetch('/api/auth-options', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(o => setEnabled(o?.google === true)).catch(() => {});
    void authClient.listAccounts().then(r => setLinked(!!r.data?.some(a => a.providerId === 'google'))).catch(() => setLinked(false));
  }, []);
  // arriving from the sign-in guide: scroll here and highlight once
  useEffect(() => { if (!enabled || linked === null) return; try { if (sessionStorage.getItem('mingalar-focus-google')) { sessionStorage.removeItem('mingalar-focus-google'); setFocus(true); box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } catch { /* optional */ } }, [enabled, linked]);
  if (!enabled || linked === null) return null;
  return <fieldset ref={box} className={`google-link ${focus ? 'focus' : ''}`}><legend>{tt.googleLinkTitle}</legend>
    {linked ? <p className="muted"><Check size={16}/> {tt.googleLinked}</p> : <>
      <p className="muted small">{tt.googleLinkHint}</p>
      <button type="button" className="button secondary" onClick={async () => { setError(''); const r = await authClient.linkSocial({ provider: 'google', callbackURL: '/?linked=google' }).catch(() => null); if (!r || r.error) setError(tt.googleLinkFailed); }}><Link2 size={16}/>{tt.googleLinkButton}</button>
      {error && <p className="error-text" role="alert">{error}</p>}</>}
  </fieldset>;
}
