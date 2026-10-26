import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL, GROUPS, WORDS, phInfo, confusables, voicing, missRanking, sortByMiss, tokenizeIpa, buildQuiz } from '../js/ipa.js';
import { ART } from '../js/explain.js';
import { ipaNorm } from '../js/phonemes.js';

// small deterministic PRNG
const seeded = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

test('inventory: every sound has 3 example words, a 注音 approximation, a mouth tip', () => {
  assert.deepEqual([...new Set(ALL)].sort(), Object.keys(ART).sort(), 'ART and the panel inventory cover the same sounds');
  for (const sym of ALL) {
    const x = phInfo(sym);
    assert.ok(x.known, sym);
    assert.equal(x.words.length, 3, sym);
    assert.ok(x.words.every(w => /^[a-z]+$/.test(w)), sym);
    assert.ok(x.zh && x.tip && x.label, sym);
  }
  assert.deepEqual(GROUPS.map(g => g.title), ['母音', '雙母音', '子音']);
});

test('voiced/voiceless pairs are adjacent and labelled', () => {
  const pairs = GROUPS[2].subs[0];
  assert.ok(pairs.pairs);
  for (let i = 0; i < pairs.syms.length; i += 2) {
    assert.match(voicing(pairs.syms[i]), /^清音/, pairs.syms[i]);
    assert.match(voicing(pairs.syms[i + 1]), /^濁音/, pairs.syms[i + 1]);
  }
  assert.equal(voicing('i'), null);
});

test('confusables come from the Mandarin-speaker confusion tables, both directions', () => {
  assert.ok(confusables('θ').includes('s'));
  assert.ok(confusables('s').includes('θ'));
  assert.ok(confusables('ɔɹ').includes('ɔ'));
  assert.ok(confusables('d').includes('t'));
  assert.ok(confusables('θ').length <= 4);
  assert.ok(phInfo('l').confuse.includes('n'));
  assert.match(phInfo('θ').confuseNote, /ㄙ/);
});

test('phInfo normalises variants and survives unknown symbols', () => {
  assert.equal(phInfo('iː').key, 'i');
  assert.equal(phInfo('r').key, 'ɹ');
  assert.equal(phInfo('☃').known, false);
});

test('tokenizeIpa splits an IPA string into symbols for tooltips', () => {
  const t = s => tokenizeIpa(s).map(x => x.sym || `(${x.txt})`).join(' ');
  assert.equal(t('ʌmbɹˈɛlə'), 'ʌ m b ɹ (ˈ) ɛ l ə');
  assert.equal(t('θˈɜːɹoʊli'), 'θ (ˈ) ɜː ɹ oʊ l i');
  assert.equal(t('tʃɛɹ'), 'tʃ ɛɹ');
  assert.equal(t(''), '');
  assert.equal(ipaNorm(tokenizeIpa('ɜː')[0].sym), 'ɝ');
});

test('missRanking merges Azure confusion counts and wrong quiz answers; missed sounds sort first', () => {
  const m = missRanking({ 'θ→s': { n: 4 }, 'd→t': { n: 1 }, 'r→l': { n: 2 } }, { θ: { ok: 1, bad: 2 }, v: { ok: 0, bad: 1 } });
  assert.equal(m['θ'], 6);
  assert.equal(m['d'], 1);
  assert.equal(m['ɹ'], 2); // 'r' normalised to 'ɹ'
  assert.equal(m['v'], 1);
  assert.deepEqual(sortByMiss(['s', 'd', 'θ', 'ɹ', 'z'], m), ['θ', 'ɹ', 'd', 's', 'z']);
});

test('quiz: 10 questions alternate types; options are sane and contain the answer', () => {
  const qs = buildQuiz(10, seeded(7), { θ: 5 });
  assert.equal(qs.length, 10);
  qs.forEach((q, i) => {
    assert.equal(q.type, i % 2 ? 'zh' : 'words');
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.includes(q.answer));
    if (q.type === 'words') {
      assert.equal(q.words.length, 3);
      assert.notEqual(q.sym, 'ʔ');
      // no distractor symbol may be contained in / contain the answer (e.g. aɪ vs ɪ)
      for (const o of q.options.filter(o => o !== q.answer)) assert.ok(!o.includes(q.answer) && !q.answer.includes(o), `${o} vs ${q.answer}`);
    } else {
      assert.ok(WORDS[q.sym].includes(q.word));
    }
  });
});

test('quiz favours sounds you miss', () => {
  const heavy = { 'ʒ': 50 };
  let hits = 0;
  for (let s = 1; s <= 30; s++) hits += buildQuiz(10, seeded(s), heavy).filter(q => q.sym === 'ʒ').length;
  const plain = (() => { let h = 0; for (let s = 1; s <= 30; s++) h += buildQuiz(10, seeded(s)).filter(q => q.sym === 'ʒ').length; return h; })();
  assert.ok(hits > plain * 3, `${hits} vs ${plain}`);
});
