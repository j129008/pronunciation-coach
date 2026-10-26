import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USER_ID_BASE, makeUserItems, nextUserId, mergeUserItems, lessonsOf, deleteLesson, exportUserItems, defaultLabel, userLabel } from '../js/lessons.js';
import { loadUserItems, saveUserItems } from '../js/data.js';

const base = [{ i: 1, e: 'Base one.', t: 'sentence', l: 'L001', z: '', x: '', p: '' }, { i: 2, e: 'Base two.', t: 'sentence', l: 'L002', z: '', x: '', p: '' }];
const T0 = Date.UTC(2026, 9, 28);

test('makeUserItems: sentence items, unique ids far from the data file ids, label kept', () => {
  const a = makeUserItems(['Hello there.', '  ', 'How are you?'], 'L045 2026/10/28 Job interview', [], T0);
  assert.equal(a.length, 2);
  assert.deepEqual(a.map(d => d.i), [USER_ID_BASE + 1, USER_ID_BASE + 2]);
  assert.ok(a.every(d => d.t === 'sentence' && d.u === 1 && d.l === 'L045 2026/10/28 Job interview' && d.added === T0));
  const b = makeUserItems(['Another one.'], 'Lesson B', a, T0 + 1);
  assert.equal(b[0].i, USER_ID_BASE + 3);
  assert.equal(nextUserId([...a, ...b]), USER_ID_BASE + 4);
  assert.match(makeUserItems(['x'], '', [], T0)[0].l, /^加入 2026\/10\/\d\d$/);
  assert.equal(userLabel(a[1]), '#U2');
  assert.match(defaultLabel(new Date(2026, 0, 5)), /2026\/01\/05/);
});

test('mergeUserItems appends on top of the data file without overwriting anything', () => {
  const user = makeUserItems(['A.', 'B.'], 'Mine', [], T0);
  const merged = mergeUserItems(base, user);
  assert.equal(merged.length, 4);
  assert.deepEqual(merged.slice(0, 2), base);
  assert.ok(merged.slice(2).every(d => d.u === 1));
  // even if a (new) data file contains the same ids, base wins and the user item gets a fresh id
  const clash = mergeUserItems([...base, { i: USER_ID_BASE + 1, e: 'Big id' }], user);
  assert.equal(clash.filter(d => d.i === USER_ID_BASE + 1).length, 1);
  assert.equal(clash.find(d => d.i === USER_ID_BASE + 1).e, 'Big id');
  assert.equal(new Set(clash.map(d => d.i)).size, clash.length);
  assert.equal(base.length, 2); // input untouched
});

test('lessonsOf / deleteLesson / export', () => {
  const a = makeUserItems(['1.', '2.'], 'A', [], T0), b = makeUserItems(['3.'], 'B', a, T0 + 1);
  const all = [...a, ...b];
  assert.deepEqual(lessonsOf([...base, ...all]).map(l => [l.label, l.count]), [['B', 1], ['A', 2]]);
  const r = deleteLesson(all, 'A');
  assert.deepEqual(r.removedIds, a.map(d => d.i));
  assert.deepEqual(r.user, b);
  assert.deepEqual(deleteLesson(all, 'nope').user, all);
  const ex = exportUserItems(all);
  assert.deepEqual(Object.keys(ex[0]).sort(), ['added', 'e', 'i', 'l', 'p', 't', 'x', 'z']);
  assert.ok(!('u' in ex[0]));
});

test('user items persist in their own store key (survive reload) and bad data is ignored', async () => {
  const mem = new Map();
  const store = { get: async k => mem.get(k), set: async (k, v) => { mem.set(k, v); } };
  assert.deepEqual(await loadUserItems(store), []);
  const user = makeUserItems(['Saved.'], 'Persisted', [], T0);
  await saveUserItems(user, store);
  assert.deepEqual(await loadUserItems(store), user);
  mem.set('userItems', [{ e: 'no u flag' }, null, ...user]);
  assert.deepEqual(await loadUserItems(store), user);
  assert.equal(mem.has('items'), false); // the data set key is never touched
  assert.deepEqual(await loadUserItems({ get: async () => { throw new Error('idb down'); } }), []);
});

test('file 課前練習 items are not deletable/exportable through the user-lesson store', () => {
  const items = [{ i: 3, e: 'Pre new a.', t: 'sentence', l: '課前練習 2026/10/28 New topic' }, { i: 4, e: 'Pre new b.', t: 'sentence', l: '課前練習 2026/10/28 New topic' }];
  assert.deepEqual(lessonsOf(items), []);                    // no lesson-filter entry / delete button source
  const user = makeUserItems(['Mine.'], '課前練習 2026/10/30 mine', [], T0);
  assert.deepEqual(lessonsOf([...items, ...user]).map(l => l.label), ['課前練習 2026/10/30 mine']);
  const r = deleteLesson(user, '課前練習 2026/10/28 New topic'); // a file label cannot remove anything
  assert.deepEqual(r.removedIds, []);
  assert.deepEqual(r.user, user);
  assert.ok(exportUserItems(user).every(d => !('pre' in d) && !('u' in d)));
});

