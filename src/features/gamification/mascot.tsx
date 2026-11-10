'use client';
import { useEffect, useState, type CSSProperties, type ComponentType } from 'react';
import { mascotManifest, type MascotState } from './mascot-manifest';
import { useGameLanguage } from '@/shared/game-language';
export function Mascot({state='idle',size=150,renderRive:Rive}:{state?:MascotState;size?:number;renderRive?:ComponentType<{src:string;stateMachine:string;state:MascotState}>}){
  const t=useGameLanguage(),asset=mascotManifest[state];const [reduced,setReduced]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  useEffect(()=>setFailed(false),[state]);
  const style={width:size,height:size} as CSSProperties;
  return <div className={`mascot mascot-${state}`} data-state={state} style={style}>
    {asset.kind==='rive'&&Rive&&!reduced&&!failed?<Rive src={asset.src} stateMachine={asset.stateMachine} state={state}/>:asset.kind==='sprite'&&!reduced&&!failed?<div role="img" aria-label={t[state]} className="mascot-sprite" style={{backgroundImage:`url(${asset.src})`,backgroundSize:`${asset.frames*100}% 100%`,'--frames':asset.frames,'--sprite-duration':`${asset.durationMs}ms`} as CSSProperties}/>:<img src={failed||asset.kind!=='image'?asset.fallback:asset.src} alt={t[state]} onError={()=>setFailed(true)} width={size} height={size}/>}
  </div>;
}
