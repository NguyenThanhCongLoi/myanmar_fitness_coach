'use client';
import { useRef, useState } from 'react';
import { Camera, Check, Footprints, Sparkles } from 'lucide-react';
import { useApp } from '@/shared/app-context';
import { RequestError, trainingApi } from '@/shared/client';
import { useLanguage } from '@/shared/language';
import { useTrainingLanguage } from '@/shared/training-language';
import { FOOD_PRESETS } from '@/shared/energy';
import { buzz } from '@/shared/wake-lock';

// Photo of a meal → AI estimate (preview, editable selection) → save to the food log → next-meal / walking suggestion.
// The photo is resized on the phone and never stored on the server.
type Item = { description: string; portion: string; kcal: number; proteinG: number };
type Energy = { targetIntake: number | null; protein: [number, number] | null; body: { weightKg: number | null }; daily: { intake: number; protein: number }[] };
const mealNow = () => { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; };
async function shrink(file: File) {
  const bmp = await createImageBitmap(file); const k = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72);
}

export function MealPhoto({ onSaved }: { onSaved?: () => void }) {
  const { notify } = useApp(); const { locale } = useLanguage(); const tt = useTrainingLanguage(); const u = tt.ux;
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(''); const [items, setItems] = useState<(Item & { on: boolean })[] | null>(null); const [confidence, setConfidence] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [tips, setTips] = useState<{ foods: string[]; walk: number | null; left: number; protein: number } | null>(null);
  async function pick(file?: File) {
    if (!file) return; setError(''); setItems(null); setTips(null); setBusy(true);
    try {
      const image = await shrink(file); setPreview(image);
      const r = await trainingApi<{ items: Item[]; confidence: string }>('energy/photo', { image, locale });
      setItems(r.items.map(i => ({ ...i, on: true }))); setConfidence(r.confidence);
      if (!r.items.length) setError(u.photoNoFood);
    } catch (e) {
      const code = e instanceof RequestError ? e.code : '';
      setError(code === 'PHOTO_NOT_SUPPORTED' ? u.photoUnsupported : code === 'LLM_NOT_CONFIGURED' ? u.photoNoAi : u.photoFailed);
    } finally { setBusy(false); }
  }
  async function save() {
    if (!items) return; setBusy(true);
    try {
      for (const i of items.filter(x => x.on)) await trainingApi('energy/food', { meal: mealNow(), description: `${i.description}${i.portion ? ` (${i.portion})` : ''}`.slice(0, 120), kcal: i.kcal, proteinG: i.proteinG, source: 'photo' });
      buzz(20); notify(u.photoSaved); setItems(null); setPreview(''); onSaved?.();
      const e = await trainingApi<Energy>('energy'); const today = e.daily.at(-1)!; const target = e.targetIntake ?? 2000;
      const left = target - today.intake, proteinLeft = Math.max(0, (e.protein?.[0] ?? 0) - today.protein);
      const foods = left > 80 ? [...FOOD_PRESETS].filter(f => f.kcal <= left).sort((a, b) => b.protein / b.kcal - a.protein / a.kcal).slice(0, 3).map(f => `${tt.foods[f.key]} · ${f.kcal} kcal`) : [];
      // over target: brisk walking ≈ 3.5 MET
      const walk = left < -50 ? Math.ceil(-left / (3.5 * (e.body.weightKg ?? 65) / 60)) : null;
      setTips({ foods, walk, left: Math.round(left), protein: Math.round(proteinLeft) });
    } catch { notify(u.photoFailed); } finally { setBusy(false); }
  }
  const total = items?.filter(i => i.on).reduce((n, i) => n + i.kcal, 0) ?? 0;
  return <section className="panel meal-photo">
    <div className="meal-photo-head"><div><h2><Camera size={20}/> {u.mealPhoto}</h2><small className="muted">{u.mealPhotoHint}</small></div>
      <button type="button" className="button primary" disabled={busy} onClick={() => input.current?.click()}><Camera size={18}/>{busy && !items ? u.photoReading : u.photoTake}</button></div>
    <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }}/>
    {preview && <img className="meal-photo-img" src={preview} alt=""/>}
    {busy && !items && <div className="sk sk-line"/>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {items && items.length > 0 && <>
      <p className="muted small"><Sparkles size={14}/> {u.photoEstimate}{confidence === 'low' ? ` · ${u.photoLow}` : ''}</p>
      <ul className="meal-items">{items.map((i, k) => <li key={k}><label><input type="checkbox" checked={i.on} onChange={e => setItems(items.map((x, j) => j === k ? { ...x, on: e.target.checked } : x))}/>
        <span><strong>{i.description}</strong><small>{i.portion}</small></span><b>{i.kcal} kcal</b></label></li>)}</ul>
      <button type="button" className="button primary big-start" disabled={busy || !total} onClick={() => void save()}><Check size={18}/>{u.photoSave.replace('{kcal}', String(total))}</button>
    </>}
    {tips && <div className="meal-tips">
      <strong>{tips.left >= 0 ? u.leftToday.replace('{kcal}', String(tips.left)).replace('{p}', String(tips.protein)) : u.overToday.replace('{kcal}', String(-tips.left))}</strong>
      {tips.foods.length > 0 && <><small>{u.nextMealIdeas}</small><ul>{tips.foods.map(f => <li key={f}>{f}</li>)}</ul></>}
      {tips.walk && <p><Footprints size={16}/> {u.walkTip.replace('{min}', String(tips.walk))}</p>}
    </div>}
  </section>;
}
