'use client';
import { useTrainingLanguage } from '@/shared/training-language';
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
// Plates per side for a 20 kg Olympic bar (kg). Returns null if the target cannot be loaded exactly.
export function platesPerSide(targetKg: number, bar = 20) {
  let rest = Math.round(((targetKg - bar) / 2) * 100) / 100; if (rest < 0) return null;
  const out: number[] = [];
  for (const p of PLATES) while (rest >= p - 1e-9) { out.push(p); rest = Math.round((rest - p) * 100) / 100; }
  return rest === 0 ? out : null;
}
// Ramp-up sets before a working weight: 50% x 8, 70% x 5, 85% x 3 (rounded to the equipment step).
export function warmupSets(targetKg: number, step: number) {
  const r = (v: number) => Math.max(step || 1, Math.round(v / (step || 1)) * (step || 1));
  return targetKg < 20 ? [] : [[r(targetKg * 0.5), 8], [r(targetKg * 0.7), 5], [r(targetKg * 0.85), 3]];
}
export function WarmupPlates({ targetKg, equipment }: { targetKg: number; equipment: string[] }) {
  const tt = useTrainingLanguage();
  const barbell = equipment.includes('barbell');
  const step = barbell ? 2.5 : equipment.includes('dumbbell') ? 2 : 2.5;
  const warm = warmupSets(targetKg, step), plates = barbell ? platesPerSide(targetKg) : null;
  if (!warm.length && !plates) return null;
  return <details className="warmup-plates"><summary>{tt.warmupTitle}</summary>
    {warm.length > 0 && <p>{tt.warmupSets}: {warm.map(([w, r]) => `${w} kg × ${r}`).join(' · ')}</p>}
    {plates && <p>{tt.platesPerSide}: {plates.length ? plates.join(' + ') + ' kg' : tt.emptyBar}</p>}
  </details>;
}
