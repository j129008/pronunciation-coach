import { test } from 'node:test';
import assert from 'node:assert/strict';
import { respell, respellWord, explain, minimalPairs, plainSound, soundLabel, ART, CONF, DEL, INS } from '../js/explain.js';
import { IPA } from '../js/phonemes.js';

const IPA_CHARS = /[ɔɹɚɝʌɑæɛɪʊəʃʒθðŋɾʔˈˌː]/;
const row = (exp, heard, bad = false) => ({ exp, heard, bad });

test('respell: flat respelling, omitted sounds skipped', () => {
  assert.equal(respell(['d', 'ɹ', 'oʊ', 'v']), 'drohv');
  assert.equal(respell(['dʒ', 'ɹ', 'ɔ', 'f']), 'jrawf');
  assert.equal(respell(['k', 'æ', 't', '—']), 'kat');
  assert.equal(respell(['ɔɹ']), 'or');
  assert.equal(respell([]), '');
});

test('respellWord: affordable → syllables, error syllable in capitals', () => {
  const rows = [row('ə', 'ə'), row('f', 'f'), row('ɔɹ', 'ɔ', true), row('d', 'd'), row('ə', 'ə'), row('b', 'b'), row('ə', 'ə'), row('l', 'l')];
  const r = respellWord(rows);
  assert.equal(r.target, 'uh-FOR-duh-bul');
  assert.equal(r.said, 'uh-FAW-duh-bul');
  assert.ok(r.differs);
});

test('respellWord: omitted sound disappears from the user version; identical words do not differ', () => {
  const r = respellWord([row('k', 'k'), row('æ', 'æ'), row('t', '—', true)]);
  assert.equal(r.target, 'KAT');
  assert.equal(r.said, 'KA');
  assert.equal(respellWord([row('g', 'g'), row('oʊ', 'oʊ')]).differs, false);
});

test('respellWord: drove → jroff style substitution', () => {
  const r = respellWord([row('d', 'dʒ', true), row('ɹ', 'ɹ'), row('oʊ', 'ɔ', true), row('v', 'f', true)]);
  assert.equal(r.target, 'DROHV');
  assert.equal(r.said, 'JRAWF');
});

test('少唸了: ɔɹ said as ɔ (the "affordable" case)', () => {
  const x = explain('ɔɹ', 'ɔ', { letters: 'or', word: 'affordable' });
  assert.equal(x.type, 'del');
  assert.equal(x.typeLabel, '少唸了');
  assert.match(x.verdict, /「or」少了捲舌的 r，你只唸了「歐」，要唸成「歐兒」，舌頭往後捲/);
  assert.deepEqual(x.pairs, [['sore', 'saw'], ['lore', 'law']]);
  assert.match(x.fix, /舌/);
});

test('少唸了: diphthongs, r-colored vowels and affricates where a part is missing', () => {
  assert.equal(explain('oʊ', 'ɔ', { letters: 'o' }).type, 'del');
  assert.match(explain('oʊ', 'ɔ', { letters: 'o' }).verdict, /收圓的尾巴/);
  assert.equal(explain('aɪ', 'ɑ').type, 'del');
  assert.equal(explain('eɪ', 'ɛ').type, 'del');
  assert.equal(explain('ɝ', 'ʌ', { letters: 'ir' }).type, 'del');
  assert.match(explain('ɝ', 'ʌ', { letters: 'ir' }).verdict, /捲舌/);
  assert.equal(explain('ɚ', 'ə').type, 'del');
  assert.equal(explain('tʃ', 'ʃ').type, 'del');
  assert.equal(explain('dʒ', 'd').type, 'del');
});

test('少唸了: whole sound dropped, r after a vowel, final consonant', () => {
  const t = explain('t', '—', { isFinal: true, word: 'cat', letters: 't' });
  assert.equal(t.type, 'omit');
  assert.equal(t.typeLabel, '少唸了');
  assert.match(t.fix, /字尾 t/);
  assert.equal(t.pairs.length, 2);
  const r = explain('ɹ', '—', { letters: 'r' });
  assert.equal(r.type, 'del');
  assert.match(r.verdict, /捲舌的 r/);
});

