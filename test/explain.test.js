import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respell, explain, minimalPairs, CONF, ART } from '../js/explain.js';

test('respell: target vs what was heard', () => {
  assert.equal(respell(['d', 'ɹ', 'oʊ', 'v']), 'drohv');
  assert.equal(respell(['dʒ', 'ɹ', 'ɔ', 'f']), 'jroff');
  assert.equal(respell(['θ', 'ɪ', 'ŋ', 'k']), 'thingk');
  assert.equal(respell(['k', 'æ', 't', '—']), 'kat'); // omitted sounds are skipped
  assert.equal(respell([]), '');
});

test('explain d→dʒ gives articulation diff, drill and minimal pairs', () => {
  const x = explain('d', 'dʒ', { word: 'drove' });
  assert.equal(x.kind, 'known');
  assert.match(x.did, /舌面/);
  assert.match(x.should, /舌尖/);
  assert.deepEqual(x.pairs.slice(0, 2), [['day', 'jay'], ['dough', 'Joe']]);
  assert.ok(x.fix.length > 5);
});

test('minimal pairs are oriented expected-sound first, and flip for the reverse confusion', () => {
  assert.deepEqual(minimalPairs('dʒ', 'd')[0], ['jay', 'day']);
  assert.deepEqual(minimalPairs('θ', 's')[0], ['think', 'sink']);
});

test('table covers the common Mandarin-speaker confusions', () => {
  const must = ['t|d', 'd|t', 'z|s', 's|z', 'f|v', 'v|f', 'oʊ|ɔ', 'ɔ|oʊ', 'm|n', 'n|m', 'θ|s', 'ð|d', 'l|n', 'n|l', 'ɹ|l', 'l|ɹ', 'ɪ|i', 'i|ɪ', 'æ|ɛ', 'ʊ|u', 'u|ʊ', 'v|w', 'dʒ|d'];
  for (const k of must) assert.ok(CONF[k], k);
  for (const v of Object.values(CONF)) assert.ok(v.did && v.should && v.fix);
});

test('voicing confusions are generated in both directions', () => {
  assert.match(explain('d', 't').should, /振動/);
  assert.match(explain('t', 'd').should, /送氣/);
});

test('omission, same sound, and generic fallback', () => {
  const o = explain('t', '—', { isFinal: true, word: 'cat' });
  assert.equal(o.kind, 'omit');
  assert.match(o.should, /t/);
  assert.equal(explain('s', 's'), null);
  const g = explain('ɔɪ', 'ɑ', { word: 'boy' });
  assert.equal(g.kind, 'generic');
  assert.ok(g.did.includes('ɑ') && g.should.includes('ɔɪ'));
  assert.ok(ART['ɔɪ']);
});
