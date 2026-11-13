'use client';
import {useEffect,useRef} from 'react';
import {consumeActiveTime} from '@/shared/workout-timing';

/** Retain fractional seconds across pause/buffering instead of restarting a whole-second timeout. */
export function useActiveClock(active:boolean,identity:string,onSeconds:(n:number)=>void) {
  const remainder=useRef(0),callback=useRef(onSeconds);callback.current=onSeconds;
  useEffect(()=>{remainder.current=0;},[identity]);
  useEffect(()=>{
    if(!active)return;
    let at=performance.now();
    const consume=()=>{const now=performance.now(),elapsed=consumeActiveTime(remainder.current,now-at);at=now;remainder.current=elapsed.remainderMs;if(elapsed.seconds)callback.current(elapsed.seconds);};
    const interval=setInterval(consume,100);
    return()=>{clearInterval(interval);consume();};
  },[active,identity]);
}
