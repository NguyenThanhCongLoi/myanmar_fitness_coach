// Pure civil-calendar rules. Existing days keep their original timezone/schedule snapshot.
export type StreakDay = { day: string; week: string; planned: boolean; weeklyGoal: number; kind: string };
export const FLAME_TIERS = [
  {min:0,key:'ember',color:'#a7ada4'}, {min:3,key:'orange',color:'#fa963b'},
  {min:7,key:'red',color:'#ec6053'}, {min:14,key:'purple',color:'#a37bea'},
  {min:30,key:'blue',color:'#60b6eb'}, {min:60,key:'gold',color:'#eac259'},
] as const;
export const FLAME_LIT_AT = 3;
export function flameTier(count:number) { return [...FLAME_TIERS].reverse().find(t=>count>=t.min)??FLAME_TIERS[0]; }
export function civilDay(date:Date,timezone:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDay(day:string,n:number) { const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10); }
export function weekday(day:string) { return (new Date(day+'T12:00:00Z').getUTCDay()+6)%7; }
export function weekOf(day:string) { return addDay(day,-weekday(day)); }
export function localMinute(now:Date,timezone:string) { const p=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);return Number(p.find(x=>x.type==='hour')!.value)*60+Number(p.find(x=>x.type==='minute')!.value); }
export function quietNow(minute:number,start:number,end:number) { return start===end?false:start<end?minute>=start&&minute<end:minute>=start||minute<end; }
export function calculateStreak(days:StreakDay[],today:string) {
  let current=0,longest=0,weekly=0,longestWeekly=0;
  const weeks=new Map<string,{count:number;goal:number;recovery:boolean}>();
  for(const day of [...days].sort((a,b)=>a.day.localeCompare(b.day))) {
    if(day.day>today)continue;
    if(day.kind==='complete'){current++;longest=Math.max(longest,current);}
    else if(day.kind==='missed'&&day.day<today)current=0;
    const w=weeks.get(day.week)??{count:0,goal:day.weeklyGoal,recovery:false};
    if(day.kind==='complete')w.count++;
    if(day.kind==='recovery'||day.kind==='transition')w.recovery=true;
    weeks.set(day.week,w);
  }
  for(const [week,w] of [...weeks.entries()].sort()) {
    if(w.count>=w.goal){weekly++;longestWeekly=Math.max(longestWeekly,weekly);}
    else if(week<weekOf(today)&&!w.recovery)weekly=0;
  }
  return {current,longest,weekly,longestWeekly};
}
