'use client';
import { useGameLanguage } from '@/shared/game-language';
import type { MascotState } from './mascot-manifest';
import { BeeMessage } from './mascot';
export type TipContext='home'|'train'|'library'|'progress'|'nutrition';
const STATE:Record<TipContext,MascotState>={home:'waving',train:'determined',library:'pointing',progress:'proud',nutrition:'happy'};
// Same slogan all day (per context), a new one tomorrow — deterministic, no randomness in render.
export function dailySlogan(list:readonly string[],context:TipContext,now=new Date()){
  const day=Math.floor((now.getTime()+6.5*3600000)/86400000),offset=context.length*7;
  return list[(day+offset)%list.length];
}
export function BeeTip({context,size=58}:{context:TipContext;size?:number}){
  const t=useGameLanguage();
  return <div className={`bee-tip bee-tip-${context}`}><BeeMessage state={STATE[context]} size={size} text={dailySlogan(t.slogans[context],context)}/></div>;
}
