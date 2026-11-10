'use client';
import { createContext, useContext } from 'react';
import type { Bootstrap } from './types';
export type View = 'home' | 'exercises' | 'plans' | 'progress' | 'coach' | 'profile' | 'workout';
export type AppContextValue = { data: Bootstrap; refresh: () => Promise<void>; go: (view: View) => void; start: (dayId: string) => Promise<void>; openWorkout: (id: string) => void; notify: (message: string, error?: boolean) => void; newPlan: () => void };
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('Application context missing'); return value; }
