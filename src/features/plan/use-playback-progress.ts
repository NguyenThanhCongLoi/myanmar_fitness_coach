'use client';
import { useEffect, useRef, useState } from 'react';
import { trainingApi } from '@/shared/client';
import type { PlaybackProgress } from '@/shared/workout-contracts';

/** Persist only the current checkpoint. Reload pauses: disconnected time never becomes completed work. */
export function usePlaybackProgress(sessionId:string, ownerId:string) {
  const key=`mingalar-playback:${ownerId}:${sessionId}`;
  const [restored,setRestored]=useState<PlaybackProgress|null|undefined>(undefined);
  const stopped=useRef(false);
  const latest=useRef<PlaybackProgress|null>(null), sent=useRef(0), inFlight=useRef(false);
  useEffect(()=>{let cancelled=false;
    void trainingApi<PlaybackProgress|null>(`sessions/${sessionId}/playback`).then(server=>{
      let local:PlaybackProgress|null=null;try{local=JSON.parse(localStorage.getItem(key)??'null');}catch{/* optional */}
      const saved=local?.version===1&&(!server||local.sequence>server.sequence)?local:server;
      if(!cancelled){latest.current=saved;setRestored(saved);}
    }).catch(()=>{if(!cancelled)setRestored(null);});
    const flush=()=>{
      const p=latest.current;if(stopped.current||!p||p.sequence<=sent.current||inFlight.current)return;
      inFlight.current=true;
      void trainingApi(`sessions/${sessionId}/playback`,p).then(()=>{sent.current=p.sequence;}).catch(()=>{/* local checkpoint survives retry */}).finally(()=>{inFlight.current=false;});
    };
    const id=setInterval(flush,5000);
    const hidden=()=>{if(document.hidden)flush();};document.addEventListener('visibilitychange',hidden);
    return()=>{cancelled=true;clearInterval(id);document.removeEventListener('visibilitychange',hidden);flush();};
  },[key,sessionId]);
  return {restored,stop:()=>{stopped.current=true;},resume:()=>{stopped.current=false;},flush:async()=>{const p=latest.current;if(p)await trainingApi(`sessions/${sessionId}/playback`,p);},save:(p:Omit<PlaybackProgress,'sequence'|'version'>)=>{
    const next:PlaybackProgress={...p,version:1,sequence:Math.max(Date.now(),(latest.current?.sequence??0)+1)};
    latest.current=next;try{localStorage.setItem(key,JSON.stringify(next));}catch{/* server checkpoint remains available */}
  }};
}
