import en from '@/locales/training-en';
import my from '@/locales/training-my';
import { useLanguage } from './language';
export function useTrainingLanguage() { const { locale } = useLanguage(); return locale === 'my-MM' ? my : en; }
export function fill(template: string, values: Record<string, string | number>) { return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? '')); }
export function clock(totalSeconds: number) { const s = Math.max(0, Math.round(totalSeconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