test('多唸了: extra friction / r / glide', () => {
  const a = explain('d', 'dʒ', { letters: 'd' });
  assert.equal(a.type, 'ins');
  assert.equal(a.typeLabel, '多唸了');
  assert.match(a.verdict, /多唸了放開時的舌面摩擦/);
  assert.deepEqual(a.pairs[0], ['day', 'jay']);
  assert.equal(explain('ɔ', 'ɔɹ', { letters: 'aw' }).type, 'ins');
  assert.equal(explain('ɔ', 'oʊ').type, 'ins');
  assert.equal(explain('t', 'tʃ').type, 'ins');
  assert.equal(explain('ə', 'ɚ').type, 'ins');
});

test('唸成別的音: d → t matches the plain wording', () => {
  const x = explain('d', 't', { letters: 'd' });
  assert.equal(x.type, 'sub');
  assert.equal(x.typeLabel, '唸成別的音');
  assert.match(x.verdict, /d 唸成了 t：太硬、像「特」；要輕輕彈一下、喉嚨震動，像「的」/);
});

test('same sound → null; unclear → plain sub; generic fallback uses mouth descriptions', () => {
  assert.equal(explain('s', 's'), null);
  assert.equal(explain('s', 'iː'.slice(0, 1)).type, 'sub');
  assert.equal(explain('ɹ', '?').type, 'sub');
  const g = explain('ɔɪ', 'm', { word: 'boy' }); // not a known pair → generic
  assert.equal(g.type, 'sub');
  assert.match(g.verdict, /你的嘴型是/);
  assert.ok(g.pairs.length >= 1);
});

test('common Mandarin-speaker confusions are all hand-covered with fix + 2 minimal pairs', () => {
  const must = [['t', 'd'], ['d', 't'], ['z', 's'], ['s', 'z'], ['f', 'v'], ['v', 'f'], ['ɔ', 'oʊ'], ['oʊ', 'ɔ'], ['m', 'n'], ['n', 'm'],
    ['θ', 's'], ['ð', 'd'], ['l', 'n'], ['n', 'l'], ['ɹ', 'l'], ['l', 'ɹ'], ['ɪ', 'i'], ['i', 'ɪ'], ['æ', 'ɛ'], ['ʊ', 'u'], ['u', 'ʊ'],
    ['v', 'w'], ['dʒ', 'd'], ['d', 'dʒ'], ['ɔɹ', 'ɔ'], ['ɝ', 'ʌ'], ['ɚ', 'ə'], ['aɪ', 'ɑ'], ['n', 'ŋ'], ['ŋ', 'n']];
  for (const [e, h] of must) {
    const x = explain(e, h, { letters: 'x', word: 'test' });
    assert.ok(x, `${e}|${h}`);
    assert.doesNotMatch(x.verdict, /你的嘴型是/, `${e}|${h} fell back to generic`);
    assert.ok(x.fix.length > 5, `${e}|${h} fix`);
    assert.equal(x.pairs.length, 2, `${e}|${h} pairs`);
    assert.ok(x.pairs.every(p => p.length === 2 && p.every(w => /^[A-Za-z]+$/.test(w))), `${e}|${h} pair words`);
  }
});

test('NO IPA symbols anywhere in any explanation text', () => {
  const keys = Object.keys(ART);
  const others = ['—', '?', 'ɹ', 'tʃ', 'dʒ'];
  for (const e of keys) {
    assert.doesNotMatch(plainSound(e), IPA_CHARS, 'plainSound ' + e);
    assert.doesNotMatch(soundLabel(e), IPA_CHARS, 'soundLabel ' + e);
    for (const h of [...keys, ...others]) {
      for (const opts of [{ letters: 'x', word: 'test' }, { isFinal: true }, {}]) {
        const x = explain(e, h, opts);
        if (x) assert.doesNotMatch(JSON.stringify(x), IPA_CHARS, `${e}|${h}`);
      }
    }
  }
  for (const [k, v] of Object.entries({ ...CONF, ...DEL, ...INS })) assert.doesNotMatch(JSON.stringify(v), IPA_CHARS, k);
  for (const [k, v] of Object.entries(IPA)) assert.doesNotMatch(v.join(' '), IPA_CHARS, 'IPA table ' + k);
});

test('minimal pairs: expected-sound word first, flipped for the reverse', () => {
  assert.deepEqual(minimalPairs('θ', 's')[0], ['think', 'sink']);
  assert.deepEqual(minimalPairs('s', 'θ')[0], ['sink', 'think']);
  assert.equal(minimalPairs('θ', 's').length, 2);
});
