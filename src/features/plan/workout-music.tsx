'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Music2, Pause, Play, VolumeX } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { Modal } from '@/shared/ui';
import { workoutVoice } from '@/locales/workout-voice';

// Bundled CC BY tracks (public/audio/music, see ATTRIBUTION.md). One shared <audio> element survives screen changes,
// is unlocked by the Start tap and preloaded while the user reads the intro screen, so music starts instantly.
export const TRACKS = [
  { id: 'pump', title: 'Pump', mood: 'Rock', src: '/audio/music/pump.mp3' },
  { id: 'exhilarate', title: 'Exhilarate', mood: 'Rock', src: '/audio/music/exhilarate.mp3' },
  { id: 'pulse', title: 'Pulse', mood: 'Electronic', src: '/audio/music/pulse.mp3' },
  { id: 'funk-game-loop', title: 'Funk Game Loop', mood: 'Funk', src: '/audio/music/funk-game-loop.mp3' },
  { id: 'there-it-is', title: 'There It Is', mood: 'Funk', src: '/audio/music/there-it-is.mp3' },
  { id: 'smooth-move', title: 'Smooth Move', mood: 'Funk', src: '/audio/music/smooth-move.mp3' },
] as const;
const KEY = 'mingalar-music', FULL = 0.55, LOW = 0.18;
let el: HTMLAudioElement | null = null, wanted = false, ducked=false;
function volume(){try{const n=Number(localStorage.getItem('mingalar-music-volume')??FULL);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):FULL;}catch{return FULL;}}
function applyVolume(){if(el)el.volume=volume()*(ducked?LOW/FULL:1);}
const listeners = new Set<() => void>();

export function musicChoice(): string {
  try { const v = localStorage.getItem(KEY); if (v === 'none' || TRACKS.some(t => t.id === v)) return v!; } catch { /* optional */ }
  return TRACKS[0].id;
}
function track(id = musicChoice()) { return TRACKS.find(t => t.id === id) ?? null; }
function audio() {
  if (typeof window === 'undefined') return null;
  if (!el) { el = new Audio(); el.loop = true; el.preload = 'auto'; el.volume = FULL; }
  return el;
}
function load(id = musicChoice()) { const a = audio(), t = track(id); if (!a || !t) return a; if (!a.src.endsWith(t.src)) { a.src = t.src; a.load(); } return a; }
export const music = {
  /** Start downloading the chosen track (call on any pre-workout screen). */
  preload() { load(); },
  /** Call inside the Start tap: unlocks playback on iOS/Android without making sound. */
  prime() { const a = load(); if (!a || !track()) return; a.muted = true; void a.play().then(() => { if (!wanted) a.pause(); a.muted = false; }).catch(() => { a.muted = false; }); },
  play() { const a = load(); wanted = true; if (!a || !track()) return; a.muted = false; applyVolume(); void a.play().catch(() => {}); },
  duck(low: boolean) { ducked=low;applyVolume(); },
  volume(value:number){try{localStorage.setItem('mingalar-music-volume',String(Math.max(0,Math.min(1,value))));}catch{/* optional */}applyVolume();listeners.forEach(f=>f());},
  pause() { wanted = false; el?.pause(); },
  stop() { wanted = false; if (el) { el.pause(); el.currentTime = 0; } },
  choose(id: string) { try { localStorage.setItem(KEY, id); } catch { /* optional */ } const playing = wanted; music.stop(); load(id); if (playing) music.play(); listeners.forEach(f => f()); },
};

/** In-session volume/mute; editing does not select or restart the current track. */
export function MusicControl({onOpenChange}:{onOpenChange?:(open:boolean)=>void}) {
  const {locale}=useLanguage(),v=workoutVoice[locale==='my-MM'?'my':'en'];
  const [open,setOpen]=useState(false),[value,setValue]=useState(FULL);
  const change=(n:number)=>{setValue(n);music.volume(n);};
  const close=()=>{setOpen(false);onOpenChange?.(false);};
  return <><button type="button" className="button secondary audio-btn" aria-label={v.music} onClick={()=>{setValue(volume());setOpen(true);onOpenChange?.(true);}}><Music2 size={22}/></button>
    {open&&<Modal title={v.music} close={close}><label>{v.volume}<input aria-label={v.volume} type="range" min={0} max={1} step={0.05} value={value} onChange={e=>change(Number(e.target.value))}/></label><button className="button secondary" onClick={()=>change(value===0?FULL:0)}><VolumeX size={20}/>{value===0?v.music:v.noMusic}</button><button className="button primary" onClick={close}>OK</button></Modal>}</>;
}

/** Compact chip that opens the track list; shown next to every Start button. */
export function MusicPicker() {
  const { locale } = useLanguage(); const v = workoutVoice[locale === 'my-MM' ? 'my' : 'en'];
  const [open, setOpen] = useState(false), [choice, setChoice] = useState('pump'), [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { const sync = () => setChoice(musicChoice()); sync(); music.preload(); listeners.add(sync); return () => { listeners.delete(sync); }; }, []);
  useEffect(() => { if (!open && preview) { music.stop(); setPreview(null); } }, [open]);
  const [loudness,setLoudness]=useState(FULL);
  useEffect(()=>{setLoudness(volume());},[]);
  const current = track(choice);
  function pick(id: string) { music.choose(id); setChoice(id); if (id === 'none') { music.stop(); setPreview(null); } }
  function toggle(id: string) { if (preview === id) { music.stop(); setPreview(null); return; } pick(id); music.play(); setPreview(id); }
  return <>
    <button type="button" className="music-chip" onClick={() => setOpen(true)} aria-haspopup="dialog">
      {current ? <Music2 size={18}/> : <VolumeX size={18}/>}<span><small>{v.music}</small><strong>{current?.title ?? v.noMusic}</strong></span>
    </button>
    {open && <Modal title={v.musicTitle} close={() => setOpen(false)}>
      <label>{v.volume}<input aria-label={v.volume} type="range" min={0} max={1} step={0.05} value={loudness} onChange={e=>{setLoudness(Number(e.target.value));music.volume(Number(e.target.value));}}/></label>
      <ul className="music-list" role="listbox" aria-label={v.musicTitle}>
        <li><button type="button" role="option" aria-selected={choice === 'none'} className={choice === 'none' ? 'on' : ''} onClick={() => pick('none')}>
          <span className="music-ico"><VolumeX size={20}/></span><span><strong>{v.noMusic}</strong></span>{choice === 'none' && <Check size={20}/>}</button></li>
        {TRACKS.map(t => <li key={t.id}><button type="button" role="option" aria-selected={choice === t.id} className={choice === t.id ? 'on' : ''} onClick={() => toggle(t.id)}>
          <span className="music-ico">{preview === t.id ? <Pause size={20}/> : <Play size={20}/>}</span><span><strong>{t.title}</strong><small>{t.mood}</small></span>{choice === t.id && <Check size={20}/>}</button></li>)}
      </ul>
      <button type="button" className="button primary" onClick={() => setOpen(false)}>OK</button>
      <p className="muted small" lang="en">{v.credit}</p>
    </Modal>}
  </>;
}

/** Sticky bottom bar: music chip + one big Start button. Stays visible while the page scrolls. */
export function StartBar({ label, busy, disabled, onStart, icon }: { label: string; busy?: boolean; disabled?: boolean; onStart: () => void; icon?: ReactNode }) {
  return <div className="start-bar"><MusicPicker/>
    <button type="button" className="start-bar-go" disabled={busy || disabled} onClick={() => { music.prime(); onStart(); }}>{icon ?? <Play size={24}/>}<span>{label}</span></button>
  </div>;
}
