'use client';
import { useEffect, useRef } from 'react';

/** At most one next clip, released on replacement/unmount. Save-data users fetch metadata only. */
export function NextVideo({src}:{src?:string|null}) {
  const video=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const el=video.current;if(!el||!src)return;
    const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
    el.preload=connection?.saveData||connection?.effectiveType==='2g'?'metadata':'auto';
    el.src=src;el.load();
    return()=>{el.pause();el.removeAttribute('src');el.load();};
  },[src]);
  return <video ref={video} hidden muted playsInline aria-hidden="true" data-next-video="true"/>;
}
