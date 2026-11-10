'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import en from '@/locales/en';
import my from '@/locales/my-MM';
import type { Locale } from './types';
const Context = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: typeof en }>({ locale: 'my-MM', setLocale: () => {}, t: my });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, update] = useState<Locale>('my-MM');
  useEffect(() => { const saved = localStorage.getItem('mingalar-locale'); if (saved === 'en') update('en'); }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function setLocale(value: Locale) { update(value); localStorage.setItem('mingalar-locale', value); }
  return <Context.Provider value={{ locale, setLocale, t: locale === 'en' ? en : { ...en, ...my } }}>{children}</Context.Provider>;
}
export function useLanguage() { return useContext(Context); }
export function errorText(error: unknown, t: typeof en) {
  const code = error instanceof Error ? error.message : '';
  const value = t[code as keyof typeof t];
  return typeof value === 'string' ? value : t.error;
}
