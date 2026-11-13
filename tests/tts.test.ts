import { afterAll, expect, test } from 'vitest';
import { prisma } from '../src/shared/lib/prisma';
import { coachScript, exerciseSpeech, ttsConfigured } from '../src/server/tts';
afterAll(async () => { await prisma.$disconnect(); });
test('coach script uses stored Myanmar steps with Burmese step numbers and a safety close', () => {
  const steps = [{ en: 'Stand tall.', my: 'မတ်မတ် ရပ်ပါ။' }, { en: 'Squat down.', my: 'ထိုင်ချပါ။' }];
  const all = coachScript('Squat', steps);
  expect(all).toContain('အဆင့် ၁။ မတ်မတ် ရပ်ပါ။'); expect(all).toContain('အဆင့် ၂။'); expect(all).toContain('နာကျင်မှု');
  expect(coachScript('Squat', steps, 2)).toBe('အဆင့် ၂။ ထိုင်ချပါ။');
  expect(coachScript('Squat', [{ en: 'x', my: null }])).toBe('');
});
test('every curated exercise has steps; seeded Myanmar steps are Unicode, step images exist for illustrated ones', async () => {
  const ids = Object.keys((await import('../prisma/exercise-steps.json')).default);
  const rows = await prisma.exercise.findMany({ where: { id: { in: ids } } });
  expect(rows.length).toBeGreaterThanOrEqual(30);
  for (const e of rows) {
    const steps = e.steps as { en: string; my: string | null; image: string | null }[];
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const s of steps) { expect(s.my).toMatch(/[က-႟]/); expect(s.my).toBe(s.my!.normalize('NFC')); }
    const g = e.guidance as { gym: { en: string; my: string | null }[] };
    expect(g.gym.length).toBeGreaterThan(0); expect(g.gym.every(c => c.my && /[က-႟]/.test(c.my))).toBe(true);
  }
  const pushUp = rows.find(e => e.canonicalId === 'push-up')!;
  expect(pushUp.videoUrl).toBe('/media/video/dataset-0662-owner.mp4'); expect(pushUp.mediaStatus).toBe('demo_unreviewed');
  expect((pushUp.steps as { image: string | null }[]).filter(s => s.image).length).toBe(2);
});
test('voice is server-only and fails honestly when not configured', async () => {
  if (ttsConfigured()) return;
  await expect(exerciseSpeech('nobody', 'dataset-0662')).rejects.toMatchObject({ code: 'VOICE_NOT_CONFIGURED' });
});
