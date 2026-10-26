import { test } from 'node:test';
import assert from 'node:assert/strict';
import { align, scoreHyp, tipsFor, charSim } from '../js/align.js';

test('identical sentences score 100', () => {
  const r = scoreHyp('Could you pass me the salt, please?', 'could you pass me the salt please');
  assert.equal(r.score, 100);
  assert.ok(r.a.every(x => x.s === 'ok'));
});

test('number/unit normalization does not cost points', () => {
  assert.equal(scoreHyp('I ran 10 kilometers', 'i ran ten km').score, 100);
  assert.equal(scoreHyp('It costs $5', 'it costs five dollars').score, 100);
});

test('missing word is marked miss', () => {
  const r = scoreHyp('Pass me the salt', 'pass me salt');
  assert.deepEqual(r.a.map(x => x.s), ['ok', 'ok', 'miss', 'ok']);
  assert.equal(r.score, 75);
  assert.ok(tipsFor(r.a).some(t => t.includes('冠詞')));
});

test('extra word is marked extra and slightly penalized', () => {
  const r = align(['a', 'b'], ['a', 'x', 'b']);
  assert.deepEqual(r.map(x => x.s), ['ok', 'extra', 'ok']);
  assert.equal(scoreHyp('a b', 'a x b').score, Math.round(100 * 2 / 2.5));
});

test('similar word is a substitution (bad) with the heard word', () => {
  const r = align(['think'], ['sink']);
  assert.deepEqual(r, [{ t: 'think', h: 'sink', s: 'bad' }]);
  assert.ok(tipsFor(r).some(t => t.includes('th')));
});

test('display regrouping: "5km" stays one display word', () => {
  const r = scoreHyp('Run 5km today', 'run five kilometer today');
  assert.deepEqual(r.disp.map(d => d.d), ['Run', '5km', 'today']);
  assert.ok(r.disp.every(d => d.s === 'ok'));
});

test('empty hypothesis → all miss, score 0', () => {
  const r = scoreHyp('hello world', '');
  assert.equal(r.score, 0);
  assert.ok(r.a.every(x => x.s === 'miss'));
});

test('charSim bounds', () => {
  assert.equal(charSim('abc', 'abc'), 1);
  assert.equal(charSim('', ''), 1);
  assert.ok(charSim('abc', 'xyz') < 0.1);
});
