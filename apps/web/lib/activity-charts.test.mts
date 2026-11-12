import assert from 'node:assert/strict';
import test from 'node:test';

import { barFraction, scoreLine } from './activity-charts.ts';

const box = { left: 0, right: 100, top: 0, bottom: 100 };

test('draws a higher score above a lower score and keeps zero in range', () => {
  const line = scoreLine([{ points: -10 }, { points: 10 }], box);

  assert.equal(line.points[0]?.y, 100);
  assert.equal(line.points[1]?.y, 0);
  assert.equal(line.zeroY, 50);
  assert.equal(line.points[0]?.x, 0);
  assert.equal(line.points[1]?.x, 100);
});

test('centers a single score', () => {
  const line = scoreLine([{ points: 20 }], box);

  assert.equal(line.points[0]?.x, 50);
  assert.equal(line.points[0]?.y, 0);
  assert.equal(line.zeroY, null);
});

test('scales a missed bar against the larger month', () => {
  assert.equal(barFraction(50, 100), 0.5);
  assert.equal(barFraction(0, 100), 0);
});
