'use client';
import { ThemeToggle } from '@/shared/theme';
import { LanguageProvider } from '@/shared/language';
import { AdminView } from './admin-view';
export function AdminShell() {
  return <LanguageProvider><div className="admin-shell">
    <header className="admin-header"><strong>Mingalar Fit</strong><span className="admin-badge">Admin</span><span className="admin-spacer"/><a className="text-button" href="/">Open app</a><ThemeToggle/></header>
    <main className="admin-main"><AdminView/></main>
  </div></LanguageProvider>;
}
