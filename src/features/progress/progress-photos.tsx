'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Lock, Trash2 } from 'lucide-react';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { track } from '@/shared/analytics';

// Progress photos stay on this device only (IndexedDB). Body photos are sensitive, so nothing is uploaded to the server.
type Photo = { id: string; takenAt: string; blob: Blob };
const DB = 'mingalar-photos', STORE = 'photos';
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => { const r = run(d.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
// Downscale to max 1080 px JPEG so photos stay small on the device.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.82));
}

export function ProgressPhotos() {
  const { locale } = useLanguage(); const tt = useTrainingLanguage();
  const [photos, setPhotos] = useState<Photo[]>([]); const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState(''); const input = useRef<HTMLInputElement>(null);
  async function load() {
    try { const all = (await tx<Photo[]>('readonly', s => s.getAll() as IDBRequest<Photo[]>)).sort((a, b) => a.takenAt.localeCompare(b.takenAt)); setPhotos(all); }
    catch { setError(tt.photosUnavailable); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { const next = Object.fromEntries(photos.map(p => [p.id, URL.createObjectURL(p.blob)])); setUrls(next); return () => Object.values(next).forEach(u => URL.revokeObjectURL(u)); }, [photos]);
  async function add(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setError('');
    try { const blob = await shrink(file); await tx('readwrite', s => s.put({ id: `${Date.now()}`, takenAt: new Date().toISOString(), blob })); track({ name: 'photo_added' }); await load(); }
    catch { setError(tt.photosUnavailable); }
  }
  async function remove(id: string) { if (!confirm(tt.photoDeleteConfirm)) return; await tx('readwrite', s => s.delete(id)); await load(); }
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const first = photos[0], last = photos.at(-1);
  return <section className="panel progress-photos">
    <div className="section-heading"><h2><Camera size={18}/> {tt.photosTitle}</h2>
      <button type="button" className="button secondary" onClick={() => input.current?.click()}><Camera size={16}/>{tt.photoAdd}</button></div>
    <p className="muted small"><Lock size={13}/> {tt.photosPrivacy}</p>
    <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={e => { void add(e.target.files?.[0]); e.target.value = ''; }}/>
    {error && <p className="error-text" role="alert">{error}</p>}
    {photos.length >= 2 && first && last && <div className="photo-compare" aria-label={tt.photoCompare}>
      {[first, last].map((p, i) => <figure key={p.id}><img src={urls[p.id]} alt={`${i ? tt.photoLatest : tt.photoFirst} · ${date(p.takenAt)}`}/><figcaption>{i ? tt.photoLatest : tt.photoFirst} · {date(p.takenAt)}</figcaption></figure>)}
    </div>}
    {photos.length ? <ul className="photo-strip">{[...photos].reverse().map(p => <li key={p.id}><img src={urls[p.id]} alt={date(p.takenAt)}/><span>{date(p.takenAt)}</span><button type="button" className="icon-button" aria-label={`${tt.remove} ${date(p.takenAt)}`} onClick={() => void remove(p.id)}><Trash2 size={15}/></button></li>)}</ul>
      : <p className="muted">{tt.photosEmpty}</p>}
  </section>;
}
