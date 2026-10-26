import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, lessonSession, summarize, weakScore } from '../js/session.js';
import { buildCatalog } from '../js/library.js';
import { statusOf, srDays, overdueMs, lastDays } from '../js/progress.js';
import { parseRoute, routeHash, tabOf } from '../js/router.js';
import { DAY } from '../js/util.js';

const NOW = Date.UTC(2026, 9, 27, 12);
const it = (i, l, e, t = 'sentence') => ({ i, e, z: '', t, l });
// 30 synthetic items over lessons L160..L166, L166 has pre/post-class items
function world() {
  const items = [];
  let id = 1;
  for (const [l, n] of [['L160 (2026/10/20)', 6], ['L161 (2026/10/21)', 6], ['L162 (2026/10/22)', 6], ['課前練習 L166 (2026/10/26) Company structure', 6], ['課後複習 L165 (2026/10/25)', 6]]) {
    for (let k = 0; k < n; k++) items.push(it(id++, l, `Sentence number ${id - 1} about work.`));
  }
  const catalog = buildCatalog(items);
  return { items, catalog };
}
const mk = (items, prog) => ({ prog, statusFn: id => statusOf(id, NOW, prog) });

test('spaced repetition intervals grow with consecutive good takes', () => {
  assert.equal(srDays({ l: 90, h: [90] }), 3);
  assert.equal(srDays({ l: 90, h: [70, 90, 90] }), 7);
  assert.equal(srDays({ l: 90, h: [90, 90, 90] }), 14);
  assert.equal(srDays({ l: 90, h: [90, 90, 90, 90, 90] }), 30);
  assert.equal(srDays({ l: 90, h: [90, 90, 60, 90] }), 3);
  const p = { a: 3, b: 95, l: 95, d: NOW - 5 * DAY, h: [90, 92, 95] };   // interval 14 days
  assert.equal(statusOf(1, NOW, { 1: p }), 'good');
  assert.ok(overdueMs(p, NOW) < 0);
  assert.equal(statusOf(1, NOW, { 1: { ...p, d: NOW - 15 * DAY } }), 'due');
  assert.equal(statusOf(1, NOW, { 1: { a: 1, l: 88, d: NOW - 4 * DAY, h: [88] } }), 'due');
});

test('buildSession: 15 unique items mixing review, the latest 課前/課後 lesson and weak words', () => {
  const { items, catalog } = world();
  const prog = {
    1: { a: 1, b: 90, l: 90, d: NOW - 9 * DAY, h: [90] },      // due
    2: { a: 1, b: 88, l: 88, d: NOW - 20 * DAY, h: [88] },     // due (older → first)
    7: { a: 2, b: 60, l: 50, d: NOW - 2 * DAY, h: [60, 50] },  // weak
    8: { a: 1, b: 90, l: 90, d: NOW - 1000, h: [90] },         // good, just practised
  };
  const weak = { number: { bad: 5, ok: 1 }, work: { bad: 0, ok: 9 } };
  const s = buildSession(items, { catalog, ...mk(items, prog), weak, now: NOW });
  assert.equal(s.ids.length, 15);
  assert.equal(new Set(s.ids).size, 15);
  assert.equal(s.lesson.key, 'L166');
  const why = id => s.why[id];
  assert.equal(why(2), 'due'); assert.equal(why(1), 'due'); assert.equal(why(7), 'weak');
  assert.ok(s.ids.indexOf(2) !== -1 && s.ids.indexOf(2) < s.ids.indexOf(1));   // most overdue review first
  assert.ok(!s.ids.includes(8));                                  // practised seconds ago → skipped
  const l166 = items.filter(d => d.l.startsWith('課前練習')).map(d => d.i);
  assert.ok(s.ids.filter(id => l166.includes(id)).length >= 5);    // the pre-class lesson is well represented
  assert.ok(s.parts.sound >= 1 && Object.values(s.why).includes('sound'));
  assert.deepEqual(Object.values(s.parts).reduce((a, b) => a + b, 0), 15);
});

test('buildSession: first item comes from the lesson; interleaves sources', () => {
  const { items, catalog } = world();
  const prog = { 1: { a: 1, b: 90, l: 90, d: NOW - 9 * DAY, h: [90] }, 2: { a: 1, b: 90, l: 90, d: NOW - 9 * DAY, h: [90] } };
  const s = buildSession(items, { catalog, ...mk(items, prog), weak: {}, now: NOW });
  assert.equal(s.why[s.ids[0]], 'lesson');
  assert.equal(s.why[s.ids[1]], 'due');
});

