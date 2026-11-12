import { expect, test } from 'vitest';
import { platesPerSide, warmupSets } from '../src/features/training/warmup-plates';
test('plate calculator and warm-up ramp', () => {
  expect(platesPerSide(60)).toEqual([20]); expect(platesPerSide(72.5)).toEqual([25, 1.25]); expect(platesPerSide(20)).toEqual([]); expect(platesPerSide(15)).toBeNull();
  expect(warmupSets(60, 2.5)).toEqual([[30, 8], [42.5, 5], [50, 3]]); expect(warmupSets(10, 2)).toEqual([]);
});
