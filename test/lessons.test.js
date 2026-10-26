import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USER_ID_BASE, makeUserItems, nextUserId, mergeUserItems, lessonsOf, deleteLesson, exportUserItems, defaultLabel, userLabel } from '../js/lessons.js';
import { prepareItems, loadUserItems, saveUserItems } from '../js/data.js';
import { smartPickPinned } from '../js/progress.js';

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

test('prepareItems: user lessons first, newest lesson pinned, data-file order unchanged', () => {
  const l1 = makeUserItems(['Old a.', 'Old b.'], 'Old lesson', [], T0);
  const l2 = makeUserItems(['New a.'], 'New lesson', l1, T0 + 5000);
  const { ORDERED, pinned } = prepareItems(mergeUserItems(base, [...l1, ...l2]));
  assert.equal(pinned, 'New lesson');
  assert.deepEqual(ORDERED.map(d => d.e), ['New a.', 'Old a.', 'Old b.', 'Base one.', 'Base two.']);
  assert.equal(prepareItems(base.map(d => ({ ...d }))).pinned, null);
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

test('smartPickPinned prefers the pinned lesson, falls back when it has nothing left to practise', () => {
  const user = makeUserItems(['P one.', 'P two.'], 'Pre-class', [], T0);
  const { ORDERED, pinned } = prepareItems(mergeUserItems(base, user));
  const now = T0 + 1e6;
  const r = smartPickPinned(ORDERED, pinned, now, null, {});
  assert.ok(r.d.u);
  assert.match(r.why, /^📝 課前練習/);
  // everything pinned is already well practised (<10 min ago ⇒ skipped, status good) → normal pick from the whole pool
  const prog = Object.fromEntries(user.map(d => [d.i, { a: 2, b: 95, l: 95, d: now - 1000, h: [95] }]));
  const r2 = smartPickPinned(ORDERED, pinned, now, null, prog);
  assert.ok(!r2.d.u);
  assert.ok(!/課前練習/.test(r2.why));
  assert.equal(smartPickPinned(ORDERED, null, now, null, {}).d.i > 0, true);
});

// ---- 課前練習 lessons that come from the data file (synthetic) ----
import { labelDate, isPreClassLabel } from '../js/data.js';

const fileItems = () => [
  { i: 1, e: 'Regular one.', t: 'sentence', l: 'L001 (2026/01/01)', z: '', x: '', p: '' },
  { i: 2, e: 'Pre old a.', t: 'sentence', l: '課前練習 2026/10/21 Old topic', z: '', x: '', p: '' },
  { i: 3, e: 'Pre new a.', t: 'sentence', l: '課前練習 2026/10/28 New topic', z: '', x: '', p: '' },
  { i: 4, e: 'Pre new b.', t: 'sentence', l: '課前練習 2026/10/28 New topic', z: '', x: '', p: '' },
  { i: 5, e: 'Pre undated.', t: 'sentence', l: '課前練習 misc', z: '', x: '', p: '' },
  { i: 6, e: 'Regular two.', t: 'sentence', l: 'L002', z: '', x: '', p: '' },
];

test('labelDate parses YYYY/MM/DD (and - or .), 0 when absent', () => {
  assert.equal(labelDate('課前練習 2026/10/28 x'), Date.UTC(2026, 9, 28));
  assert.equal(labelDate('a 2026-1-5 b'), Date.UTC(2026, 0, 5));
  assert.equal(labelDate('2026.03.09'), Date.UTC(2026, 2, 9));
  assert.equal(labelDate('no date'), 0);
  assert.ok(isPreClassLabel('課前練習 x') && !isPreClassLabel('L001 課前練習') && !isPreClassLabel(undefined));
});

test('file lessons labelled 課前練習 are pinned on top, newest date first, flagged pre (not u)', () => {
  const { ORDERED, pinned, pinnedLabels } = prepareItems(fileItems());
  assert.deepEqual(ORDERED.map(d => d.e), ['Pre new a.', 'Pre new b.', 'Pre old a.', 'Pre undated.', 'Regular one.', 'Regular two.']);
  assert.equal(pinned, '課前練習 2026/10/28 New topic');
  assert.deepEqual(pinnedLabels, ['課前練習 2026/10/28 New topic', '課前練習 2026/10/21 Old topic', '課前練習 misc']);
  assert.ok(ORDERED.slice(0, 4).every(d => d.pre === true && !d.u));
  assert.ok(ORDERED.slice(4).every(d => !d.pre));
  assert.equal(ORDERED[0].L, '課前練習 2026/10/28 New topic'); // grouped by the full label
});

test('user-added lessons stay above file 課前練習 lessons', () => {
  const user = makeUserItems(['Mine.'], 'My lesson', [], T0);
  const { ORDERED, pinned, pinnedLabels } = prepareItems(mergeUserItems(fileItems(), user));
  assert.equal(ORDERED[0].e, 'Mine.');
  assert.equal(pinned, 'My lesson');
  assert.equal(pinnedLabels.length, 4);
});

test('file 課前練習 items are not deletable/exportable through the user-lesson store', () => {
  const items = fileItems();
  prepareItems(items);
  assert.deepEqual(lessonsOf(items), []);                    // no lesson-filter entry / delete button source
  const user = makeUserItems(['Mine.'], '課前練習 2026/10/30 mine', [], T0);
  assert.deepEqual(lessonsOf([...items, ...user]).map(l => l.label), ['課前練習 2026/10/30 mine']);
  const r = deleteLesson(user, '課前練習 2026/10/28 New topic'); // a file label cannot remove anything
  assert.deepEqual(r.removedIds, []);
  assert.deepEqual(r.user, user);
  assert.ok(exportUserItems(user).every(d => !('pre' in d) && !('u' in d)));
});

test('the next-item picker prioritises file 課前練習 lessons (newest first), then falls back', () => {
  const { ORDERED, pinnedLabels } = prepareItems(fileItems());
  const now = T0 + 1e6;
  const r = smartPickPinned(ORDERED, pinnedLabels, now, null, {});
  assert.equal(r.d.e, 'Pre new a.');
  assert.match(r.why, /^📝 課前練習/);
  // all pinned items practised recently and well → normal pick (a regular item)
  const prog = Object.fromEntries(ORDERED.filter(d => d.pre).map(d => [d.i, { a: 2, b: 95, l: 95, d: now - 1000, h: [95] }]));
  const r2 = smartPickPinned(ORDERED, pinnedLabels, now, null, prog);
  assert.ok(!r2.d.pre);
  // a single label string still works (user-lesson callers)
  assert.equal(smartPickPinned(ORDERED, '課前練習 2026/10/21 Old topic', now, null, {}).d.e, 'Pre old a.');
});
