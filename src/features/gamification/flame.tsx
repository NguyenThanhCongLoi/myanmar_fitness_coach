'use client';
import { FLAME_LIT_AT, FLAME_TIERS, flameTier } from '@/server/streak';
import { useGameLanguage } from '@/shared/game-language';
import type { CSSProperties } from 'react';
// Unlit (grey, still) below FLAME_LIT_AT training days in a row; lit and colored by tier from then on.
export function Flame({count=0,preview=false,igniting=false}:{count?:number;preview?:boolean;igniting?:boolean}){
  const t=useGameLanguage(),tier=flameTier(count),lit=preview||count>=FLAME_LIT_AT;
  return <div className={`flame flame-${tier.key} ${lit?'flame-lit':'flame-unlit'} ${igniting?'flame-igniting':''} ${preview?'preview':''}`} style={{'--flame-color':tier.color} as CSSProperties} aria-label={`${t.flame}: ${t[tier.key]} · ${count}`}><span className="flame-halo"/><svg viewBox="0 0 120 145" role="img" aria-hidden="true"><path d="M61 8c9 27 29 34 21 59 11-4 15-13 16-21 15 20 22 38 13 61-9 23-31 30-50 30-30 0-52-20-50-47 1-20 12-32 21-43-1 20 6 24 10 29C29 47 53 34 61 8Z" fill="currentColor"/><path d="M62 71c-1 23 25 27 19 45-4 12-20 16-30 9-17-12-5-28 11-54Z" fill={lit?'#fff0bf':'#e4e7e1'}/></svg><i/><i/><i/>
    {!preview&&(lit?<span className="flame-count">{count}</span>:<span className="flame-steps" aria-hidden="true">{Array.from({length:FLAME_LIT_AT},(_,i)=><b key={i} className={i<count?'on':''}/>)}</span>)}</div>;
}
export {FLAME_TIERS,FLAME_LIT_AT};
