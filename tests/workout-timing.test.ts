import { expect, test } from 'vitest';
import { countdownRemaining, estimatedSetSeconds,consumeActiveTime } from '../src/shared/workout-timing';
import { secondsFor, trimToMinutes, type PlanItem } from '../src/shared/plan';

test('Gym time estimate includes both sides and agrees with the programme duration',()=>{
  for(const perSide of [false,true]){
    const item:PlanItem={id:'gym-one-arm-row',sets:1,target:10,unit:'reps',rest:90,perSide};
    expect(secondsFor([item])).toBe(10+estimatedSetSeconds(10,perSide));
  }
  expect(countdownRemaining(30,7)).toBe(23);
  expect(countdownRemaining(30,35)).toBe(0);
});
test('short playback fragments accumulate across buffering without inventing paused time',()=>{
  let remainder=0,seconds=0;
  for(const delta of [350,350,350,0,500,500]){const next=consumeActiveTime(remainder,delta);remainder=next.remainderMs;seconds+=next.seconds;}
  expect(seconds).toBe(2);expect(remainder).toBe(50);
});
test('after rep progression, duration stays within the chosen time without mutating the input',()=>{
  const items:PlanItem[]=[{id:'gym-leg-press',sets:4,target:15,unit:'reps',rest:120,perSide:false},{id:'gym-row',sets:3,target:15,unit:'reps',rest:90,perSide:false}];
  const snapshot=structuredClone(items),fitted=trimToMinutes(items,10);
  expect(secondsFor(fitted)).toBeLessThanOrEqual(600);
  expect(fitted.every(x=>x.sets>=1)).toBe(true);
  expect(items).toEqual(snapshot);
});
