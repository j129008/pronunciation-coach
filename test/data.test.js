import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validItems, loadData } from '../js/data.js';

// synthetic data only — never read the private data/items.json here
const sample = [
  { e: 'Hello there.', z: '你好', l: 'L002 (2026/01/01)' },
  { e: 'Umbrella', t: 'vocab', l: 'L001' },
  { e: 'Misc' },
];

test('validItems fills defaults and sequential ids', () => {
  const v = validItems(sample);
  assert.deepEqual(v.map(d => d.i), [1, 2, 3]);
  assert.equal(v[0].t, 'sentence');
  assert.equal(v[0].x, '');
});

test('validItems accepts {items:[...]} and rejects bad input', () => {
  assert.equal(validItems({ items: sample }).length, 3);
  assert.throws(() => validItems([]), /陣列/);
  assert.throws(() => validItems('x'), /陣列/);
  assert.throws(() => validItems([{ e: 'ok' }, { z: 'no english' }]), /第 2 筆/);
});

test('validItems makes ids unique numbers', () => {
  const v = validItems([{ e: 'a', i: '7' }, { e: 'b', i: 7 }, { e: 'c', i: 'x' }]);
  assert.deepEqual(v.map(d => d.i), [7, 8, 9]);
});

const res = (ok, body) => async () => ({ ok, json: async () => body });
const memStore = (v) => ({ saved: null, get: async () => v, set: async function (k, x) { this.saved = x; } });

test('loadData prefers data/items.json', async () => {
  const items = await loadData({ fetchFn: res(true, sample), store: memStore([{ e: 'db' }]) });
  assert.equal(items.length, 3);
});

test('loadData falls back to stored items when fetch fails or 404s', async () => {
  const stored = [{ e: 'db', i: 1 }];
  assert.deepEqual(await loadData({ fetchFn: res(false), store: memStore(stored) }), stored);
  const boom = async () => { throw new Error('offline'); };
  assert.deepEqual(await loadData({ fetchFn: boom, store: memStore(stored) }), stored);
});

test('loadData falls back to the picker and saves only when asked', async () => {
  const store = memStore(undefined);
  const items = [{ e: 'picked', i: 1 }];
  assert.deepEqual(await loadData({ fetchFn: res(false), store, pick: async () => ({ items, save: true }) }), items);
  assert.equal(store.saved, items);
  const store2 = memStore(undefined);
  await loadData({ fetchFn: res(false), store: store2, pick: async () => ({ items, save: false }) });
  assert.equal(store2.saved, null);
});

test('invalid items.json is ignored (falls through to next source)', async () => {
  const items = await loadData({ fetchFn: res(true, [{ nope: 1 }]), store: memStore([{ e: 'db', i: 1 }]) });
  assert.equal(items[0].e, 'db');
});
