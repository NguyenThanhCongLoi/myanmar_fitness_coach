// Export every user-facing string (UI + exercise content) to CSV for a fluent Myanmar reviewer.
// Columns: area, key, english, myanmar_current, myanmar_reviewed (empty, for the reviewer), notes.
// Usage (prepared env): npx tsx scripts/export-translations.ts > translation-review.csv
import en from '../src/locales/en';
import my from '../src/locales/my-MM';
import ten from '../src/locales/training-en';
import tmy from '../src/locales/training-my';
import gen from '../src/locales/game-en';
import gmy from '../src/locales/game-my';
import catalog from '../prisma/exercise-catalog.json';
import stepsEn from '../prisma/exercise-steps.json';
import stepsMy from '../prisma/exercise-steps-my.json';
import guideEn from '../prisma/exercise-guidance.json';
import guideMy from '../prisma/exercise-guidance-my.json';
import mistakesMy from '../prisma/exercise-mistakes-my.json';

type Row = [string, string, string, string, string];
const rows: Row[] = [];
function flat(area: string, a: unknown, b: unknown, path = '') {
  if (typeof a === 'string') { rows.push([area, path, a, typeof b === 'string' ? b : '', '']); return; }
  if (Array.isArray(a)) { a.forEach((x, i) => flat(area, x, Array.isArray(b) ? b[i] : undefined, `${path}[${i}]`)); return; }
  if (a && typeof a === 'object') for (const [k, v] of Object.entries(a)) flat(area, v, b && typeof b === 'object' ? (b as Record<string, unknown>)[k] : undefined, path ? `${path}.${k}` : k);
}
flat('ui-core', en, my); flat('ui-training', ten, tmy); flat('ui-motivation', gen, gmy);
const sm = stepsMy as Record<string, { name: string; steps: string[] }>, gm = guideMy as Record<string, { home: string[]; gym: string[] }>, mm = mistakesMy as Record<string, { mistakes: string[] }>;
for (const e of catalog as { id: string; name: string; commonMistakes: string[] }[]) {
  rows.push(['exercise-name', e.id, e.name, sm[e.id]?.name ?? '', 'Keep the English exercise name; add the Burmese after the dash']);
  ((stepsEn as Record<string, string[]>)[e.id] ?? []).forEach((s, i) => rows.push(['exercise-step', `${e.id}.step${i + 1}`, s, sm[e.id]?.steps[i] ?? '', 'Read aloud by the voice coach']));
  const g = (guideEn as Record<string, { home: string[]; gym: string[] }>)[e.id];
  g?.home.forEach((s, i) => rows.push(['exercise-home', `${e.id}.home${i + 1}`, s, gm[e.id]?.home[i] ?? '', '']));
  g?.gym.forEach((s, i) => rows.push(['exercise-gym', `${e.id}.gym${i + 1}`, s, gm[e.id]?.gym[i] ?? '', 'Machine setup / posture']));
  e.commonMistakes.forEach((s, i) => rows.push(['exercise-mistake', `${e.id}.mistake${i + 1}`, s, mm[e.id]?.mistakes[i] ?? '', '']));
}
const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
process.stdout.write('﻿' + ['area,key,english,myanmar_current,myanmar_reviewed,notes', ...rows.map(r => [r[0], r[1], r[2], r[3], '', r[4]].map(esc).join(','))].join('\r\n') + '\r\n');