test('buildSession: honours size, falls back gracefully on tiny / fully practised data', () => {
  const { items, catalog } = world();
  assert.equal(buildSession(items, { catalog, ...mk(items, {}), weak: {}, now: NOW, size: 10 }).ids.length, 10);
  const few = items.slice(0, 4);
  const s = buildSession(few, { catalog: buildCatalog(few), ...mk(few, {}), weak: {}, now: NOW });
  assert.equal(s.ids.length, 4);
  const all = Object.fromEntries(items.map(d => [d.i, { a: 3, b: 95, l: 95, d: NOW - 1000, h: [95, 95, 95] }]));
  assert.deepEqual(buildSession(items, { catalog, ...mk(items, all), weak: {}, now: NOW }).ids, []);
  assert.deepEqual(buildSession([], { catalog: buildCatalog([]), prog: {}, statusFn: () => 'new', weak: {}, now: NOW }).ids, []);
});

test('lessonSession: unfinished first, new before weak before fair; limited to size', () => {
  const { items, catalog } = world();
  const l = catalog.byKey.get('L160');
  const st = { 1: 'good', 2: 'weak', 3: 'new', 4: 'fair', 5: 'due', 6: 'new' };
  const s = lessonSession(l, items, id => st[id], 4);
  assert.deepEqual(s.ids, [3, 6, 2, 5]);
  assert.equal(s.lesson.key, 'L160');
});

test('weakScore and summarize', () => {
  assert.equal(weakScore({ bad: 4, ok: 2 }), 3);
  assert.equal(weakScore({ bad: 0, ok: 9 }), 0);
  assert.equal(weakScore(undefined), 0);
  const byId = new Map([[1, { e: 'One' }], [2, { e: 'Two' }], [3, { e: 'Three' }]]);
  const r = summarize({ ids: [1, 2, 3, 4] }, { 1: 90, 2: 60, 3: 80 }, { 1: 70, 2: 60 }, byId);
  assert.deepEqual([r.total, r.done, r.skipped, r.avg, r.records, r.firsts, r.good], [4, 3, 1, 77, 1, 1, 1]);
  assert.deepEqual(r.hard.map(h => h.id), [2, 3]);
  assert.equal(summarize({ ids: [1] }, {}, {}, byId).avg, null);
});

test('lastDays: 14-day history with counts and average scores', () => {
  const k = t => new Date(t).getFullYear() + '-' + String(new Date(t).getMonth() + 1).padStart(2, '0') + '-' + String(new Date(t).getDate()).padStart(2, '0');
  const days = { [k(NOW)]: 4, [k(NOW - DAY)]: 2 }, scores = { [k(NOW)]: { n: 4, sum: 300 } };
  const h = lastDays(days, scores, 14, NOW);
  assert.equal(h.length, 14);
  assert.deepEqual(h[13], { key: k(NOW), n: 4, avg: 75 });
  assert.deepEqual([h[12].n, h[12].avg, h[0].n], [2, null, 0]);
});

test('router: parse / format round trip, legacy numeric links, tabs', () => {
  assert.deepEqual(parseRoute(''), { name: 'today' });
  assert.deepEqual(parseRoute('#/library'), { name: 'library' });
  assert.deepEqual(parseRoute('#/practice/42'), { name: 'practice', id: 42 });
  assert.deepEqual(parseRoute('#/practice'), { name: 'practice', id: null });
  assert.deepEqual(parseRoute('#125'), { name: 'practice', id: 125 });
  assert.deepEqual(parseRoute('#/stats/ipa'), { name: 'stats', section: 'ipa' });
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
  for (const r of [{ name: 'lesson', key: 'L166' }, { name: 'lesson', key: 'u:L045 2026/10/28 Job interview' }, { name: 'lesson', key: 'n:面試自我介紹' }, { name: 'practice', id: 7 }, { name: 'done' }, { name: 'settings' }]) {
    assert.deepEqual(parseRoute(routeHash(r)), r);
  }
  assert.equal(tabOf({ name: 'lesson' }), 'library');
  assert.equal(tabOf({ name: 'done' }), 'today');
  assert.equal(tabOf({ name: 'practice' }), null);
});
