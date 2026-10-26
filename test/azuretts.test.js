import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xmlEsc, phonemeSsml, targetIpa, heardIpa, VOICE } from '../js/azuretts.js';
import { oneLineHint, lowConfidence, mainError, HINTS } from '../js/hints.js';

const row = (exp, heard, bad = false, extra = {}) => ({ exp, heard, bad, ...extra });
// "the documents" heard as dhi-darg-muhntz-ish
const docs = [row('d', 'ð', true), row('ɑ', 'ɑ'), row('k', 'g', true), row('j', 'j'), row('ə', 'ə'), row('m', 'm'), row('ə', 'ə'), row('n', 'n'), row('t', 't'), row('s', 's')];

test('xmlEsc escapes all five XML special characters', () => {
  assert.equal(xmlEsc(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
  assert.equal(xmlEsc('plain'), 'plain');
});

test('phonemeSsml builds an IPA phoneme element with slow prosody and the Jenny voice', () => {
  const s = phonemeSsml({ word: 'documents', ipa: 'dɑkjəmənts' });
  assert.match(s, /^<speak version="1.0" xmlns="http:\/\/www.w3.org\/2001\/10\/synthesis" xml:lang="en-US">/);
  assert.ok(s.includes(`<voice name="${VOICE}">`));
  assert.equal(VOICE, 'en-US-JennyNeural');
  assert.match(s, /<prosody rate="-\d+%">/);
  assert.ok(s.includes('<phoneme alphabet="ipa" ph="dɑkjəmənts">documents</phoneme>'));
  assert.ok(s.endsWith('</prosody></voice></speak>'));
});

test('phonemeSsml escapes word, ipa and voice so SSML stays well-formed', () => {
  const s = phonemeSsml({ word: `rock & "roll" <b>`, ipa: `ɹ"><x`, voice: `a'b` });
  assert.ok(s.includes('ph="ɹ&quot;&gt;&lt;x"'));
  assert.ok(s.includes('>rock &amp; &quot;roll&quot; &lt;b&gt;</phoneme>'));
  assert.ok(s.includes(`<voice name="a&apos;b">`));
  assert.ok(!/<b>|<x/.test(s));
});

test('phonemeSsml without ipa just speaks the escaped word', () => {
  const s = phonemeSsml({ word: 'Tom & Jerry', ipa: '' });
  assert.ok(!s.includes('<phoneme'));
  assert.ok(s.includes('>Tom &amp; Jerry</prosody>'));
});

test('targetIpa / heardIpa: heard uses recognized sounds only where wrong; never letter respellings', () => {
  assert.equal(targetIpa(docs), 'dɑkjəmənts');
  assert.equal(heardIpa(docs), 'ðɑgjəmənts');
  assert.ok(!/dh/.test(heardIpa(docs)));
});

test('heardIpa drops omitted sounds, keeps expected for unclear, maps flap/glottal to t', () => {
  const r = [row('k', 'k'), row('æ', '?', true), row('t', '—', true)];
  assert.equal(heardIpa(r), 'kæ');
  assert.equal(targetIpa([row('w', 'w'), row('ɔ', 'ɔ'), row('ɾ', 'ɾ'), row('ɚ', 'ɚ')]), 'wɔtɚ');
  assert.equal(targetIpa([row('ˈθ', 'θ'), row('iː', 'iː')]), 'θi');
});

test('oneLineHint: the common error pairs give the hand-written hint', () => {
  assert.equal(oneLineHint('d', 'ð'), HINTS['d|ð']);
  assert.match(oneLineHint('d', 'ð'), /ㄉ/);
  for (const [e, h] of [['ð', 'd'], ['θ', 's'], ['v', 'b'], ['r', 'l'], ['l', 'r'], ['ɪ', 'iː'], ['æ', 'ɛ'], ['ɛ', 'æ']]) {
    assert.ok(oneLineHint(e, h).length > 10, `${e}|${h}`);
    assert.ok(!/[ɔɹɚɝʌɑæɛɪʊəʃʒθðŋ]/.test(oneLineHint(e, h)), `no IPA in ${e}|${h}`);
  }
});

test('oneLineHint: dropped final consonant and added vowel', () => {
  assert.match(oneLineHint('t', '—', { isFinal: true, letters: 't' }), /吞掉/);
  assert.match(oneLineHint('d', 'ə', { isFinal: true, letters: 'd' }), /多加了一個母音/);
  // anything else falls back to the full explanation verdict
  assert.ok(oneLineHint('k', 'g', { letters: 'c' }).length > 0);
});

test('lowConfidence: close or low NBest scores flag a possible recognizer artifact', () => {
  assert.equal(lowConfidence(row('d', 'ð', true, { heardConf: 45, expConf: 40 })), true);
  assert.equal(lowConfidence(row('d', 'ð', true, { heardConf: 70, expConf: 60 })), true);
  assert.equal(lowConfidence(row('d', 'ð', true, { heardConf: 90, expConf: 10 })), false);
  assert.equal(lowConfidence(row('d', '?', true)), true);
  assert.equal(lowConfidence(row('d', 'd', false, { heardConf: 10 })), false);
  assert.equal(lowConfidence(row('t', '—', true)), false);
});

test('mainError picks the worst-scoring wrong sound', () => {
  assert.equal(mainError([row('a', 'a', false, { score: 10 }), row('d', 'ð', true, { score: 40 }), row('k', 'g', true, { score: 20 })]), 2);
  assert.equal(mainError([row('a', 'a')]), -1);
});
