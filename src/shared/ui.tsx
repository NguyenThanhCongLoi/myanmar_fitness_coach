'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, Dumbbell, X } from 'lucide-react';
import { useLanguage } from './language';
export function Logo({ light = false }: { light?: boolean }) {
  return <span className={`brand-lockup ${light ? 'light' : ''}`}><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 23V10l10 12 10-12v13M10 7l6 7 6-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span>Mingalar<span className="brand-fit">Fit</span><small>MYANMAR FITNESS COACH</small></span></span>;
}
export function Modal({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} onCancel={close} onClick={event => { if (event.target === ref.current) close(); }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label={t.close}><X size={20}/></button></div>{children}
  </dialog>;
}
export function Empty({ title, description, action, onClick }: { title: string; description?: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><span className="empty-symbol"><Dumbbell size={28}/></span><h3>{title}</h3>{description && <p>{description}</p>}{action && <button className="button primary" onClick={onClick}>{action}<ArrowRight size={16}/></button>}</div>;
}
export function ExerciseArt({ muscle, small = false }: { muscle?: string; small?: boolean }) {
  const palette = muscle?.includes('leg') || muscle?.includes('quad') ? 'peach' : muscle?.includes('back') ? 'lavender' : 'sage';
  return <div className={`exercise-art ${palette} ${small ? 'small' : ''}`} aria-hidden="true"><svg viewBox="0 0 240 160" fill="none"><ellipse cx="123" cy="139" rx="61" ry="7" fill="currentColor" opacity=".08"/><circle cx="139" cy="35" r="12" fill="currentColor"/><path d="M132 55L109 82l-40 4M130 56l23 29 36-12M110 82l32 26-16 32M110 82l-28 24-37 8" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/><circle cx="197" cy="64" r="24" stroke="currentColor" opacity=".12" strokeWidth="2"/><path d="M27 44h37m-18-18v36" stroke="currentColor" strokeWidth="2" opacity=".15"/></svg></div>;
}
