'use client';
import { useEffect, useRef, useState } from 'react';
import {playbackSource,prefersLightVideo} from '@/shared/video-source';
import { VideoOff } from 'lucide-react';
import type { Exercise } from '@/shared/types';
import { useTrainingLanguage } from '@/shared/training-language';

// Only licence-verified registry media is ever played. Otherwise a neutral placeholder is shown,
// never an unrelated exercise image. Demonstrations loop and do not define workout length.
export function hasApprovedVideo(exercise: Pick<Exercise, 'videoUrl' | 'mediaLicenseStatus'>) {
  return Boolean(exercise.videoUrl && exercise.mediaLicenseStatus === 'verified');
}
export function ExerciseMedia({ exercise, autoPlay = false, compact = false }: { exercise: Exercise; autoPlay?: boolean; compact?: boolean }) {
  const tt = useTrainingLanguage();
  const [lightVideo]=useState(prefersLightVideo);
  const [failed, setFailed] = useState(false); const video = useRef<HTMLVideoElement>(null);
  // React does not reflect `muted` as an attribute on first render, which blocks autoplay; set it explicitly.
  // Low-data mode: no autoplay or preloading; the user taps play.
  const [lowData, setLowData] = useState(false);
  useEffect(() => { try { setLowData(localStorage.getItem('mingalar-lowdata') === 'on'); } catch { /* optional */ } }, []);
  useEffect(() => { const v = video.current; if (!v) return; v.muted = true; if (autoPlay && !lowData) void v.play().catch(() => {}); else v.pause(); }, [autoPlay, exercise.videoUrl, lowData]);
  if (hasApprovedVideo(exercise) && !failed) {
    return <div className={`exercise-media ${compact ? 'compact' : ''}`}>
      <video ref={video} src={playbackSource(exercise.videoUrl,lightVideo)!} poster={exercise.thumbnailUrl ?? undefined} muted loop playsInline autoPlay={autoPlay} controls={!compact} preload={lowData ? 'none' : autoPlay ? 'auto' : 'metadata'} onError={() => setFailed(true)}/>
      {!compact && exercise.mediaStatus === 'demo_unreviewed' && <span className="demo-badge">{tt.demoUnreviewed}</span>}
    </div>;
  }
  return <div className={`exercise-media placeholder ${compact ? 'compact' : ''}`} role="img" aria-label={tt.noVideo}>
    <VideoOff size={compact ? 22 : 32}/>
    <strong>{tt.noVideo}</strong>
    {!compact && <small>{tt.noVideoHint}</small>}
  </div>;
}
