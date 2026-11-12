import assert from 'node:assert/strict';
import test from 'node:test';

import { displayPercents, positionSlices } from './position-chart.ts';

test('splits two holdings into equal parts of the circle', () => {
  const slices = positionSlices([
    { key: 'AAPL', amount: 50 },
    { key: 'KO', amount: 50 },
  ]);

  assert.deepEqual(
    slices.map((slice) => slice.fraction),
    [0.5, 0.5],
  );
  assert.deepEqual(
    slices.map((slice) => slice.start),
    [0, 0.5],
  );
});

test('drops an unpriced holding and keeps a single slice whole', () => {
  const slices = positionSlices([
    { key: 'AAPL', amount: 80 },
    { key: 'KO', amount: 0 },
  ]);

  assert.equal(slices.length, 1);
  assert.equal(slices[0]?.key, 'AAPL');
  assert.equal(slices[0]?.fraction, 1);
  assert.equal(slices[0]?.start, 0);
});

test('rounds slice labels so they add up to 100', () => {
  const thirds = displayPercents([1 / 3, 1 / 3, 1 / 3]);

  assert.equal(thirds.reduce((sum, value) => sum + value, 0), 100);
  assert.deepEqual(thirds, [34, 33, 33]);
  assert.deepEqual(displayPercents([0.5, 0.5]), [50, 50]);
  assert.deepEqual(displayPercents([1]), [100]);
  assert.deepEqual(displayPercents([]), []);
});

test('returns no slices when nothing has a value', () => {
  assert.deepEqual(positionSlices([]), []);
  assert.deepEqual(positionSlices([{ key: 'AAPL', amount: 0 }]), []);
});
