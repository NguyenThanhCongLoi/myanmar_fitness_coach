'use client';
import { ChartNoAxesCombined, ChevronRight, Inbox, Scale, Settings, Target, UserRound } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { useTrainingLanguage } from '@/shared/training-language';
import { bmiBand, bmiOf } from '@/shared/plan';
import { GameView } from '../gamification/game-view';

// "Me": body numbers, shortcuts to progress / settings, then streak, XP, calendar and badges.
export function MeView() {
  const { data, go } = useApp(); const tt = useTrainingLanguage(); const u = tt.ux;
  const w = data.measurements[0]?.weightKg ?? null; const h = (data.profile as { heightCm?: number | null } | null)?.heightCm ?? null;
  const bmi = bmiOf(w, h), band = bmiBand(bmi);
  return <section className="me-view">
    <header className="me-head"><span className="me-avatar"><UserRound size={28}/></span><div><h1>{data.user.name}</h1><small className="muted">{u.meSince.replace('{n}', String(data.stats.completed))}</small></div></header>
    <div className="me-stats">
      <div className="stat-tile"><strong>{data.stats.completed}</strong><small>{u.workouts}</small></div>
      <div className="stat-tile"><strong>{w ? `${Number(w.toFixed(1))}` : '—'}</strong><small>{u.weightKg}</small></div>
      <div className={`stat-tile bmi-${band ?? 'none'}`}><strong>{bmi ?? '—'}</strong><small>BMI{band ? ` · ${tt.quiz.bmiBands[band]}` : ''}</small></div>
    </div>
    <div className="link-list">
      <button type="button" onClick={() => go('progress')}><ChartNoAxesCombined size={20}/><span><strong>{u.progress}</strong><small>{u.progressHint}</small></span><ChevronRight size={18}/></button>
      <button type="button" onClick={() => go('target')}><Target size={20}/><span><strong>{u.nav.target}</strong><small>{u.goals.title}</small></span><ChevronRight size={18}/></button>
      <button type="button" onClick={() => { try { sessionStorage.setItem('mingalar-tab', 'food'); } catch { /* optional */ } go('water'); }}><Scale size={20}/><span><strong>{u.bodyData}</strong><small>{u.bodyDataHint}</small></span><ChevronRight size={18}/></button>
      <button type="button" onClick={() => go('inbox')}><Inbox size={20}/><span><strong>{u.inbox}</strong><small>{u.inboxHint}</small></span><ChevronRight size={18}/></button>
      <button type="button" onClick={() => go('profile')}><Settings size={20}/><span><strong>{u.settings}</strong><small>{u.settingsHint}</small></span><ChevronRight size={18}/></button>
    </div>
    <GameView screen="home" embedded/>
  </section>;
}
