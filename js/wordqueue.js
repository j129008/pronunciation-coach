// Word practice: which words of a sentence were mispronounced, whether a single-word take is good enough,
// and the persisted "要練的字" queue (localStorage) that keeps each word with the sentence it came from.
import { lsGet } from './util.js';

export const wordKey = w => String(w || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '');
export const PASS = 80; // Azure word accuracy needed to call a single-word take OK

// Azure word results (analyzeWord output) → mispronounced words in sentence order, unique
export function badWordsAzure(words) {
  const out = [], seen = new Set();
  for (const w of words || []) {
    if (!w || w.et === 'Insertion') continue;
    const bad = w.et === 'Omission' || (w.rows || []).some(r => r.bad) || (w.score != null && w.score < PASS);
    const k = wordKey(w.word);
    if (bad && k && !seen.has(k)) { seen.add(k); out.push({ w: w.word, k }); }
  }
  return out;
}
// Web Speech alignment (scoreHyp().disp) → mispronounced / missed words, unique
export function badWordsText(disp) {
  const out = [], seen = new Set();
  for (const x of disp || []) {
    if (x.s !== 'bad' && x.s !== 'miss') continue;
    for (const t of String(x.d || x.t || '').split(/\s+/)) {
      const k = wordKey(t);
      if (k && !seen.has(k)) { seen.add(k); out.push({ w: t.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, ''), k, heard: x.h || '' }); }
    }
  }
  return out;
}

// One Azure single-word assessment → {ok, w (analyzed word or null), score}
export function judgeAzureWord(words, target) {
  const k = wordKey(target);
  const w = (words || []).find(x => x.et !== 'Insertion' && wordKey(x.word) === k) || null;
  if (!w || w.et === 'Omission') return { ok: false, w, score: 0 };
  const score = w.score == null ? 0 : Math.round(w.score);
  return { ok: score >= PASS && !(w.rows || []).some(r => r.bad), w, score };
}
// Web Speech alternatives for a single-word take → {ok, heard}
export function judgeSpeechWord(alts, target) {
  const k = wordKey(target);
  const list = (alts || []).map(a => String(a || '').trim()).filter(Boolean);
  const hit = list.find(a => a.split(/\s+/).map(wordKey).includes(k));
  return { ok: !!hit, heard: hit || list[0] || '' };
}

// The sentence with the practised word marked: [{text, hit}]
export function markWord(sentence, word) {
  const k = wordKey(word), parts = [];
  let hitDone = false;
  for (const tok of String(sentence || '').split(/(\s+)/)) {
    const hit = !hitDone && !!k && wordKey(tok) === k;
    if (hit) hitDone = true;
    const last = parts[parts.length - 1];
    if (!hit && last && !last.hit) last.text += tok; else parts.push({ text: tok, hit });
  }
  return parts;
}

// ---- the queue (pure functions on an array of entries) ----
// entry: {k, w, id, s (sentence), heard, miss, t (last miss time)}
const same = (a, k, id) => a.k === k && a.id === id;
export function addMisses(queue, { id, sentence, words }, now = Date.now()) {
  const q = queue.slice();
  for (const x of words || []) {
    const k = x.k || wordKey(x.w);
    if (!k) continue;
    const i = q.findIndex(a => same(a, k, id));
    if (i >= 0) q[i] = { ...q[i], miss: q[i].miss + 1, t: now, heard: x.heard || q[i].heard || '' };
    else q.push({ k, w: x.w, id, s: sentence, heard: x.heard || '', miss: 1, t: now });
  }
  return q;
}
// a word practised until OK leaves the queue (for that sentence)
export const removeWord = (queue, id, word) => queue.filter(a => !same(a, wordKey(word), id));
// most-missed first, then most recent
export const sortQueue = queue => queue.slice().sort((a, b) => b.miss - a.miss || b.t - a.t);
export const queueFor = (queue, id) => queue.filter(a => a.id === id);

export const loadQueue = () => { const q = lsGet('wordQueue', []); return Array.isArray(q) ? q : []; };
export const saveQueue = q => { localStorage.wordQueue = JSON.stringify(q.slice(-300)); };
