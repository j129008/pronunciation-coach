// "Where exactly did I go wrong?" for one word: wrong letters located in place, neighbouring errors merged into one
// region, one short sentence per region (沒唸出來 / 多唸了 / 唸成了) and one 注音-style how-to line. No IPA in any text.
import { ipaNorm } from './phonemes.js';
import { soundLabel, artNote, zhApprox, DEL, INS } from './explain.js';

const VOWEL = new Set(['ʌ', 'ɑ', 'æ', 'ɛ', 'ɪ', 'i', 'ʊ', 'u', 'ə', 'ɚ', 'ɝ', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'ɔ', 'ɔɹ', 'ɑɹ', 'ɛɹ', 'ɪɹ', 'ʊɹ']);
const isV = p => VOWEL.has(ipaNorm(p));
const omitted = h => !h || h === '—';
// short sound name in letters: "th（this 的 th）" → "th"
export const shortSound = p => soundLabel(p).split('（')[0];

// ---- 注音 approximations, only used to anchor the how-to line ----
const ZY = {
  p: 'ㄆ', b: 'ㄅ', t: 'ㄊ', d: 'ㄉ', k: 'ㄎ', g: 'ㄍ', f: 'ㄈ', v: 'ㄈ', 'θ': 'ㄙ', 'ð': 'ㄗ', s: 'ㄙ', z: 'ㄗ', 'ʃ': 'ㄒ', 'ʒ': 'ㄖ',
  'tʃ': 'ㄑ', 'dʒ': 'ㄐ', m: 'ㄇ', n: 'ㄋ', 'ŋ': 'ㄥ', l: 'ㄌ', 'ɹ': 'ㄖ', w: 'ㄨ', j: 'ㄧ', h: 'ㄏ', 'ɾ': 'ㄉ',
  'ʌ': 'ㄚ', 'ɑ': 'ㄚ', 'æ': 'ㄝ', 'ɛ': 'ㄝ', 'ɪ': 'ㄧ', i: 'ㄧ', 'ʊ': 'ㄨ', u: 'ㄨ', 'ə': 'ㄜ', 'ɚ': 'ㄦ', 'ɝ': 'ㄦ',
  'eɪ': 'ㄟ', 'aɪ': 'ㄞ', 'ɔɪ': 'ㄛㄧ', 'aʊ': 'ㄠ', 'oʊ': 'ㄡ', 'ɔ': 'ㄛ', 'ɔɹ': 'ㄛㄦ', 'ɑɹ': 'ㄚㄦ', 'ɛɹ': 'ㄝㄦ', 'ɪɹ': 'ㄧㄦ', 'ʊɹ': 'ㄨㄦ',
};
// consonants where the 注音 letter really is a fair match (not v / th / z / r…)
const ZY_CLOSE = new Set(['p', 'b', 't', 'd', 'k', 'g', 'f', 's', 'm', 'n', 'l', 'h']);
// how to make each consonant (t+s / d+z are merged into one 「ㄘ」/「ㄗ」 action)
const ACT = {
  p: '雙唇閉住停一下', b: '雙唇閉住再輕輕彈開', t: '舌尖頂住上牙齦停一下', d: '舌尖頂住上牙齦再輕輕彈開',
  k: '舌根往上頂住停一下', g: '舌根往上頂住、喉嚨震動', ts: '快速吐出「ㄘ」', dz: '喉嚨震動吐出「ㄗ」',
  f: '上齒輕咬下唇吹出「ㄈ」', v: '上齒輕咬下唇、喉嚨震動', 'θ': '舌尖伸到上下齒間吹氣', 'ð': '舌尖伸到上下齒間、喉嚨震動',
  s: '細細吐出「ㄙ」、喉嚨不震動', z: '喉嚨震動吐出「ㄗ～」', 'ʃ': '嘟嘴吐出「噓」', 'ʒ': '嘟嘴、喉嚨震動吐出「ㄖ」',
  'tʃ': '嘟嘴吐出「ㄑ」', 'dʒ': '嘟嘴、喉嚨震動吐出「ㄐ」', m: '雙唇閉起來哼「ㄇ」', n: '舌尖頂住上牙齦收「ㄣ」',
  'ŋ': '舌根頂住收「ㄥ」', l: '舌尖頂住上牙齦', 'ɹ': '舌頭往後捲、不碰上顎', w: '嘴唇先圓成「ㄨ」再打開',
  j: '快速滑過「ㄧ」', h: '輕輕哈一口氣', 'ɾ': '舌尖輕點上牙齦一下',
};

