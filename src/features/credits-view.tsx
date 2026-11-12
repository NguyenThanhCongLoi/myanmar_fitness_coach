'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { trainingApi } from '@/shared/client';
import { useApp } from '@/shared/app-context';
import { useTrainingLanguage } from '@/shared/training-language';
import type { Exercise } from '@/shared/types';

// Licence-required attributions live here, not on every exercise screen.
export function CreditsView() {
  const { go } = useApp(); const tt = useTrainingLanguage();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  useEffect(() => { trainingApi<Exercise[]>('exercises').then(setExercises).catch(() => {}); }, []);
  const media = exercises.filter(e => e.mediaSource && e.videoUrl).map(e => `${e.name}: ${e.mediaSource}`);
  const images = [...new Set(exercises.flatMap(e => (e.steps ?? []).map(s => s.credit).filter((c): c is string => !!c)))];
  const data = [...new Set(exercises.map(e => `${e.attribution} (${e.dataLicense})`))];
  return <section className="credits-page"><button className="text-button back-link" onClick={() => go('profile')}><ArrowLeft size={18}/>{tt.back}</button>
    <div className="page-heading"><h1>{tt.creditsTitle}</h1><p>{tt.creditsBody}</p></div>
    <div className="panel"><h2>Video</h2><ul lang="en">{media.map(m => <li key={m}>{m}</li>)}</ul></div>
    <div className="panel"><h2>Images</h2><ul lang="en">{images.map(m => <li key={m}>{m}</li>)}</ul></div>
    <div className="panel"><h2>Data</h2><ul lang="en">{data.map(m => <li key={m}>{m}</li>)}<li>Muscle map polygons: react-body-highlighter, MIT © 2020 GV79.</li><li>Fonts: Noto Sans Myanmar, SIL Open Font License 1.1.</li></ul></div>
  </section>;
}
