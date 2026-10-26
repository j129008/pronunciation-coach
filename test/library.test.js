import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSegment, parseLabels, primarySegment, lessonKey, buildCatalog, preClassLessons, lessonStats, searchItems, makeFilter, filterActive, fmtDate } from '../js/library.js';

// synthetic labels in the shapes the real data uses
const it = (i, l, o = {}) => ({ i, e: o.e || `Sentence ${i}.`, z: o.z || '', t: o.t || 'sentence', l, ...o });

test('parseSegment: plain, pre/post-class prefix, topic, name-only and no-date labels', () => {
  assert.deepEqual(parseSegment('L162 (2026/10/22)'), { raw: 'L162 (2026/10/22)', kind: 'class', num: 162, name: '', date: Date.UTC(2026, 9, 22), topic: '' });
  const pre = parseSegment('課前練習 L166 (2026/10/26) Company structure');
  assert.deepEqual([pre.kind, pre.num, pre.topic, pre.date], ['pre', 166, 'Company structure', Date.UTC(2026, 9, 26)]);
  const post = parseSegment('課後複習 L166 (2026/10/27)');
  assert.deepEqual([post.kind, post.num, post.topic], ['post', 166, '']);
  const named = parseSegment('課前練習 面試自我介紹 (2026/10/20) Self intro');
  assert.deepEqual([named.kind, named.num, named.name, named.topic], ['pre', null, '面試自我介紹', 'Self intro']);
  const cls = parseSegment('英文課 12 (2026/03/01)');
  assert.deepEqual([cls.kind, cls.num, cls.name], ['class', null, '英文課 12']);
  const nodate = parseSegment('L045 Job interview');
  assert.deepEqual([nodate.num, nodate.date, nodate.topic], [45, 0, 'Job interview']);
  assert.equal(parseSegment('Second lesson').num, null);
});

test('multi-label items use the LATEST date, not the first label', () => {
  const segs = parseLabels('L150 (2026/09/10); L162 (2026/10/22); L131 (2026/05/01)');
  assert.equal(segs.length, 3);
  assert.equal(lessonKey(primarySegment(segs)), 'L162');
  // same day: the higher lesson number wins; mixed dated/undated: dated wins
  assert.equal(lessonKey(primarySegment(parseLabels('L10 (2026/01/01); L12 (2026/01/01)'))), 'L012');
  assert.equal(lessonKey(primarySegment(parseLabels('L99; L5 (2026/01/01)'))), 'L005');
  assert.equal(lessonKey(primarySegment(parseLabels('英文課 12 (2026/03/01); L131 (2026/04/01)'))), 'L131');
  assert.equal(lessonKey(primarySegment(parseLabels('英文課 12 (2026/03/01)'))), 'n:英文課 12');
  assert.equal(lessonKey(primarySegment(parseLabels(''))), 'other');
});

const sample = () => [
  it(1, 'L162 (2026/10/22)'), it(2, 'L162 (2026/10/22)', { t: 'vocab', e: 'Umbrella', z: '雨傘' }),
  it(3, 'L150 (2026/09/10); L162 (2026/10/22)', { e: 'Shared sentence.' }),
  it(4, 'L150 (2026/09/10)'), it(5, 'L150 (2026/09/10)', { t: 'extra' }),
  it(6, '課前練習 L166 (2026/10/26) Company structure'), it(7, '課前練習 L166 (2026/10/26) Company structure'),
  it(8, '課後複習 L166 (2026/10/27)'), it(9, 'L166 (2026/10/26)', { t: 'vocab' }),
  it(10, '課前練習 面試自我介紹 (2026/10/20) Self intro'),
  it(11, '英文課 12 (2026/03/01)'), it(12, ''),
  it(1000001, 'L045 2026/10/28 Job interview', { u: 1, added: Date.UTC(2026, 9, 28, 8) }),
  it(1000002, 'L045 2026/10/28 Job interview', { u: 1, added: Date.UTC(2026, 9, 28, 8) }),
];

test('buildCatalog groups by latest-label lesson, newest first, with counts and topic', () => {
  const cat = buildCatalog(sample());
  assert.deepEqual(cat.file.map(l => l.key), ['L166', 'L162', 'n:面試自我介紹', 'L150', 'n:英文課 12']);
  const l162 = cat.byKey.get('L162');
  assert.deepEqual(l162.ids, [1, 2, 3]);               // item 3 (L150; L162) lives in L162
  assert.deepEqual(l162.counts, { sentence: 2, vocab: 1, extra: 0 });
  assert.equal(cat.byKey.get('L150').ids.length, 2);   // not 3
  const l166 = cat.byKey.get('L166');
  assert.equal(l166.topic, 'Company structure');
  assert.equal(l166.title, 'L166');
  assert.equal(l166.date, Date.UTC(2026, 9, 27));      // newest label in the lesson (the 課後 one)
  assert.deepEqual(l166.kinds, { pre: 2, post: 1, class: 1 });
  assert.ok(l166.hasPre && !cat.byKey.get('L162').hasPre);
  assert.equal(cat.byKey.get('n:面試自我介紹').title, '面試自我介紹');
  assert.equal(cat.other[0].title, '其他');
  assert.deepEqual(cat.lessons[cat.lessons.length - 1].key, 'other');
  assert.equal(fmtDate(l166.date), '2026/10/27');
});

