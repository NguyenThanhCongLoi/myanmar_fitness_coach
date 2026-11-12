import { expect, test } from 'vitest';
import { burmeseNumberWords, speakableBurmese } from '../src/server/tts';
test('numbers are spoken as Burmese words (measured: digits were not recognised as Burmese speech)', () => {
  expect(burmeseNumberWords(3)).toBe('သုံး'); expect(burmeseNumberWords(10)).toBe('ဆယ်'); expect(burmeseNumberWords(12)).toBe('ဆယ့်နှစ်');
  expect(burmeseNumberWords(20)).toBe('နှစ်ဆယ်'); expect(burmeseNumberWords(45)).toBe('လေးဆယ့်ငါး'); expect(burmeseNumberWords(60)).toBe('ခြောက်ဆယ်');
  expect(burmeseNumberWords(120)).toBe('တစ်ရာ့နှစ်ဆယ်');
  expect(speakableBurmese('၃ အကျော့၊ ၈–၁၂ ကြိမ်')).toBe('သုံး အကျော့၊ ရှစ် မှ ဆယ့်နှစ် ကြိမ်');
});
