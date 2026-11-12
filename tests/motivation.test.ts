import { expect, test } from 'vitest';
import { cleanMotivation } from '../src/server/coach-extras';
test('daily motivation line: language, length, Zawgyi and link checks', () => {
  expect(cleanMotivation('  "You showed up — that is the win today."  ', 'en')).toBe('You showed up — that is the win today.');
  expect(cleanMotivation('ဒီနေ့လည်း ခြေလှမ်းသေးသေးလေး လှမ်းကြရအောင်။', 'my-MM')).toBe('ဒီနေ့လည်း ခြေလှမ်းသေးသေးလေး လှမ်းကြရအောင်။');
  expect(cleanMotivation('Keep going!', 'my-MM')).toBeNull();
  expect(cleanMotivation('ဒီနေ့ ကောင်းတယ်', 'en')).toBeNull();
  expect(cleanMotivation('\u1031\u1000\u102c\u1004\u1039\u1038', 'my-MM')).toBeNull();
  expect(cleanMotivation('Visit https://x.example now', 'en')).toBeNull();
  expect(cleanMotivation('x'.repeat(200), 'en')).toBeNull();
  expect(cleanMotivation(42, 'en')).toBeNull();
  // Valid Unicode with vowel sign E between consonants must pass (no false Zawgyi positives).
  expect(cleanMotivation('မေမေ နဲ့ သေသေချာချာ လေ့ကျင့်ပါ။', 'my-MM')).not.toBeNull();
});
