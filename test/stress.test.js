import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignLetters } from '../js/phonemes.js';
import { wordFix, subText, zySound } from '../js/wordfix.js';
import { explain, zhApprox } from '../js/explain.js';
import { refVowels, applyRef, refFor } from '../js/stress.js';

function mk(word, spec) {
  const rows = spec.map(([exp, heard, bad]) => ({ exp, heard: heard ?? exp, bad: !!bad }));
  rows.forEach((r, i) => { r.isFinal = i === rows.length - 1; });
  alignLetters(word, rows.map(r => r.exp)).forEach((l, i) => { rows[i].let = l; });
  return { word, rows };
}
// the user-reported card: prefer with r dropped, e heard as /ɛ/, f as v, er without r-colour (Azure labelled the e as /i/)
const prefer = mk('prefer', [['p'], ['ɹ', '—', 1], ['i', 'ɛ', 1], ['f', 'v', 1], ['ɝ', 'ə', 1]]);
// "X 唸成了 X" with both sides looking the same, in any form we print
const SAME = /(?:^|[：，\s」])([^\s：，（]+?) ?唸成了 ?\1(?:$|[，（；：])/;
const SAME2 = /應該唸 ?([^，]+?)，你唸成了 ?\1(?:$|[，：；])/;

test('prefer: no 「e 唸成了 e」; the vowel is described in 注音 (短而輕的ㄧ vs ㄝ)', () => {
  const s = wordFix(applyRef(prefer, refFor('prefer'))).regions[0].sentence;
  assert.ok(!/e 唸成了 e/.test(s), s);
  assert.match(s, /e 唸成了ㄝ（該唸短而輕的ㄧ）/);
  const one = mk('prefer', [['p'], ['ɹ'], ['i', 'ɛ', 1], ['f'], ['ɝ']]);
  assert.equal(wordFix(applyRef(one, refFor('prefer'))).regions[0].sentence, 'e 應該唸短而輕的ㄧ，你唸成了ㄝ');
  assert.match(explain('ɪ', 'ɛ', { letters: 'e' }).verdict, /^「e」應該唸短而輕的ㄧ，你唸成了ㄝ/);
});

test('prefer /prɪˈfɝ/: how-to says 短而輕的ㄧ (not 長的ㄧ) and marks the stress', () => {
  const h = wordFix(applyRef(prefer, refFor('prefer'))).regions[0].howto;
  assert.ok(!h.includes('長的ㄧ'), h);
  assert.match(h, /短而輕的ㄧ（輕讀）/);
  assert.match(h, /ㄦ（重音/);
  const one = mk('prefer', [['p'], ['ɹ'], ['i', 'ɛ', 1], ['f'], ['ɝ']]);
  assert.match(wordFix(applyRef(one, refFor('prefer'))).regions[0].howto, /^唸短而輕的ㄧ（輕讀）：.*重音在 -fer$/);
});

test('/i/ and /ɪ/ have different 注音 hints; long/short-only confusions are rephrased, never X 唸成了 X', () => {
  assert.equal(zhApprox('i'), '長的ㄧ');
  assert.equal(zhApprox('ɪ'), '短而輕的ㄧ');
  assert.notEqual(zySound('i'), zySound('ɪ'));
  assert.equal(subText('ee', 'i', 'ɪ'), 'ee 應該唸長的ㄧ，你唸成了短而輕的ㄧ');
  assert.equal(subText('s', 'z', 's'), 's 應該唸 z，你唸成了 s'); // "is": letters s, sound z, heard s
});

test('exhaustive: no explanation text ever shows two sides that look the same', () => {
  const S = ['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'ɹ', 'w', 'j', 'h',
    'ʌ', 'ɑ', 'æ', 'ɛ', 'ɪ', 'i', 'ʊ', 'u', 'ə', 'ɚ', 'ɝ', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'ɔ'];
  assert.ok(SAME.test('prefer：r 沒唸出來，e 唸成了 e，f 唸成了 v'), 'the detector catches the reported card');
  const letters = ['e', 'i', 'a', 'o', 'u', 'ee', 's', 'th', 'er', 'f', 'v', 'z', 'r', 'w'];
  for (const e of S) for (const h of S) if (e !== h) for (const L of letters) for (const alone of [true, false]) {
    const t = subText(L, e, h, alone);
    assert.ok(!SAME.test(t) && !SAME2.test(t), `${e}→${h} [${L}]: ${t}`);
    const x = explain(e, h, { letters: L });
    if (x) assert.ok(!SAME.test(x.verdict.replace(/^「|」/g, '')) && !SAME2.test(x.verdict), `${e}→${h} [${L}]: ${x.verdict}`);
  }
});

test('reference IPA: stress parsing and applying it to Azure rows', () => {
  assert.deepEqual(refVowels('prɪˈfɝ'), [{ v: 'ɪ', stress: 0 }, { v: 'ɝ', stress: 1 }]);
  assert.deepEqual(refVowels('ʌmbɹˈɛlə').map(x => x.stress), [0, 1, 0]);
  assert.deepEqual(refVowels('θˈɜːɹoʊli').map(x => x.v), ['ɝ', 'oʊ', 'i']);
  // Azure's /i/ said as /ɪ/ in an unstressed syllable is correct → not an error any more
  const ok = applyRef(mk('prefer', [['p'], ['ɹ'], ['i', 'ɪ', 1], ['f'], ['ɝ']]), 'prɪˈfɝ');
  assert.equal(ok.rows[2].exp, 'ɪ');
  assert.equal(ok.rows[2].bad, false);
  assert.equal(wordFix(ok).regions.length, 0);
  // vowel counts don't match → unchanged
  const w = mk('prefer', [['p'], ['ɹ'], ['i'], ['f'], ['ɝ']]);
  assert.equal(applyRef(w, 'pɹˈɛf'), w);
  // learner's own vocab item wins over the built-in list
  assert.equal(refFor('Prefer', [{ e: 'prefer', p: 'pɹɪfˈɜː' }]), 'pɹɪfˈɜː');
  assert.equal(refFor('prefer'), 'prɪˈfɝ');
  assert.equal(refFor('banana'), '');
});
