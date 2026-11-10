import {expect,test} from 'vitest';
import {addDay,calculateStreak,civilDay,flameTier,quietNow,weekOf,type StreakDay} from '../src/server/streak';
function day(date:string,kind:string,planned=true):StreakDay{return {day:date,week:weekOf(date),kind,planned,weeklyGoal:3};}
test('new user and first completion',()=>{
 expect(calculateStreak([], '2026-11-10')).toEqual({current:0,longest:0,weekly:0,longestWeekly:0});
 expect(calculateStreak([day('2026-11-10','complete')],'2026-11-10').current).toBe(1);
});
test('rest, recovery and a protected miss preserve but do not grow a habit streak',()=>{
 const days=[day('2026-11-02','complete'),day('2026-11-03','rest',false),day('2026-11-04','protected'),day('2026-11-05','recovery'),day('2026-11-06','complete')];
 expect(calculateStreak(days,'2026-11-06').current).toBe(2);
});
test('missed training day resets current, retains longest and permits recovery',()=>{
 const days=[day('2026-11-02','complete'),day('2026-11-03','complete'),day('2026-11-04','missed'),day('2026-11-05','complete')];
 expect(calculateStreak(days,'2026-11-05')).toMatchObject({current:1,longest:2});
});
test('today is not missed before local day closes and future credits do not count',()=>{
 expect(calculateStreak([day('2026-11-09','complete'),day('2026-11-10','open'),day('2026-11-11','complete')],'2026-11-10').current).toBe(1);
});
test('seven credited training days reach a milestone across planned rest days',()=>{
 const days=Array.from({length:13},(_,i)=>day(addDay('2026-10-28',i),i%2===0?'complete':'rest',i%2===0));
 expect(calculateStreak(days,'2026-11-10').current).toBe(7);expect(flameTier(7).key).toBe('red');
});
test('weekly streak waits for current goal and skips recovery weeks',()=>{
 const days=['2026-10-26','2026-10-28','2026-10-30'].map(d=>day(d,'complete'));
 days.push(day('2026-11-02','recovery'),day('2026-11-09','open'));
 expect(calculateStreak(days,'2026-11-09')).toMatchObject({weekly:1,longestWeekly:1});
 days[3]=day('2026-11-02','missed');expect(calculateStreak(days,'2026-11-09').weekly).toBe(0);
});
test('timezone and DST calendar boundaries are civil days, not 24-hour slices',()=>{
 expect(civilDay(new Date('2026-11-09T18:00:00Z'),'Asia/Yangon')).toBe('2026-11-10');
 expect(civilDay(new Date('2026-11-01T05:30:00Z'),'America/New_York')).toBe('2026-11-01');
 expect(civilDay(new Date('2026-11-01T06:30:00Z'),'America/New_York')).toBe('2026-11-01');
});
test('quiet hours wrap midnight and configurable flame tier boundaries',()=>{
 expect(quietNow(23*60,21*60,8*60)).toBe(true);expect(quietNow(7*60,21*60,8*60)).toBe(true);expect(quietNow(12*60,21*60,8*60)).toBe(false);
 expect([0,2,3,6,7,13,14,29,30,59,60].map(n=>flameTier(n).key)).toEqual(['ember','ember','orange','orange','red','red','purple','purple','blue','blue','gold']);
});
