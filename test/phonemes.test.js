import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ipaNorm, ipaInfo, ipaHint, alignLetters, analyzeWord, phTip } from '../js/phonemes.js';
import { segmentRange, TICKS } from '../js/playback.js';

test('ipaNorm maps variants to the keys used by the hint table', () => {
  assert.equal(ipaNorm('iː'), 'i');
  assert.equal(ipaNorm('ˈɜː'), 'ɝ');
  assert.equal(ipaNorm('r'), 'ɹ');
  assert.equal(ipaNorm('ɡ'), 'g');
  assert.equal(ipaInfo('θ').w, 'think');
  assert.equal(ipaInfo('☃'), null);
  assert.match(ipaHint('θ'), /think/);
});

test('alignLetters maps letters onto phonemes', () => {
  assert.deepEqual(alignLetters('think', ['θ', 'ɪ', 'ŋ', 'k']), ['th', 'i', 'n', 'k']);
  assert.deepEqual(alignLetters('', ['θ']), ['?']);
});

test('analyzeWord extracts offsets and flags bad phonemes', () => {
  const w = analyzeWord({
    Word: 'think', Offset: 1000000, Duration: 4000000,
    PronunciationAssessment: { AccuracyScore: 55, ErrorType: 'Mispronunciation' },
    Phonemes: [
      { Phoneme: 'θ', Offset: 1000000, Duration: 800000, PronunciationAssessment: { AccuracyScore: 20, NBestPhonemes: [{ Phoneme: 's', Score: 70 }, { Phoneme: 'θ', Score: 20 }] } },
      { Phoneme: 'ɪ', Offset: 1800000, Duration: 900000, PronunciationAssessment: { AccuracyScore: 95, NBestPhonemes: [{ Phoneme: 'ɪ', Score: 95 }] } },
    ],
  });
  assert.equal(w.rows.length, 2);
  assert.deepEqual([w.rows[0].exp, w.rows[0].heard, w.rows[0].bad], ['θ', 's', true]);
  assert.equal(w.rows[1].bad, false);
  assert.equal(w.rows[0].off, 1000000);
  assert.equal(w.rows[1].isFinal, true);
  assert.match(phTip('θ', 's', false, 'think'), /θ/);
});

test('analyzeWord marks every phoneme of an omitted word as missing', () => {
  const w = analyzeWord({ Word: 'a', PronunciationAssessment: { ErrorType: 'Omission' }, Phonemes: [{ Phoneme: 'ə', PronunciationAssessment: { AccuracyScore: 0 } }] });
  assert.equal(w.rows[0].heard, '—');
  assert.equal(w.rows[0].bad, true);
});

test('segmentRange converts Azure ticks to a padded sample range', () => {
  const rg = segmentRange(1 * TICKS, 0.5 * TICKS, 16000, 160000, { pad: 0.1 });
  assert.deepEqual(rg, { s0: 14400, s1: 25600 });
});

test('segmentRange widens very short phonemes and clamps to the buffer', () => {
  const rg = segmentRange(0.5 * TICKS, 0.02 * TICKS, 1000, 10000, { pad: 0, minLen: 0.2 });
  assert.equal((rg.s1 - rg.s0) / 1000, 0.2);
  assert.deepEqual(segmentRange(-1 * TICKS, 0.1 * TICKS, 1000, 500, { pad: 0.05, minLen: 0.01 }), null);
  const edge = segmentRange(0, 0.1 * TICKS, 1000, 50, { pad: 0.5 });
  assert.deepEqual(edge, { s0: 0, s1: 50 });
});

test('segmentRange rejects missing/invalid timing instead of throwing later', () => {
  assert.equal(segmentRange(undefined, 1, 16000, 100), null);
  assert.equal(segmentRange(1, NaN, 16000, 100), null);
  assert.equal(segmentRange(1, -5, 16000, 100), null);
  assert.equal(segmentRange(1, 1, 0, 100), null);
});

test('segmentRange default padding is 120 ms each side', () => {
  const rg = segmentRange(1 * TICKS, 0.5 * TICKS, 1000, 10000);
  assert.deepEqual(rg, { s0: 880, s1: 1620 });
});
