'use client';
import { anteriorData, posteriorData } from './anatomy-regions';
import { useTrainingLanguage } from '@/shared/training-language';

// One reusable anatomical SVG for every exercise: regions are keyed by canonical muscle IDs,
// never generated per exercise. Primary = red, secondary = orange, others neutral gray.
const PRIMARY = '#dc2626', SECONDARY = '#f97316';
export const MAPPED_MUSCLES = new Set([...anteriorData, ...posteriorData].map(r => r.muscle));
type Props = { primary: string[]; secondary: string[]; compact?: boolean; label?: string; legend?: [string, string] };
function Figure({ data, primary, secondary, title }: { data: typeof anteriorData; primary: Set<string>; secondary: Set<string>; title: string }) {
  return <figure className="muscle-figure"><svg viewBox="0 0 1000 2200" role="img" aria-label={title}>
    {data.map(region => region.svgPoints.map((points, i) => {
      const fill = primary.has(region.muscle) ? PRIMARY : secondary.has(region.muscle) ? SECONDARY : 'var(--muscle-neutral, #c4cbd1)';
      return <polygon key={`${region.muscle}-${i}`} points={points} fill={fill} data-muscle={region.muscle} data-role={primary.has(region.muscle) ? 'primary' : secondary.has(region.muscle) ? 'secondary' : 'none'} stroke="var(--muscle-stroke, #fff)" strokeWidth="4"/>;
    }))}
  </svg><figcaption>{title}</figcaption></figure>;
}
export function MuscleMap({ primary, secondary, compact = false, label, legend }: Props) {
  const tt = useTrainingLanguage();
  const p = new Set(primary.filter(m => MAPPED_MUSCLES.has(m)));
  const s = new Set(secondary.filter(m => MAPPED_MUSCLES.has(m) && !p.has(m)));
  return <div className={`muscle-map ${compact ? 'compact' : ''}`} aria-label={label}>
    <div className="muscle-figures">
      <Figure data={anteriorData} primary={p} secondary={s} title={tt.front}/>
      <Figure data={posteriorData} primary={p} secondary={s} title={tt.backView}/>
    </div>
    {!compact && <div className="muscle-legend">
      <span><i style={{ background: PRIMARY }}/>{legend?.[0] ?? tt.primary}</span><span><i style={{ background: SECONDARY }}/>{legend?.[1] ?? tt.secondary}</span>
    </div>}
  </div>;
}
export function muscleName(id: string, names: Record<string, string>) { return names[id] ?? id; }
