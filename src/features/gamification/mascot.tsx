'use client';
import { useEffect, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import { mascotManifest, beeAvatar, MASCOT_EVENTS, type MascotEvent, type MascotState } from './mascot-manifest';
import { useGameLanguage } from '@/shared/game-language';
function useReducedMotion(){const [reduced,setReduced]=useState(false);useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);return reduced;}
// BeeMascot: full-body Bee for a state. Static image + gentle CSS motion (disabled for reduced motion); no fake frame cycling.
export function Mascot({state='idle',size=150,still=false,label,renderRive:Rive}:{state?:MascotState;size?:number;still?:boolean;label?:string;renderRive?:ComponentType<{src:string;stateMachine:string;state:MascotState}>}){
  const t=useGameLanguage(),asset=mascotManifest[state]??mascotManifest.idle;const reduced=useReducedMotion();const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[state]);
  const style={width:size,height:size} as CSSProperties;
  const alt=label??t[state];
  return <div className={`mascot mascot-${state} ${still||reduced?'still':''}`} data-state={state} style={style}>
    {asset.kind==='rive'&&Rive&&!reduced&&!failed?<Rive src={asset.src} stateMachine={asset.stateMachine} state={state}/>:asset.kind==='sprite'&&!reduced&&!failed?<div role="img" aria-label={alt} className="mascot-sprite" style={{backgroundImage:`url(${asset.src})`,backgroundSize:`${asset.frames*100}% 100%`,'--frames':asset.frames,'--sprite-duration':`${asset.durationMs}ms`} as CSSProperties}/>
    :<img src={failed||asset.kind!=='image'?asset.fallback:size<=120?asset.srcSmall:asset.src} alt={alt} onError={()=>setFailed(true)} width={size} height={size} loading="lazy" decoding="async" draggable={false}/>}
  </div>;
}
export const BeeMascot=Mascot;
// BeeAvatar: face crop for AI Coach identity, chat messages and notifications.
export function BeeAvatar({mood='idle',size=40,thinking=false,label}:{mood?:'idle'|'happy';size?:number;thinking?:boolean;label?:string}){
  const src=`${beeAvatar[mood]}-${size>96?192:96}.webp`;
  return <span className={`bee-avatar ${thinking?'thinking':''}`} style={{width:size,height:size}}><img src={src} alt={label??''} width={size} height={size} draggable={false}/></span>;
}
// BeeMessage: small Bee + localized line, used beside contextual actions (never over videos or muscle maps).
export function BeeMessage({state='pointing',text,size=64}:{state?:MascotState;text:string;size?:number}){
  return <div className="bee-message"><Mascot state={state} size={size} label=""/><p>{text}</p></div>;
}
// Event-driven state with priority/hold: a high-priority reaction holds for holdMs before lower ones can replace it.
export function useMascotState(initial:MascotState='idle',holdMs=4000){
  const [state,setState]=useState<MascotState>(initial);const lock=useRef({priority:0,until:0});
  const emit=(event:MascotEvent)=>{const next=MASCOT_EVENTS[event],now=Date.now();if(next.priority<lock.current.priority&&now<lock.current.until)return;lock.current={priority:next.priority,until:now+holdMs};setState(next.state);};
  return [state,emit,setState] as const;
}
// BeeReaction: brief, non-blocking reaction (pointer-events none) that never covers timers or videos.
export function BeeReaction({state,text,onDone,ms=3500}:{state:MascotState;text:string;onDone:()=>void;ms?:number}){
  useEffect(()=>{const id=setTimeout(onDone,ms);return()=>clearTimeout(id);},[text,state]);
  return <div className="bee-reaction" role="status"><Mascot state={state} size={48} label=""/><p>{text}</p></div>;
}
