// Additive integration contract. Existing visual components may consume these without a redesign.
export type { Exercise, WorkoutSet as ExerciseSet, Workout as WorkoutSession } from './types';
export type { PlanDay as WorkoutPlan } from './plan';
export type RestInterval = { seconds: number; kind: 'set' | 'transition' | 'round'; reason: string };
export type WorkoutPlayerState = 'ready' | 'work' | 'rest' | 'summary' | 'feedback' | 'result';
export type VoiceCoachEvent = { key: string; kind: 'starts' | 'go' | 'side' | 'relax' | 'ready' | 'complete' | 'encourage' | 'count'; exerciseId?: string; n?: number };
export type PlaybackProgress = {
  version: 1; prescriptionId: string; setIndex: number; phase: 'ready' | 'work' | 'rest';
  remaining: number; restTotal: number; gymElapsed: number; paused: boolean;
  reps: number; kg: number; rir: number | null; activeSeconds: number; sequence: number;
};
