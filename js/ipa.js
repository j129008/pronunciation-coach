// IPA learning data: inventory grouped for the 音標教學 panel, example words, confusable sounds,
// the "frequently missed" ranking, a tokenizer for IPA strings, and quiz generation. Pure (no DOM).
import { ipaNorm, IPA_N } from './phonemes.js';
import { ART, soundLabel, zhApprox, artNote, CONF, DEL, INS } from './explain.js';

export const GROUPS = [
  { id: 'vowel', title: '母音', subs: [
    { title: '單母音（嘴型固定不動）', syms: ['i', 'ɪ', 'ɛ', 'æ', 'ɑ', 'ɔ', 'ʊ', 'u', 'ʌ', 'ə'] },
    { title: '捲舌母音（整個音帶捲舌）', syms: ['ɝ', 'ɚ'] },
  ] },
  { id: 'diph', title: '雙母音', subs: [
    { title: '雙母音（嘴型從 A 滑到 B）', syms: ['eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ'] },
    { title: '母音＋r（先唸母音，舌頭再捲起來）', syms: ['ɪɹ', 'ɛɹ', 'ʊɹ', 'ɔɹ', 'ɑɹ'] },
  ] },
  { id: 'cons', title: '子音', subs: [
    { title: '清音／濁音成對（左：喉嚨不震動，右：喉嚨震動）', syms: ['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 's', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'θ', 'ð'], pairs: true },
    { title: '鼻音', syms: ['m', 'n', 'ŋ'] },
    { title: '其他子音', syms: ['l', 'ɹ', 'w', 'j', 'h', 'ɾ', 'ʔ'] },
  ] },
];
export const ALL = GROUPS.flatMap(g => g.subs.flatMap(s => s.syms));
const CONS = new Set(GROUPS.find(g => g.id === 'cons').subs.flatMap(s => s.syms));

// 3 example words each; chosen so that the ONLY sound all three share is the target (quiz relies on this)
export const WORDS = {
  i: ['see', 'eat', 'key'], 'ɪ': ['sit', 'big', 'ship'], 'ɛ': ['bed', 'pen', 'egg'], 'æ': ['cat', 'bad', 'apple'], 'ɑ': ['hot', 'father', 'stop'],
  'ɔ': ['law', 'thought', 'coffee'], 'ʊ': ['book', 'good', 'put'], u: ['food', 'blue', 'too'], 'ʌ': ['cup', 'but', 'love'], 'ə': ['about', 'banana', 'sofa'],
  'ɝ': ['bird', 'work', 'her'], 'ɚ': ['teacher', 'doctor', 'water'],
  'eɪ': ['day', 'make', 'rain'], 'aɪ': ['my', 'like', 'time'], 'ɔɪ': ['boy', 'coin', 'toy'], 'aʊ': ['now', 'out', 'house'], 'oʊ': ['go', 'home', 'know'],
  'ɪɹ': ['here', 'near', 'beer'], 'ɛɹ': ['care', 'hair', 'there'], 'ʊɹ': ['tour', 'pure', 'poor'], 'ɔɹ': ['more', 'door', 'four'], 'ɑɹ': ['car', 'start', 'far'],
  p: ['pen', 'paper', 'stop'], b: ['bed', 'baby', 'job'], t: ['time', 'ten', 'cat'], d: ['dog', 'day', 'red'], k: ['cat', 'key', 'black'], g: ['go', 'good', 'big'],
  f: ['fish', 'coffee', 'life'], v: ['very', 'love', 'video'], s: ['see', 'city', 'bus'], z: ['zoo', 'busy', 'easy'],
  'ʃ': ['she', 'shoe', 'wash'], 'ʒ': ['vision', 'usually', 'measure'], 'tʃ': ['chair', 'watch', 'teacher'], 'dʒ': ['job', 'age', 'judge'],
  'θ': ['think', 'three', 'bath'], 'ð': ['this', 'that', 'mother'],
  m: ['man', 'summer', 'come'], n: ['no', 'dinner', 'sun'], 'ŋ': ['sing', 'long', 'thinking'],
  l: ['let', 'hello', 'call'], 'ɹ': ['red', 'very', 'sorry'], w: ['we', 'water', 'away'], j: ['yes', 'you', 'million'], h: ['hat', 'who', 'behind'],
  'ɾ': ['water', 'better', 'city'], 'ʔ': ['button', 'mountain', 'kitten'],
};
const NOT_QUIZZED_BY_EAR = new Set(['ʔ']); // its example words also share an "n", so a listening question would be ambiguous

export function voicing(sym) {
  const k = ipaNorm(sym);
  if (!CONS.has(k) || !ART[k]) return null;
  return ART[k][1] ? '濁音（喉嚨震動）' : '清音（喉嚨不震動）';
}

// sounds Mandarin speakers mix this one up with, derived from the confusion tables (both directions)
export function confusables(sym) {
  const key = ipaNorm(sym), out = [];
  for (const k of [...Object.keys(CONF), ...Object.keys(DEL), ...Object.keys(INS)]) {
    const [a, b] = k.split('|');
    const other = a === key ? b : b === key ? a : null;
    if (other && ALL.includes(other) && !out.includes(other)) out.push(other);
  }
  return out.slice(0, 4);
}

// everything the tooltip card / panel card needs about one sound
export function phInfo(sym) {
  const key = ipaNorm(sym);
  if (!ALL.includes(key)) return { key, known: false };
  const conf = confusables(key);
  const first = conf.map(h => CONF[key + '|' + h]).find(Boolean);
  return {
    key, known: true, label: soundLabel(key), zh: zhApprox(key), words: WORDS[key] || [], tip: artNote(key),
    voicing: voicing(key), confuse: conf, confuseNote: first ? first.desc : '',
  };
}

// ---- frequently-missed ranking (confusion stats from Azure runs + wrong quiz answers) ----
export function missRanking(conf = {}, quiz = {}) {
  const m = {};
  for (const [k, v] of Object.entries(conf)) { const key = ipaNorm(k.split('→')[0]); m[key] = (m[key] || 0) + (v.n || 0); }
  for (const [sym, v] of Object.entries(quiz)) { const key = ipaNorm(sym); m[key] = (m[key] || 0) + (v.bad || 0); }
  return m;
}
export const sortByMiss = (syms, miss) => syms.map((s, i) => [s, i]).sort((a, b) => (miss[b[0]] || 0) - (miss[a[0]] || 0) || a[1] - b[1]).map(x => x[0]);

// ---- split an IPA string into symbols (for per-symbol tooltips); stress marks stay plain text ----
const KNOWN = [...new Set([...ALL, ...Object.keys(IPA_N)])].sort((a, b) => b.length - a.length);
export function tokenizeIpa(str) {
  const s = String(str || ''), out = [];
  let i = 0;
  while (i < s.length) {
    const m = KNOWN.find(k => s.startsWith(k, i));
    if (m) {
      let j = i + m.length;
      while (j < s.length && 'ːˑ'.includes(s[j])) j++;
      out.push({ sym: s.slice(i, j) });
      i = j;
    } else { out.push({ txt: s[i] }); i++; }
  }
  return out;
}

// ---- quiz ----
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const related = (a, b) => a === b || a.includes(b) || b.includes(a);

// Alternates 聽字選符號 (hear 3 words → which symbol do they share?) and 符號配注音 (symbol → which description?).
// Sounds you miss often are asked more often. Deterministic given `rnd`.
export function buildQuiz(n = 10, rnd = Math.random, miss = {}) {
  const qs = [];
  let last = null;
  for (let i = 0; i < n; i++) {
    const type = i % 2 === 0 ? 'words' : 'zh';
    const pool = ALL.filter(s => s !== last && !(type === 'words' && NOT_QUIZZED_BY_EAR.has(s)));
    const total = pool.reduce((a, s) => a + 1 + 2 * (miss[s] || 0), 0);
    let r = rnd() * total, sym = pool[pool.length - 1];
    for (const s of pool) { r -= 1 + 2 * (miss[s] || 0); if (r < 0) { sym = s; break; } }
    last = sym;
    if (type === 'words') {
      const cand = [...confusables(sym), ...shuffle(ALL, rnd)].filter(s => !related(s, sym) && s !== 'ʔ');
      const options = shuffle([sym, ...[...new Set(cand)].slice(0, 3)], rnd);
      qs.push({ type, sym, words: WORDS[sym], options, answer: sym });
    } else {
      const own = zhApprox(sym);
      const cand = shuffle(ALL.filter(s => zhApprox(s) !== own), rnd);
      const seen = new Set([own]), opts = [];
      for (const s of cand) { const z = zhApprox(s); if (!seen.has(z)) { seen.add(z); opts.push(z); } if (opts.length === 3) break; }
      qs.push({ type, sym, word: WORDS[sym][0], options: shuffle([own, ...opts], rnd), answer: own });
    }
  }
  return qs;
}
