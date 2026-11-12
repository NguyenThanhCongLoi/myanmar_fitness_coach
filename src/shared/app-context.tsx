'use client';
import { createContext, useContext } from 'react';
import type { Bootstrap } from './types';
export type View = 'home' | 'train' | 'exercises' | 'plans' | 'progress' | 'coach' | 'profile' | 'workout' | 'achievements' | 'inbox' | 'credits' | 'discover' | 'water' | 'me' | 'target';
export type TrainPreset = { mode: 'free'; name: string; rows: { exerciseId: string; sets: number; reps: number; restSeconds: number }[] } | { mode: 'follow'; focus: string; minutes: number };
export type AppContextValue = { data: Bootstrap; refresh: () => Promise<void>; go: (view: View) => void; start: (dayId: string) => Promise<void>; openWorkout: (id: string) => void; notify: (message: string, error?: boolean) => void; newPlan: () => void; celebrate:(reward:{awarded:boolean;xp:number;streak?:number})=>void; exerciseId: string; openExercise: (id: string) => void; openCoach: (draft: string) => void; coachDraft: string; clearCoachDraft: () => void; openTrain: (preset: TrainPreset) => void; trainPreset: TrainPreset | null; clearTrainPreset: () => void };
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('Application context missing'); return value; }
