'use client';
import { FLAME_TIERS, flameTier } from '@/server/streak';
import { useGameLanguage } from '@/shared/game-language';
import type { CSSProperties } from 'react';
export function Flame({count=0,preview=false}:{count?:number;preview?:boolean}){
  const t=useGameLanguage(),tier=flameTier(count);
  return <div className={`flame flame-${tier.key} ${preview?'preview':''}`} style={{'--flame-color':tier.color} as CSSProperties} aria-label={`${t.flame}: ${t[tier.key]} · ${count}`}><span className="flame-halo"/><svg viewBox="0 0 120 145" role="img" aria-hidden="true"><path d="M61 8c9 27 29 34 21 59 11-4 15-13 16-21 15 20 22 38 13 61-9 23-31 30-50 30-30 0-52-20-50-47 1-20 12-32 21-43-1 20 6 24 10 29C29 47 53 34 61 8Z" fill="currentColor"/><path d="M62 71c-1 23 25 27 19 45-4 12-20 16-30 9-17-12-5-28 11-54Z" fill="#fff0bf"/></svg><i/><i/><i/>{!preview&&<span className="flame-count">{count}</span>}</div>;
}
export {FLAME_TIERS};
