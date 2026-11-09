import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as WQ from '../js/wordqueue.js';
import { scoreHyp } from '../js/align.js';

const az = (word, score, bad = false, et = 'None') => ({ word, score, et, rows: [{ exp: 'p', heard: bad ? 'b' : 'p', bad }] });

test('mispronounced words of a sentence: Azure (bad sounds, omissions) and Web Speech (bad / missed words)', () => {
  const words = [az('I', 95), az('prefer', 55, true), az('the', 40, false, 'Omission'), az('um', 0, false, 'Insertion'), az('Prefer', 50, true)];
  assert.deepEqual(WQ.badWordsAzure(words).map(x => x.w), ['prefer', 'the']);
  const r = scoreHyp('I prefer the window seat.', 'I prefur the window');
  assert.deepEqual(WQ.badWordsText(r.disp).map(x => x.w), ['prefer', 'seat']);
  assert.equal(WQ.badWordsText(r.disp)[0].heard, 'prefur');
});

test('single-word takes: OK only when accurate and no wrong sounds (Azure) / the word was recognized (Web Speech)', () => {
  assert.equal(WQ.judgeAzureWord([az('prefer', 92)], 'prefer').ok, true);
  assert.equal(WQ.judgeAzureWord([az('prefer', 92, true)], 'prefer').ok, false);
  assert.equal(WQ.judgeAzureWord([az('prefer', 70)], 'Prefer,').ok, false);
  assert.equal(WQ.judgeAzureWord([az('prefer', 0, false, 'Omission')], 'prefer').ok, false);
  assert.equal(WQ.judgeAzureWord([], 'prefer').w, null);
  assert.deepEqual(WQ.judgeSpeechWord(['proffer', 'prefer'], 'prefer'), { ok: true, heard: 'prefer' });
  assert.deepEqual(WQ.judgeSpeechWord(['proffer'], 'prefer'), { ok: false, heard: 'proffer' });
});

test('queue keeps the word with its sentence, counts misses, sorts worst first, and drops a word once practised OK', () => {
  let q = [];
  q = WQ.addMisses(q, { id: 7, sentence: 'I prefer tea.', words: [{ w: 'prefer' }] }, 1);
  q = WQ.addMisses(q, { id: 8, sentence: 'We develop apps.', words: [{ w: 'develop' }] }, 2);
  q = WQ.addMisses(q, { id: 7, sentence: 'I prefer tea.', words: [{ w: 'Prefer', heard: 'proffer' }] }, 3);
  assert.equal(q.length, 2);
  assert.deepEqual(WQ.sortQueue(q).map(a => [a.w, a.miss, a.s]), [['prefer', 2, 'I prefer tea.'], ['develop', 1, 'We develop apps.']]);
  assert.equal(q[0].heard, 'proffer');
  assert.equal(WQ.queueFor(q, 8).length, 1);
  q = WQ.removeWord(q, 7, 'PREFER');
  assert.deepEqual(q.map(a => a.w), ['develop']);
});

test('the sentence context marks the practised word once', () => {
  const parts = WQ.markWord('I prefer, you prefer.', 'prefer');
  assert.deepEqual(parts.filter(p => p.hit).map(p => p.text), ['prefer,']);
  assert.equal(parts.map(p => p.text).join(''), 'I prefer, you prefer.');
});

test('queue persists in localStorage', () => {
  const store = {};
  globalThis.localStorage = store;
  WQ.saveQueue([{ k: 'prefer', w: 'prefer', id: 1, s: 'x', miss: 1, t: 1 }]);
  assert.equal(WQ.loadQueue()[0].w, 'prefer');
  delete globalThis.localStorage;
});
