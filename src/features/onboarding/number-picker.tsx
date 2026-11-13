'use client';
import { useEffect, useRef } from 'react';

/** Native scroll snapping works with touch, trackpad and keyboard without opening a keyboard. */
export function NumberPicker({ label, value, min, max, step = 1, unit, vertical = false, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  vertical?: boolean; onChange: (value: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null), interacting = useRef(false);
  const size = vertical ? 64 : 16;
  const count = Math.round((max - min) / step) + 1;
  const values = Array.from({ length: count }, (_, i) => Number((min + i * step).toFixed(1)));
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    const position = Math.round((value - min) / step) * size;
    if (!interacting.current) node.scrollTo(vertical ? { top: position } : { left: position });
  }, [value, min, step, size, vertical]);
  function move(next: number) {
    const clamped = Math.max(min, Math.min(max, Number(next.toFixed(1))));
    interacting.current = false; onChange(clamped);
    track.current?.scrollTo(vertical ? { top: (clamped - min) / step * size } : { left: (clamped - min) / step * size });
  }
  return <div className={`number-picker ${vertical ? 'vertical' : 'ruler'}`}>
    {!vertical && <div className="picker-value"><output>{value}</output><span>{unit}</span></div>}
    <div className="picker-window">
      <div ref={track} className="picker-track" role="slider" tabIndex={0} aria-label={label}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value}${unit ? ` ${unit}` : ''}`}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        onPointerDown={() => { interacting.current = true; }} onTouchStart={() => { interacting.current = true; }}
        onWheel={() => { interacting.current = true; }}
        onKeyDown={e => {
          const delta = ['ArrowRight', 'ArrowDown'].includes(e.key) ? step : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -step : 0;
          if (delta || ['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
            e.preventDefault(); move(e.key === 'Home' ? min : e.key === 'End' ? max : value + (e.key === 'PageUp' ? -10 * step : e.key === 'PageDown' ? 10 * step : delta));
          }
        }}
        onScroll={e => {
          if (!interacting.current) return;
          const node = e.currentTarget;
          const index = Math.max(0, Math.min(count - 1, Math.round((vertical ? node.scrollTop : node.scrollLeft) / size)));
          onChange(values[index]);
        }}>
        {values.map((v, i) => <div key={v} className={`picker-mark ${v === value ? 'selected' : ''} ${i % 10 === 0 ? 'major' : i % 5 === 0 ? 'mid' : ''}`} onClick={() => move(v)} aria-hidden="true">
          {vertical ? v : <><i/>{i % 10 === 0 && <span>{v}</span>}</>}
        </div>)}
      </div>
      <div className="picker-indicator" aria-hidden="true"/>
    </div>
    {vertical && <output className="sr-only">{value}</output>}
  </div>;
}
