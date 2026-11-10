'use client';
import { useEffect,useState,type FormEvent } from 'react';
import { Bell,Check,Shield,CalendarDays,Trophy } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { useLanguage } from '@/shared/language';
import { useGameLanguage } from '@/shared/game-language';
import { gameApi } from '@/shared/game-client';
import { Mascot } from './mascot';
import type { notificationState } from '@/server/notifications';
type Inbox=Awaited<ReturnType<typeof notificationState>>;
const toTime=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
const toMinute=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
export function InboxView(){
 const t=useGameLanguage(),{t:base,locale}=useLanguage(),{notify}=useApp();const [inbox,setInbox]=useState<Inbox|null>(null),[pref,setPref]=useState<Inbox['preferences']|null>(null),[busy,setBusy]=useState(false),[pushMessage,setPushMessage]=useState('');
 async function load(){try{const value=await gameApi<Inbox>('notifications');setInbox(value);setPref(value.preferences);}catch{notify(t.error,true);}}
 useEffect(()=>{void load();},[]);
 async function save(e:FormEvent){e.preventDefault();if(!pref)return;setBusy(true);try{const {enabled,reminders,milestones,summaries,restMessages,reminderMinute,quietStart,quietEnd}=pref;await gameApi('notifications/preferences',{enabled,reminders,milestones,summaries,restMessages,reminderMinute,quietStart,quietEnd});if(!enabled&&'serviceWorker' in navigator){const registration=await navigator.serviceWorker.getRegistration();await (await registration?.pushManager.getSubscription())?.unsubscribe();}await load();notify(t.saved);}catch{notify(t.error,true);}finally{setBusy(false);}}
 async function enablePush(){
   if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){setPushMessage(t.pushUnsupported);return;}
   setBusy(true);
   try{
     const permission=await Notification.requestPermission();if(permission!=='granted'){setPushMessage(t.pushDenied);return;}
     if(!inbox?.publicKey){setPushMessage(t.pushError);return;}
     const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
     const encoded=inbox.publicKey.replace(/-/g,'+').replace(/_/g,'/');
     const bytes=Uint8Array.from(atob(encoded+'='.repeat((4-encoded.length%4)%4)),char=>char.charCodeAt(0));
     const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
     await gameApi('push/subscribe',subscription.toJSON());setPushMessage(t.pushReady);await load();
   }catch{setPushMessage(t.pushError);}finally{setBusy(false);}
 }
 async function unsubscribe(){setBusy(true);try{const registration=await navigator.serviceWorker.getRegistration();const subscription=await registration?.pushManager.getSubscription();if(subscription){await gameApi('push/unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe();}await load();setPushMessage('');}catch{notify(t.error,true);}finally{setBusy(false);}}
 if(!inbox||!pref)return <p>{base.loading}</p>;
 return <section><div className="page-heading"><span className="overline">{t.inbox}</span><h1>{t.inboxHint}</h1></div><div className="inbox-layout"><article className="panel inbox-list"><div className="section-heading"><h2>{t.inbox}</h2><button className="text-button" onClick={async()=>{try{await gameApi('notifications/read',{});await load();}catch{notify(t.error,true);}}}><Check size={15}/>{t.readAll}</button></div>{!inbox.items.length?<div className="inbox-empty"><Mascot state="sleepy" size={140}/><p>{t.emptyInbox}</p></div>:inbox.items.map(item=>{const key=item.type==='training'?'Training':item.type==='rest'?'Rest':item.type==='weekly'?'Weekly':'Milestone';return <article className={`inbox-item ${!item.readAt?'unread':''}`} key={item.id}><div className="notice-avatar">{item.type==='milestone'?<Mascot state="happy" size={44}/>:item.type==='rest'?<Shield size={22}/>:item.type==='weekly'?<Trophy size={22}/>:<CalendarDays size={22}/>}</div><div><h3>{t[`notification${key}`]}</h3><p>{t[`notification${key}Body`]}</p>{item.summary&&<p>{t.summaryNumbers.replace('{week}',item.summary.week).replace('{count}',String(item.summary.count)).replace('{goal}',String(item.summary.goal))}</p>}<small>{new Date(item.deliveredAt??item.createdAt).toLocaleString(locale,{timeZone:inbox.timezone})}</small></div></article>;})}</article><aside className="panel notification-settings"><h2>{t.preferences}</h2><form className="form-stack" onSubmit={save}>{(['enabled','reminders','milestones','summaries','restMessages'] as const).map(key=><label className="check-label" key={key}><input type="checkbox" checked={pref[key]} onChange={e=>setPref({...pref,[key]:e.target.checked})}/>{key==='enabled'?t.optIn:t[key]}</label>)}<div className="form-grid"><label>{t.reminderTime}<input type="time" value={toTime(pref.reminderMinute)} onChange={e=>setPref({...pref,reminderMinute:toMinute(e.target.value)})} required/></label><span/></div><div className="form-grid"><label>{t.quietStart}<input type="time" value={toTime(pref.quietStart)} onChange={e=>setPref({...pref,quietStart:toMinute(e.target.value)})} required/></label><label>{t.quietEnd}<input type="time" value={toTime(pref.quietEnd)} onChange={e=>setPref({...pref,quietEnd:toMinute(e.target.value)})} required/></label></div><button className="button primary" disabled={busy}>{base.save}</button></form><div className="push-settings"><h3>{t.push}</h3><p className="muted small">{t.pushHint}</p><button className="button secondary" disabled={busy||!inbox.pushAvailable||!pref.enabled} onClick={()=>void enablePush()}><Bell size={17}/>{t.pushEnable}</button><button className="text-button" disabled={busy} onClick={()=>void unsubscribe()}>{t.pushDisable}</button>{pushMessage&&<p role="status" className="small">{pushMessage}</p>}<button className="text-button" disabled={busy} onClick={async()=>{const {reminders,milestones,summaries,restMessages,reminderMinute,quietStart,quietEnd}=pref;try{await gameApi('notifications/preferences',{enabled:false,reminders,milestones,summaries,restMessages,reminderMinute,quietStart,quietEnd});if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();await (await reg?.pushManager.getSubscription())?.unsubscribe();}await load();}catch{notify(t.error,true);}}}>{t.unsubscribe}</button></div></aside></div></section>;
}
