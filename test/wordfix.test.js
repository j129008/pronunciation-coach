import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignLetters } from '../js/phonemes.js';
import { wordFix, letterSpans, errorRegions, regionSentence, regionHowTo, shortSound } from '../js/wordfix.js';

const IPA_CHARS = /[ɔɹɚɝʌɑæɛɪʊəʃʒθðŋɾʔˈˌː]/;
// spec: [[exp, heard?, bad?], ...] → analyzeWord-like rows with letters
function mk(word, spec) {
  const rows = spec.map(([exp, heard, bad]) => ({ exp, heard: heard ?? exp, bad: !!bad }));
  rows.forEach((r, i) => { r.isFinal = i === rows.length - 1; });
  alignLetters(word, rows.map(r => r.exp)).forEach((l, i) => { rows[i].let = l; });
  return { word, rows };
}
// the user-reported case: "products" heard as trah-duuzz (c → long u, t dropped, s → z)
const products = mk('products', [['p'], ['ɹ'], ['ɑ'], ['d'], ['ə'], ['k', 'ʌ', 1], ['t', '—', 1], ['s', 'z', 1]]);

test('letterSpans maps every phoneme back to its letters in the word', () => {
  const sp = letterSpans(products.word, products.rows);
  assert.deepEqual(sp[5], [5, 6]); // c
  assert.deepEqual(sp[7], [7, 8]); // s
  const knight = mk('Knight', [['n'], ['aɪ'], ['t']]);
  const ks = letterSpans(knight.word, knight.rows);
  assert.equal(knight.word.slice(...ks[2]), 't');
  assert.equal(ks.map(([a, b]) => knight.word.slice(a, b)).join(''), 'Knight');
});

test('wrong letters are highlighted in place with the correct sound under them', () => {
  const f = wordFix(products);
  assert.equal(f.segments.map(s => s.text).join(''), 'products');
  assert.deepEqual(f.segments.filter(s => s.bad).map(s => [s.text, s.sound]), [['c', 'k'], ['t', 't'], ['s', 's']]);
  assert.equal(f.segments[0].text, 'produ');
});

test('neighbouring errors are merged into one region and one sentence', () => {
  const regs = errorRegions(products.rows);
  assert.equal(regs.length, 1);
  assert.deepEqual([regs[0].a, regs[0].b], [5, 7]);
  const s = regionSentence(products.word, products.rows, regs[0]);
  assert.equal(s, '-ducts：c、t 沒唸出來，s 唸成了 z');
  assert.ok(s.length <= 25);
});

test('how-to line is anchored on the syllable before the error, in 注音', () => {
  const h = regionHowTo(products.rows, errorRegions(products.rows)[0]);
  assert.equal(h, '「ㄉㄜ」後舌根往上頂住停一下，再快速吐出「ㄘ」');
});

test('single errors use plain verbs: 唸成了 / 沒唸出來 / 多唸了', () => {
  const one = w => wordFix(w).regions.map(r => r.sentence);
  assert.deepEqual(one(mk('documents', [['d', 'ð', 1], ['ɑ'], ['k'], ['j'], ['ə'], ['m'], ['ə'], ['n'], ['t'], ['s']])), ['d 唸成了 th']);
  assert.deepEqual(one(mk('cat', [['k'], ['æ'], ['t', '—', 1]])), ['字尾 t 沒唸出來']);
  assert.deepEqual(one(mk('good', [['g'], ['ʊ'], ['d', 'ə', 1]])), ['d 後面多唸了「ㄜ」']);
  assert.deepEqual(one(mk('back', [['b'], ['æ'], ['k', 'ʌ', 1]])), ['ck 後面多唸了「ㄜ」']);
  assert.deepEqual(one(mk('actor', [['æ'], ['k', 'ʌ', 1], ['t'], ['ɚ']])), ['c 沒唸出來，變成拉長的 u']);
  assert.deepEqual(one(mk('affordable', [['ə'], ['f'], ['ɔɹ', 'ɔ', 1], ['d'], ['ə'], ['b'], ['ə'], ['l']])), ['or：捲舌的 r 沒唸出來']);
});

test('separate errors far apart stay separate regions; order follows the word', () => {
  const w = mk('develop', [['d', 'ð', 1], ['ɪ'], ['v'], ['ɛ'], ['l'], ['ə'], ['p', '—', 1]]);
  assert.deepEqual(wordFix(w).regions.map(r => r.sentence), ['d 唸成了 th', '字尾 p 沒唸出來']);
  const ship = mk('ship', [['ʃ'], ['ɪ', 'i', 1], ['p', '—', 1]]);
  assert.deepEqual(wordFix(ship).regions.map(r => r.sentence), ['ship：i 唸成了 ee，p 沒唸出來']);
});

test('no IPA symbols leak into the sentence or how-to text', () => {
  const words = [products, mk('think', [['θ', 's', 1], ['ɪ'], ['ŋ'], ['k']]), mk('very', [['v', 'b', 1], ['ɛ'], ['ɹ'], ['i']]), mk('sheep', [['ʃ'], ['i', 'ɪ', 1], ['p']])];
  for (const w of words) for (const r of wordFix(w).regions) {
    assert.ok(!IPA_CHARS.test(r.sentence), r.sentence);
    assert.ok(!IPA_CHARS.test(r.howto), r.howto);
    assert.ok(r.howto.length > 0);
  }
  assert.equal(shortSound('ð'), 'th');
});

test('a word with no errors has no regions and no highlighted letters', () => {
  const f = wordFix(mk('go', [['g'], ['oʊ']]));
  assert.equal(f.regions.length, 0);
  assert.deepEqual(f.segments, [{ text: 'go', bad: false }]);
});