test('user-added lessons stay separate (never merge into file lessons) and come first', () => {
  const items = sample();
  const cat = buildCatalog(items);
  assert.equal(cat.user.length, 1);
  assert.equal(cat.user[0].key, 'u:L045 2026/10/28 Job interview');
  assert.ok(cat.user[0].user && cat.user[0].hasPre);
  assert.equal(cat.lessons[0].key, cat.user[0].key);
  assert.ok(!cat.byKey.has('L045'));
  assert.equal(items.find(d => d.i === 1000001).lk, cat.user[0].key);
  assert.deepEqual(preClassLessons(cat).map(l => l.key), ['u:L045 2026/10/28 Job interview', 'L166', 'n:面試自我介紹']);
});

test('items are annotated with lesson key, kind and date', () => {
  const items = sample();
  buildCatalog(items);
  const d = id => items.find(x => x.i === id);
  assert.deepEqual([d(3).lk, d(3).kind, d(3).lDate], ['L162', 'class', Date.UTC(2026, 9, 22)]);
  assert.deepEqual([d(6).lk, d(6).kind], ['L166', 'pre']);
  assert.equal(d(8).kind, 'post');
  assert.deepEqual([d(12).lk, d(12).kind], ['other', 'class']);
});

test('lessonStats: mastered % counts good + due, avg over practised items', () => {
  const cat = buildCatalog(sample());
  const st = { 1: 'good', 2: 'due', 3: 'weak' };
  const prog = { 1: { a: 1, l: 90 }, 2: { a: 2, l: 88 }, 3: { a: 1, l: 40 } };
  const s = lessonStats(cat.byKey.get('L162'), id => st[id] || 'new', prog);
  assert.deepEqual(s, { total: 3, practiced: 3, mastered: 2, due: 1, weak: 1, pct: 67, avg: 73 });
  const e = lessonStats(cat.byKey.get('L150'), () => 'new', {});
  assert.deepEqual([e.pct, e.avg, e.practiced], [0, null, 0]);
});

test('searchItems: English and Chinese, every word must match, ranked, limited', () => {
  const items = [
    it(1, 'L1 (2026/01/01)', { e: 'I need an umbrella today.', z: '我今天需要一把雨傘。' }),
    it(2, 'L1 (2026/01/01)', { e: 'Umbrella', z: '雨傘', t: 'vocab' }),
    it(3, 'L2 (2026/01/02)', { e: 'The weather is nice.', z: '天氣很好。', x: 'Bring an umbrella anyway.' }),
    it(4, 'L2 (2026/01/02)', { e: 'Totally unrelated.' }),
  ];
  assert.deepEqual(searchItems(items, 'umbrella').map(d => d.i), [2, 1, 3]);   // starts-with, contains, example sentence
  assert.deepEqual(searchItems(items, '雨傘').map(d => d.i), [2, 1]);
  assert.deepEqual(searchItems(items, 'umbrella 天氣').map(d => d.i), [3]);
  assert.deepEqual(searchItems(items, '#4').map(d => d.i), [4]);
  assert.deepEqual(searchItems(items, '   '), []);
  assert.deepEqual(searchItems(items, 'zzz'), []);
  assert.equal(searchItems(items, 'e', { limit: 2 }).length, 2);
  assert.deepEqual(searchItems(items, 'umbrella', { pred: d => d.t === 'vocab' }).map(d => d.i), [2]);
});

test('makeFilter combines status, type and kind', () => {
  const items = sample();
  buildCatalog(items);
  const status = id => (id === 2 ? 'weak' : 'new');
  const pick = f => items.filter(makeFilter(f, status)).map(d => d.i);
  assert.equal(pick({ status: 'all', type: '', kind: '' }).length, items.length);
  assert.deepEqual(pick({ status: 'weak', type: '', kind: '' }), [2]);
  assert.deepEqual(pick({ status: 'all', type: 'vocab', kind: 'class' }), [2, 9]);
  assert.deepEqual(pick({ status: 'all', type: '', kind: 'post' }), [8]);
  assert.ok(!filterActive({ status: 'all', type: '', kind: '' }) && filterActive({ status: 'due', type: '', kind: '' }));
});
