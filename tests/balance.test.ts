import { describe, expect, it } from 'vitest';
import { muscleBalance } from '@/shared/plan';

const lib = [
  { id: 'curl', primaryMuscles: ['biceps'] }, { id: 'pushdown', primaryMuscles: ['triceps'] }, { id: 'crunch', primaryMuscles: ['abs'] },
  { id: 'squat', primaryMuscles: ['quadriceps', 'gluteal'] }, { id: 'row', primaryMuscles: ['upper-back'] }, { id: 'press', primaryMuscles: ['chest'] },
];

describe('muscle balance', () => {
  it('needs at least 8 sets before judging', () => {
    expect(muscleBalance([{ id: 'curl', sets: 6 }], lib).issues).toEqual([]);
  });
  it('flags a week that is mostly arms and abs, with no legs or back', () => {
    const r = muscleBalance([{ id: 'curl', sets: 6 }, { id: 'pushdown', sets: 4 }, { id: 'crunch', sets: 8 }, { id: 'press', sets: 4 }], lib);
    expect(r.issues.map(i => i.code)).toEqual(['BALANCE_TOO_MUCH_ARMS', 'BALANCE_TOO_MUCH_CORE', 'BALANCE_NO_LEGS', 'BALANCE_NO_BACK']);
    expect(r.issues[0].values?.pct).toBe(45);
  });
  it('accepts a balanced week', () => {
    const r = muscleBalance([{ id: 'squat', sets: 6 }, { id: 'row', sets: 5 }, { id: 'press', sets: 5 }, { id: 'curl', sets: 2 }, { id: 'crunch', sets: 2 }], lib);
    expect(r.issues).toEqual([]);
    expect(r.share.legs).toBe(30);
  });
});
