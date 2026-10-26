import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusOf } from '../js/progress.js';
import { DAY } from '../js/util.js';

const now = Date.UTC(2026, 0, 10);
const prog = {
  1: { a: 2, b: 90, l: 90, d: now - 1000, h: [90] },        // good
  2: { a: 1, b: 88, l: 88, d: now - 5 * DAY, h: [88] },     // due
  3: { a: 3, b: 60, l: 50, d: now - 3600e3, h: [50] },      // weak
  4: { a: 1, b: 75, l: 75, d: now - 3600e3, h: [75] },      // fair
};

test('statusOf thresholds', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(i => statusOf(i, now, prog)), ['good', 'due', 'weak', 'fair', 'new']);
});
