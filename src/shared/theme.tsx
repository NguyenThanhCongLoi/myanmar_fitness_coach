'use client';
import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTrainingLanguage } from '@/shared/training-language';
import { track } from '@/shared/analytics';
// Theme: system (default) / light / dark. Stored per device; applied as <html data-theme> before paint (see layout).
type Mode = 'system' | 'light' | 'dark';
const KEY = 'mingalar-theme';
export function applyTheme(mode: Mode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export function ThemeToggle() {
  const tt = useTrainingLanguage();
  const [mode, setMode] = useState<Mode>('system');
  useEffect(() => { try { setMode((localStorage.getItem(KEY) as Mode) || 'system'); } catch { /* optional */ } }, []);
  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)'); const on = () => applyTheme('system');
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, [mode]);
  const next: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' };
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;
  return <button type="button" className="icon-button theme-toggle" aria-label={`${tt.themeLabel}: ${tt.themeModes[mode]}`} title={tt.themeModes[mode]}
    onClick={() => { const m = next[mode]; setMode(m); track({ name: 'theme_changed', props: { mode: m } }); try { localStorage.setItem(KEY, m); } catch { /* optional */ } }}><Icon size={19}/></button>;
}