// [start, end) positions in `word` for each row's letters; null when the letter alignment can't be mapped back.
export function letterSpans(word, rows) {
  const pos = [];
  for (let i = 0; i < (word || '').length; i++) if (/[a-z']/i.test(word[i])) pos.push(i);
  let k = 0;
  const spans = rows.map(r => {
    const n = r.let && r.let !== '·' && r.let !== '?' ? r.let.length : 0;
    const at = k < pos.length ? pos[k] : word.length;
    const s = n ? [pos[k], pos[k + n - 1] + 1] : [at, at];
    k += n;
    return s;
  });
  return k === pos.length ? spans : null;
}

// Mispronounced rows grouped into regions; errors separated by at most `gap` correct sounds are merged
// (products: c, t dropped + s→z = one region). Returns [{a, b, bad:[row indexes]}].
export function errorRegions(rows, { gap = 1 } = {}) {
  const out = [];
  rows.forEach((r, i) => {
    if (!r.bad) return;
    const last = out[out.length - 1];
    if (last && i - last.b - 1 <= gap) { last.b = i; last.bad.push(i); } else out.push({ a: i, b: i, bad: [i] });
  });
  return out;
}

const lettersOf = (r, word, sp) => (sp && sp[1] > sp[0] ? word.slice(sp[0], sp[1]) : (r.let && r.let !== '·' && r.let !== '?' ? r.let : shortSound(r.exp)));

// one error → short phrase. `alone`: the only error in its region (allows the longer 「變成拉長的 u」 form).
function phrase(r, L, alone) {
  const e = ipaNorm(r.exp), h = ipaNorm(r.heard);
  if (omitted(r.heard)) return { kind: 'omit', L, text: r.isFinal && alone ? `字尾 ${L} 沒唸出來` : `${L} 沒唸出來` };
  if (h === '?') return { kind: 'sub', text: `${L} 唸得不清楚` };
  const d = DEL[e + '|' + h];
  if (d) return { kind: 'sub', text: `${L}：${d.part}${/[a-z]$/.test(d.part) ? ' ' : ''}沒唸出來` };
  const ins = INS[e + '|' + h];
  if (ins) return { kind: 'sub', text: `${L}：多唸了${ins.part}` };
  if (!isV(e) && isV(h)) {
    // consonant heard as a vowel: at the end + "uh" = an added vowel; elsewhere it was swallowed into the vowel
    if (r.isFinal && (h === 'ə' || h === 'ʌ')) return { kind: 'sub', text: `${L} 後面多唸了「ㄜ」` };
    return alone ? { kind: 'sub', text: `${L} 沒唸出來，變成拉長的 ${shortSound(h)}` } : { kind: 'omit', L, text: `${L} 沒唸出來` };
  }
  return { kind: 'sub', text: subText(L, e, h, alone) };
}

// 注音-style name of a sound for a learner: vowels as 「短而輕的ㄧ」「ㄝ」, consonants by their letters
export const zySound = p => (isV(p) ? zhApprox(p) || ZY[ipaNorm(p)] : '') || shortSound(p);
const looksSame = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const LONG = new Set(['i', 'u', 'ɑ', 'ɝ']), SHORT = new Set(['ɪ', 'ʊ', 'ʌ', 'ɚ']);
// "X 唸成了 Y" without ever printing two sides that look alike (the letters "e" vs the sound "e" was unreadable)
export function subText(L, e, h, alone = true) {
  if (isV(e) || isV(h)) {
    const sp = x => (/^[a-z]/i.test(x) ? ' ' + x : x), E = sp(zySound(e)), H = sp(zySound(h));
    if (!looksSame(E, H)) return alone || looksSame(L, H) ? `${L} 應該唸${E}，你唸成了${H}` : `${L} 唸成了${H}（該唸${E}）`;
    if (SHORT.has(e) && LONG.has(h)) return `${L} 唸太長太用力了`;
    if (LONG.has(e) && SHORT.has(h)) return `${L} 唸太短太輕了`;
    return `${L} 唸得不夠準`;
  }
  const H = shortSound(h), E = shortSound(e);
  if (!looksSame(L, H)) return `${L} 唸成了 ${H}`;
  if (!looksSame(E, H)) return `${L} 應該唸 ${E}，你唸成了 ${H}`;
  const ZE = zhApprox(e), ZH = zhApprox(h);
  return looksSame(ZE, ZH) ? `${L} 唸得不夠準` : `${L} 應該唸${ZE}，你唸成了${ZH}`;
}

// "-ducts": the error region plus the syllable start before it, with '-' where the word continues
function regionLabel(word, rows, spans, reg) {
  let s = reg.a;
  while (s > 0 && !isV(rows[s - 1].exp)) s--; // consonants before the region (back to the previous vowel)
  if (s > 0) { s--; if (s > 0 && !isV(rows[s - 1].exp)) s--; } // that vowel + its leading consonant
  if (!spans) return '';
  const from = spans[s][0], to = spans[reg.b][1];
  const body = word.slice(from, to);
  return body ? (from > 0 ? '-' : '') + body + (to < word.length ? '-' : '') : '';
}

export function regionSentence(word, rows, reg, spans = letterSpans(word, rows)) {
  const alone = reg.bad.length === 1;
  const ps = reg.bad.map(i => phrase(rows[i], lettersOf(rows[i], word, spans && spans[i]), alone));
  if (alone) return ps[0].text;
  // in word order; neighbouring dropped sounds merge into one 「c、t 沒唸出來」
  const parts = [];
  let om = null;
  for (const p of ps) {
    if (p.kind !== 'omit') { om = null; parts.push(p.text); continue; }
    if (om) { om.push(p.L); parts[parts.length - 1] = `${om.join('、')} 沒唸出來`; } else { om = [p.L]; parts.push(p.text.replace(/^字尾 /, '')); }
  }
  const label = regionLabel(word, rows, spans, reg);
  return (label ? `${label}：` : '') + parts.join('，');
}

// 「ㄉㄜ」後舌根往上頂住停一下，再快速吐出「ㄘ」
// stress note for a vowel row, only when the reference pronunciation told us (see stress.js) and the region
// contains a mispronounced unstressed vowel — that is when 「輕讀／重音」 actually helps
const stressNote = r => (r.stress === 0 ? '（輕讀）' : r.stress === 1 ? '（重音，唸重一點）' : '');
function needsStress(rows, reg) {
  return rows.slice(reg.a, reg.b + 1).some(r => r.bad && r.stress === 0 && isV(r.exp) && !['ə', 'ɪ', 'ɚ'].includes(ipaNorm(r.heard)));
}
// where the main stress is, as letters: "-fer"
export function stressedPart(word, rows) {
  const k = rows.findIndex(r => r.stress === 1);
  const sp = letterSpans(word, rows);
  if (k < 0 || !sp || rows.filter(r => isV(r.exp)).length < 2) return '';
  let a = k;
  while (a > 0 && !isV(rows[a - 1].exp)) a--;
  if (k - a >= 2 && a > 0) a++; // keep one consonant with the previous syllable when there are several
  let b = k;
  while (b + 1 < rows.length && !isV(rows[b + 1].exp) && (b + 2 >= rows.length || !isV(rows[b + 2].exp))) b++;
  const from = sp[a][0], to = sp[b][1];
  return (from > 0 ? '-' : '') + word.slice(from, to) + (to < word.length ? '-' : '');
}

export function regionHowTo(rows, reg) {
  const exps = rows.slice(reg.a, reg.b + 1).map(r => ipaNorm(r.exp));
  const st = needsStress(rows, reg);
  if (exps.length === 1 && isV(exps[0])) {
    const r = rows[reg.a];
    return `唸${zySound(exps[0])}${st ? stressNote(r) : ''}：${artNote(r.exp)}`;
  }
  const acts = [];
  for (let i = 0; i < exps.length; i++) {
    const p = exps[i], q = exps[i + 1];
    if ((p === 't' && q === 's') || (p === 'd' && q === 'z')) { acts.push(ACT[p + q]); i++; continue; }
    acts.push(isV(p) ? `唸${zhApprox(p) || `「${ZY[p] || ''}」`}${st ? stressNote(rows[reg.a + i]) : ''}` : (ACT[p] || `唸出 ${shortSound(p)}`));
  }
  if (exps.length === 1 && ZY_CLOSE.has(exps[0]) && !acts[0].includes('「')) acts[0] += `（像「${ZY[exps[0]]}」）`;
  // anchor: the sounds just before the region, back to (and including) the previous vowel's syllable
  let s = reg.a;
  while (s > 0 && !isV(rows[s - 1].exp)) s--;
  if (s > 0) { s--; if (s > 0 && !isV(rows[s - 1].exp)) s--; }
  const anchor = rows.slice(s, reg.a).map(r => ZY[ipaNorm(r.exp)] || '').join('');
  return (anchor ? `「${anchor}」後` : '') + acts.join('，再');
}

// Everything the explanation card needs for one analyzed word (analyzeWord output).
// segments: [{text, bad, sound}] covering the whole word (zero-width bad segments mark a sound with no letters).
export function wordFix(w) {
  const rows = w.rows || [], word = w.word || '';
  const spans = letterSpans(word, rows);
  const regions = errorRegions(rows).map(reg => {
    let howto = regionHowTo(rows, reg);
    const sp = needsStress(rows, reg) && !rows.slice(reg.a, reg.b + 1).some(r => r.stress === 1) && stressedPart(word, rows);
    if (sp) howto += `；重音在 ${sp}`;
    return { ...reg, sentence: regionSentence(word, rows, reg, spans), howto };
  });
  const segments = [];
  if (!spans) segments.push({ text: word, bad: false });
  else {
    let at = 0;
    rows.forEach((r, i) => {
      const [s, e] = spans[i];
      if (!r.bad) return;
      if (s > at) segments.push({ text: word.slice(at, s), bad: false });
      segments.push({ text: word.slice(s, e), bad: true, sound: shortSound(r.exp), row: i });
      at = Math.max(at, e);
    });
    if (at < word.length) segments.push({ text: word.slice(at), bad: false });
  }
  return { segments, regions };
}
