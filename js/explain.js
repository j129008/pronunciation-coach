// Plain-language feedback for Mandarin speakers who cannot read IPA.
// IPA symbols are only used as lookup keys here — nothing in the returned text contains them.
// Every explanation = verdict (少唸了 / 多唸了 / 唸成別的音) + concrete fix + minimal pairs;
// respellWord() gives the "整個字聽起來像" comparison.
import { ipaNorm, IPA } from './phonemes.js';

// ---- how to write a sound with ordinary English letters ----
const RESPELL = {
  'ʌ': 'u', 'ɑ': 'ah', 'æ': 'a', 'ɛ': 'e', 'ɪ': 'i', 'i': 'ee', 'ʊ': 'oo', 'u': 'oo', 'ə': 'uh', 'ɚ': 'er', 'ɝ': 'er',
  'eɪ': 'ay', 'aɪ': 'eye', 'ɔɪ': 'oy', 'aʊ': 'ow', 'oʊ': 'oh', 'ɔ': 'aw',
  'ɔɹ': 'or', 'ɑɹ': 'ar', 'ɛɹ': 'air', 'ɪɹ': 'eer', 'ʊɹ': 'oor',
  'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g', 'f': 'f', 'v': 'v', 'θ': 'th', 'ð': 'dh', 's': 's', 'z': 'z',
  'ʃ': 'sh', 'ʒ': 'zh', 'tʃ': 'ch', 'dʒ': 'j', 'm': 'm', 'n': 'n', 'ŋ': 'ng', 'l': 'l', 'ɹ': 'r', 'w': 'w', 'j': 'y', 'h': 'h', 'ɾ': 'd', 'ʔ': "'",
};
const VOWELS = new Set(['ʌ', 'ɑ', 'æ', 'ɛ', 'ɪ', 'i', 'ʊ', 'u', 'ə', 'ɚ', 'ɝ', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'ɔ', 'ɔɹ', 'ɑɹ', 'ɛɹ', 'ɪɹ', 'ʊɹ']);
const SHORT_V = new Set(['u', 'a', 'e', 'i', 'o']);
const DOUBLE_END = new Set(['f', 'l', 's', 'z']);

// One sound → letters (schwa before "l" reads better as "u": bul)
function spellOne(ph, nextPh) {
  const n = ipaNorm(ph);
  if (n === 'ə' && nextPh && ipaNorm(nextPh) === 'l') return 'u';
  return RESPELL[n] || n;
}

// Flat respelling (no syllables). Omitted sounds ('—' / empty) are skipped.
export function respell(phs) {
  const ps = phs.filter(p => p && p !== '—');
  const parts = ps.map((p, i) => spellOne(p, ps[i + 1]));
  const n = parts.length;
  if (n >= 2 && DOUBLE_END.has(parts[n - 1]) && SHORT_V.has(parts[n - 2])) parts[n - 1] += parts[n - 1];
  return parts.join('');
}

// Whole-word respelling split into syllables; the syllable(s) containing an error are UPPERCASE.
// rows: [{exp, heard, bad}] as produced by analyzeWord. Returns {target, said, differs}.
export function respellWord(rows) {
  const n = rows.length;
  const exps = rows.map(r => ipaNorm(r.exp));
  const saids = rows.map(r => (r.bad ? ((!r.heard || r.heard === '—') ? null : ipaNorm(r.heard)) : ipaNorm(r.exp)));
  // syllable boundaries come from the target: one nucleus per syllable, lone consonant starts the next one
  const nuc = exps.map((e, i) => VOWELS.has(e) ? i : -1).filter(i => i >= 0);
  const starts = [];
  for (let k = 0; k + 1 < nuc.length; k++) {
    const c = nuc[k + 1] - nuc[k] - 1;
    starts.push(c === 0 ? nuc[k + 1] : c === 1 ? nuc[k] + 1 : nuc[k] + 2);
  }
  const sylOf = i => starts.filter(b => b <= i).length;
  const build = seq => {
    const sy = [];
    for (let i = 0; i < n; i++) {
      if (seq[i] == null) continue;
      const nextPh = seq.slice(i + 1).find(x => x != null);
      const s = sylOf(i);
      sy[s] = sy[s] || { t: '', bad: false };
      sy[s].t += spellOne(seq[i], nextPh);
    }
    rows.forEach((r, i) => { if (r.bad) { const s = sylOf(i); sy[s] = sy[s] || { t: '', bad: true }; sy[s].bad = true; } });
    return sy.filter(x => x && x.t).map(x => x.bad ? x.t.toUpperCase() : x.t).join('-');
  };
  const target = build(exps), said = build(saids);
  return { target, said, differs: target !== said };
}

// ---- sound names for plain sentences: [label with example word, 注音-ish approximation] ----
const SN = {
  p: ['p', 'ㄆ'], b: ['b', 'ㄅ（喉嚨要震動）'], t: ['t', 'ㄊ'], d: ['d', 'ㄉ（喉嚨要震動）'], k: ['k', 'ㄎ'], g: ['g', 'ㄍ（喉嚨要震動）'],
  f: ['f', 'ㄈ'], v: ['v', 'ㄈ加喉嚨震動'], 'θ': ['th（think 的 th）', '舌尖在牙齒間的ㄙ'], 'ð': ['th（this 的 th）', '舌尖在牙齒間、有震動的ㄗ'],
  s: ['s', 'ㄙ'], z: ['z', 'ㄗ（喉嚨要震動）'], 'ʃ': ['sh', '嘟嘴的「噓」'], 'ʒ': ['zh（vision 的 s）', '嘟嘴有震動的「ㄖ」'],
  'tʃ': ['ch', '嘟嘴的ㄑ'], 'dʒ': ['j', '嘟嘴有震動的ㄐ'], m: ['m', 'ㄇ'], n: ['n', 'ㄋ'], 'ŋ': ['ng', 'ㄥ'], l: ['l', 'ㄌ'],
  'ɹ': ['r', '舌頭往後捲的 r，不是中文的ㄖ'], w: ['w', '快速的ㄨ'], j: ['y', '快速的ㄧ'], h: ['h', '輕輕的ㄏ'],
  'ɾ': ['輕彈的 t/d', '輕輕彈一下的ㄉ'], 'ʔ': ['喉嚨卡一下', '喉嚨卡一下'],
  'ʌ': ['u（cup 的 u）', '短短的ㄚ'], 'ɑ': ['o（hot 的 o）', '大開口的ㄚ'], 'æ': ['a（cat 的 a）', 'ㄝ和ㄚ之間'], 'ɛ': ['e（bed 的 e）', 'ㄝ'],
  'ɪ': ['i（sit 的 i）', '短的ㄧ'], i: ['ee（see 的 ee）', '長的ㄧ'], 'ʊ': ['oo（book 的 oo）', '短的ㄨ'], u: ['oo（food 的 oo）', '長的ㄨ'],
  'ə': ['a（about 的 a）', '輕輕的ㄜ'], 'ɚ': ['er（teacher 的 er）', '輕輕的ㄦ'], 'ɝ': ['er（bird 的 er）', 'ㄦ'],
  'eɪ': ['ay（day 的 ay）', 'ㄟ'], 'aɪ': ['i（my 的 i）', 'ㄞ'], 'ɔɪ': ['oy（boy 的 oy）', 'ㄛㄧ'], 'aʊ': ['ow（now 的 ow）', 'ㄠ'],
  'oʊ': ['o（go 的 o）', 'ㄡ'], 'ɔ': ['aw（law 的 aw）', 'ㄛ'],
  'ɔɹ': ['or（more 的 or）', 'ㄛ兒'], 'ɑɹ': ['ar（car 的 ar）', 'ㄚ兒'], 'ɛɹ': ['air（care 的 air）', 'ㄝ兒'], 'ɪɹ': ['ear（here 的 ear）', 'ㄧ兒'], 'ʊɹ': ['oor（tour 的 oor）', 'ㄨ兒'],
};
export const soundLabel = ph => (SN[ipaNorm(ph)] || [ipaNorm(ph)])[0];
const zh = ph => (SN[ipaNorm(ph)] || ['', ''])[1];

// ---- articulation notes (mouth / tongue / voicing) ----
export const ART = {
  p: ['雙唇閉緊後爆開，送出一口氣', 0], b: ['雙唇閉緊後爆開', 1],
  t: ['舌尖頂上牙齦後彈開，送出一口氣', 0], d: ['舌尖頂上牙齦後輕輕彈開', 1],
  k: ['舌根頂住喉嚨上方後爆開，送出一口氣', 0], g: ['舌根頂住喉嚨上方後爆開', 1],
  f: ['上排牙齒輕咬下唇，氣從縫隙擠出', 0], v: ['上排牙齒輕咬下唇，氣從縫隙擠出', 1],
  'θ': ['舌尖放在上下牙齒之間，氣從縫隙吹出', 0], 'ð': ['舌尖放在上下牙齒之間，氣從縫隙吹出', 1],
  s: ['舌尖靠近上牙齦、嘴角拉開，氣流細而尖', 0], z: ['舌尖靠近上牙齦、嘴角拉開，氣流細而尖', 1],
  'ʃ': ['嘴唇嘟起往前、舌面抬高後縮，氣流寬而柔', 0], 'ʒ': ['嘴唇嘟起往前、舌面抬高後縮，氣流寬而柔', 1],
  'tʃ': ['舌面先貼上顎再放開，嘴唇嘟起（像「ㄑ」）', 0], 'dʒ': ['舌面先貼上顎再放開，嘴唇微嘟（像有聲的「ㄐ」）', 1],
  m: ['雙唇閉合，氣從鼻腔出', 1], n: ['舌尖頂上牙齦，氣從鼻腔出', 1], 'ŋ': ['舌根頂住喉嚨上方，氣從鼻腔出（像「ㄥ」）', 1],
  l: ['舌尖頂上牙齦，氣從舌頭兩側流出', 1], 'ɹ': ['舌尖往後捲起但不碰上顎，嘴唇微圓', 1],
  w: ['嘴唇先圓起再快速放開，牙齒不碰嘴唇', 1], j: ['舌面貼近上顎，快速滑向後面的母音', 1], h: ['喉嚨輕輕送氣，嘴型跟著後面的母音', 0],
  'ɾ': ['舌尖快速輕點上牙齦一下', 1], 'ʔ': ['喉嚨瞬間閉住再放開', 0],
  'ʌ': ['嘴巴半開、放鬆短促', 1], 'ɑ': ['嘴巴張很大、舌頭放低往後', 1], 'æ': ['嘴角往兩側拉、下巴降低，介於「ㄝ」和「ㄚ」之間', 1],
  'ɛ': ['嘴巴微開、短促的「ㄝ」', 1], 'ɪ': ['嘴角放鬆、短促，舌位比 see 的 ee 低一點', 1], i: ['嘴角用力往兩側拉、拉長', 1],
  'ʊ': ['嘴唇微圓、放鬆短促', 1], u: ['嘴唇用力嘟圓、拉長', 1], 'ə': ['嘴巴放鬆、最輕最弱的「ㄜ」', 1],
  'ɚ': ['舌頭捲起、不碰上顎的輕捲舌母音', 1], 'ɝ': ['舌頭捲起、不碰上顎，整個母音帶捲舌', 1],
  'eɪ': ['雙母音：從「ㄝ」滑到「ㄧ」，嘴角漸漸拉開', 1], 'aɪ': ['雙母音：從「ㄚ」滑到「ㄧ」', 1], 'ɔɪ': ['雙母音：從圓唇的「ㄛ」滑到「ㄧ」', 1],
  'aʊ': ['雙母音：從「ㄚ」滑到「ㄨ」，嘴唇漸漸收圓', 1], 'oʊ': ['雙母音：從「ㄛ」開始，嘴唇逐漸收成圓形，結尾滑到「ㄨ」', 1],
  'ɔ': ['單一母音：嘴唇圓而張開、固定不動', 1],
  'ɔɹ': ['「ㄛ」之後舌頭馬上往後捲起、懸空不碰上顎', 1], 'ɑɹ': ['「ㄚ」之後舌頭馬上往後捲起、懸空不碰上顎', 1],
  'ɛɹ': ['「ㄝ」之後舌頭馬上往後捲起、懸空不碰上顎', 1], 'ɪɹ': ['「ㄧ」之後舌頭馬上往後捲起、懸空不碰上顎', 1], 'ʊɹ': ['「ㄨ」之後舌頭馬上往後捲起、懸空不碰上顎', 1],
};
const art = p => { const a = ART[ipaNorm(p)]; return a ? a[0] + (a[1] ? '，喉嚨震動' : '，喉嚨不震動') : ''; };

// ---- minimal pairs: first word has the first sound, second word the second ----
const PAIRS = {
  'v|w': 'very/wary vine/wine veil/whale', 'v|b': 'vest/best very/berry van/ban', 'f|h': 'fit/hit feel/heel fire/hire',
  'θ|s': 'think/sink thank/sank mouth/mouse', 'θ|f': 'three/free thin/fin thought/fought', 'θ|t': 'thank/tank three/tree thin/tin',
  'ð|d': 'they/day then/den their/dare', 'ð|z': 'breathe/breeze clothe/close seethe/seize',
  'l|n': 'light/night low/no line/nine', 'l|ɹ': 'light/right long/wrong lock/rock', 'ɹ|w': 'red/wed right/white rest/west',
  'ɪ|i': 'ship/sheep sit/seat live/leave', 'æ|ɛ': 'bad/bed pan/pen man/men', 'ʊ|u': 'full/fool pull/pool look/Luke',
  'm|n': 'seem/seen team/teen came/cane', 'n|ŋ': 'sin/sing ban/bang thin/thing', 'ʃ|s': 'she/see ship/sip shy/sigh',
  'ʌ|ɑ': 'cup/cop luck/lock but/bot',
  'p|b': 'pat/bat pig/big pea/bee', 't|d': 'tie/die ten/den bat/bad', 'k|g': 'coat/goat back/bag cold/gold',
  'f|v': 'leaf/leave safe/save half/have', 's|z': 'peace/peas bus/buzz rice/rise', 'tʃ|dʒ': 'cheap/jeep rich/ridge chain/Jane',
  'θ|ð': 'thigh/thy ether/either', 'v|f': 'leave/leaf save/safe have/half',
};
const flip = s => s.split(' ').map(p => p.split('/').reverse().join('/')).join(' ');
function pairsFor(e, h) {
  const s = PAIRS[e + '|' + h] || (PAIRS[h + '|' + e] && flip(PAIRS[h + '|' + e])) || '';
  return s ? s.split(' ').map(p => p.split('/')) : [];
}
export const minimalPairs = (exp, heard) => pairsFor(ipaNorm(exp), ipaNorm(heard)).slice(0, 2);
// fallback: contrast the example words of the two sounds
const exampleWord = ph => (IPA[ipaNorm(ph)] || [])[0];

// ---- 少唸了 / 多唸了: compound sounds (r-colored vowels, diphthongs, affricates) where one part is missing/extra ----
// full: the sound the word needs; bases: what the learner produced when the extra part is missing
const COMP = [
  { full: 'ɔɹ', bases: ['ɔ', 'ɑ'], part: '捲舌的 r', fullZh: '歐兒', baseZh: '歐', how: '舌頭往後捲、懸空不碰上顎',
    fix: '唸完「歐」不要停，舌尖馬上往後捲起來，像在唸「歐兒」的兒化音；對著鏡子要看得到舌頭抬起來。', insHow: '「歐」唸完就收，舌頭放平不要捲', insFix: '把「歐」拉長但舌頭保持平放，不要捲起來。', pairs: 'sore/saw lore/law' },
  { full: 'ɑɹ', bases: ['ɑ', 'ʌ'], part: '捲舌的 r', fullZh: '啊兒', baseZh: '啊', how: '舌頭往後捲、懸空不碰上顎',
    fix: '嘴巴張大唸「啊」，同一口氣舌尖往後捲起，變成「啊兒」，嘴巴再慢慢收小。', insHow: '「啊」唸完就收，舌頭放平', insFix: '把「啊」拉長，舌頭保持平放。', pairs: 'cart/cot park/pock' },
  { full: 'ɛɹ', bases: ['ɛ', 'æ'], part: '捲舌的 r', fullZh: '欸兒', baseZh: '欸', how: '舌頭往後捲、懸空不碰上顎',
    fix: '先唸「欸」，馬上把舌尖往後捲成「欸兒」；不要讓舌頭碰到上顎。', insHow: '「欸」唸完就收，舌頭放平', insFix: '把「欸」唸短，舌頭保持平放。', pairs: 'hair/hay care/Kay' },
  { full: 'ɪɹ', bases: ['ɪ', 'i'], part: '捲舌的 r', fullZh: '衣兒', baseZh: '衣', how: '舌頭往後捲、懸空不碰上顎',
    fix: '先唸「衣」，馬上把舌尖往後捲成「衣兒」，結尾要聽到兒化的感覺。', insHow: '「衣」唸完就收，舌頭放平', insFix: '把「衣」唸清楚，舌頭保持平放。', pairs: 'beer/bee deer/dee' },
  { full: 'ʊɹ', bases: ['ʊ', 'u'], part: '捲舌的 r', fullZh: '屋兒', baseZh: '屋', how: '舌頭往後捲、懸空不碰上顎',
    fix: '先唸「屋」，嘴唇保持微圓，同時舌尖往後捲成「屋兒」。', insHow: '「屋」唸完就收，舌頭放平', insFix: '把「屋」唸清楚，舌頭保持平放。', pairs: 'tour/too poor/pooh' },
  { full: 'ɝ', bases: ['ɛ', 'ʌ', 'ə'], part: '整個母音該有的捲舌', fullZh: '兒', baseZh: '呃', how: '舌頭從頭到尾捲著、嘴唇微圓', ins: false,
    fix: '唸 bird 時嘴唇微圓、舌頭一開始就往後捲並一直懸空，不要先唸成「呃」再補捲舌。', pairs: 'bird/bud turn/ton' },
  { full: 'ɚ', bases: ['ə', 'ʌ'], part: '字尾 er 的捲舌', fullZh: '呃兒', baseZh: '呃', how: '舌頭輕輕往後捲起',
    fix: '唸 teacher 的最後一個音節時，舌尖輕輕往後捲，像「呃兒」，不要停在「呃」。', insHow: '輕輕的「呃」就收，舌頭放平', insFix: '把最後的音節唸成輕輕的「呃」，舌頭保持平放。', pairs: 'tuna/tuner Anna/honor' },
  { full: 'oʊ', bases: ['ɔ', 'ɑ', 'ʌ'], part: '收圓的尾巴（往「ㄨ」滑）', fullZh: '歐（ㄛ→ㄨ）', baseZh: 'ㄛ', how: '嘴唇慢慢收成小圓洞，結尾要圓',
    fix: '唸 go 時嘴型從「ㄛ」慢慢收成小圓洞，像要吹蠟燭，結尾一定要圓。', insHow: '嘴型固定不動，不要往「ㄨ」收圓', insFix: '唸 law 時嘴型保持不動，只唸單純的「ㄛ」。', pairs: 'low/law boat/bought' },
  { full: 'aɪ', bases: ['ɑ', 'æ', 'ʌ'], part: '往「ㄧ」滑的尾巴', fullZh: '愛（ㄚ→ㄧ）', baseZh: 'ㄚ', how: '從張大的嘴巴慢慢把嘴角拉開',
    fix: '唸 my 時先張大嘴「ㄚ」，再把嘴角慢慢往兩邊拉開滑到「ㄧ」，尾巴要唸出來。', insHow: '嘴巴張大固定不動，不要往「ㄧ」滑', insFix: '只唸單純的「ㄚ」，嘴型不要變。', pairs: 'my/ma buy/bah' },
  { full: 'eɪ', bases: ['ɛ', 'ɪ', 'æ'], part: '往「ㄧ」滑的尾巴', fullZh: '誒（ㄝ→ㄧ）', baseZh: 'ㄝ', how: '嘴角慢慢往兩邊拉開',
    fix: '唸 wait 時從「ㄝ」開始，嘴角慢慢拉開滑到「ㄧ」，像「ㄟ」。', insHow: '嘴型固定在「ㄝ」，不要往「ㄧ」滑', insFix: '只唸短短的「ㄝ」，嘴型不要變。', pairs: 'wait/wet late/let' },
  { full: 'aʊ', bases: ['ɑ', 'æ', 'ʌ'], part: '收圓的尾巴（往「ㄨ」滑）', fullZh: '凹（ㄚ→ㄨ）', baseZh: 'ㄚ', how: '嘴唇慢慢收圓',
    fix: '唸 now 時先張大嘴「ㄚ」，再把嘴唇慢慢收圓滑到「ㄨ」，像「ㄠ」。', insHow: '嘴巴張大固定不動，不要往「ㄨ」收圓', insFix: '只唸單純的「ㄚ」，嘴型不要變。', pairs: 'now/nah how/ha' },
  { full: 'ɔɪ', bases: ['ɔ', 'ɑ'], part: '往「ㄧ」滑的尾巴', fullZh: '喔衣（ㄛ→ㄧ）', baseZh: 'ㄛ', how: '圓唇的「ㄛ」之後嘴角拉開',
    fix: '唸 boy 時從圓唇的「ㄛ」滑到「ㄧ」，嘴型要變。', insHow: '嘴型固定不動', insFix: '只唸單純的「ㄛ」。', pairs: 'boy/Bo toy/toe' },
  { full: 'tʃ', bases: ['ʃ'], part: '開頭先堵住再放開的那一下', fullZh: '嗤（ㄑ）', baseZh: '噓（沒有先堵住）', how: '舌面先貼住上顎，再放開',
    fix: '唸 chair 前先把舌面貼住上顎堵住氣，再突然放開，會多一聲「ㄘ」的爆破。', insHow: '不要先堵住，直接持續吹氣', insFix: '像「噓」一樣持續吹氣，中間不要斷。', pairs: 'chair/share cheap/sheep' },
  { full: 'tʃ', bases: ['t'], part: '放開時的舌面摩擦', fullZh: '嗤（ㄑ）', baseZh: '特', how: '嘴唇嘟起、舌面貼上顎再放開', insHow: '舌尖彈一下就好，不要嘟嘴摩擦',
    fix: '唸 chip 時嘴唇嘟起，舌面貼住上顎再放開，要有「嗤」的摩擦聲。', insFix: '唸 tip 時舌尖頂牙齦彈開就好，不要嘟嘴。', pairs: 'chip/tip chin/tin' },
  { full: 'dʒ', bases: ['d'], part: '放開時的舌面摩擦', fullZh: '雞（ㄐ）', baseZh: '的', how: '嘴唇微嘟、舌面貼上顎再放開', insHow: '舌尖輕輕彈一下就好，舌面放平、不要嘟嘴',
    fix: '唸 Joe 時嘴唇微嘟，舌面貼上顎再放開，有「ㄐ」的摩擦。', insFix: '先唸 day 再唸 jay，感覺舌頭位置不同；d 只用舌尖輕彈一下就接母音。', pairs: 'jay/day Joe/dough' },
  { full: 'dʒ', bases: ['ʒ', 'z'], part: '開頭先堵住再放開的那一下', fullZh: '雞（ㄐ）', baseZh: '日（沒有先堵住）', how: '舌面先貼住上顎，再放開', ins: false,
    fix: '唸 budge 前先把舌面貼住上顎堵住氣，再放開，不要一直吹氣。', pairs: 'budge/beige' },
];
const lt = L => (L && !/^[·?]*$/.test(L)) ? `「${L}」` : '這個音';

export const DEL = {}, INS = {};
for (const c of COMP) {
  for (const b of c.bases) {
    DEL[c.full + '|' + b] = { part: c.part, said: c.baseZh, should: c.fullZh, how: c.how, fix: c.fix, pairs: c.pairs };
  }
  if (c.ins !== false) {
    INS[c.bases[0] + '|' + c.full] = { part: c.part, said: c.fullZh, should: c.baseZh, how: c.insHow, fix: c.insFix, pairs: flip(c.pairs) };
  }
}

// ---- 唸成別的音: hand-written plain descriptions [expected, heard, what happened → what to do, fix] ----
const SUB_ROWS = [
  ['d', 't', '太硬、像「特」；要輕輕彈一下、喉嚨震動，像「的」', '手摸喉嚨唸 d，要有麻麻的震動；字尾的 d 不要用力吐氣。'],
  ['v', 'f', '喉嚨沒震動，變成輕飄飄的「夫」；要上齒咬下唇、喉嚨震動（vvv）', '唸 leave 時把 v 拖長成 "vvv"，確認喉嚨有震動再放開。'],
  ['v', 'w', '嘴唇圓成「ㄨ」了；要上排牙齒輕咬下唇再出聲', 'very 的 v：先咬住下唇再發聲，鏡子裡要看到牙齒壓在嘴唇上。'],
  ['w', 'v', '牙齒咬到嘴唇了；要嘴唇嘟圓像吹口哨，牙齒不碰嘴唇', '唸 wine 前先把嘴唇嘟圓，再快速打開。'],
  ['v', 'b', '雙唇整個閉起來像「玻」；要只有上齒碰下唇，氣持續擠出', 'van 與 ban 對照：v 的嘴唇不會完全封住。'],
  ['f', 'h', '只有喉嚨哈氣像「ㄏ」；要上齒咬下唇讓氣從縫隙出來', '對著鏡子唸 fit，確認上齒有碰到下唇。'],
  ['θ', 's', '舌頭縮在牙齒後面變成「ㄙ」；要舌尖輕輕伸到上下牙齒中間吹氣', '對鏡子唸 think，要看得到舌尖。'],
  ['θ', 'f', '用上齒咬下唇變成「夫」；要嘴唇放鬆、只用舌尖碰牙齒', 'three 與 free 對照：th 時嘴唇不動，只動舌尖。'],
  ['θ', 't', '舌尖頂住牙齦彈開像「特」；要舌尖只輕靠牙齒、氣一直吹出來不能擋住', 'thank 開頭先吹一口持續的氣，再接 ank。'],
  ['ð', 'd', '舌頭頂住上牙齦像「的」；要舌尖放牙齒中間，一邊吹氣一邊震動喉嚨', 'they 先唸長長的 "thhh" 再接 ay，喉嚨要震動。'],
  ['ð', 'z', '舌頭縮進去變成「ㄗ」；要舌尖輕輕伸到牙齒中間', '對鏡子唸 breathe，結尾也要看得到舌尖。'],
  ['l', 'n', '氣從鼻子出去像「ㄋ」；要舌尖頂牙齦、氣從舌頭兩側出（捏住鼻子還能發聲）', '捏著鼻子唸 light，聲音不變才對；night 則會悶掉。'],
  ['n', 'l', '氣從舌頭兩側出去像「ㄌ」；要氣從鼻子出（捏住鼻子會悶掉）', '捏著鼻子唸 night，聲音應該悶掉。'],
  ['l', 'ɹ', '舌頭捲起來變成 r；要舌尖頂住上牙齦不動', 'light 開頭舌尖用力頂住，感覺舌尖貼著牙齦。'],
  ['ɹ', 'l', '舌尖頂住牙齦像「ㄌ」；要舌頭往後捲、懸空不碰任何地方', '唸 right 時舌尖懸空後捲，千萬不要碰到上顎。'],
  ['ɹ', 'w', '只有嘴唇圓起像「ㄨ」；要嘴唇圓的同時舌頭往後捲', 'red 的舌頭要先捲起來再發聲。'],
  ['ɪ', 'i', '拉得太長太緊像「一～」；要短、放鬆，嘴角不用力', 'ship 要短，sheep 要長，來回對比。'],
  ['i', 'ɪ', '太短太鬆；要嘴角往兩邊拉開、拉長像「一～」', 'sheep 時微笑拉開嘴角並拖長。'],
  ['æ', 'ɛ', '嘴巴開太小像「ㄝ」；要下巴往下掉、嘴角拉開，在「ㄝ」和「ㄚ」之間', 'bad 時下巴明顯往下掉，比 bed 開很多。'],
  ['ɛ', 'æ', '嘴巴開太大；要嘴巴微開，像短短的「ㄝ」', 'bed 的嘴型小而放鬆。'],
  ['ʊ', 'u', '嘴唇太圓太長像「屋～」；要短、放鬆，嘴唇只微微圓', 'full 要短，fool 要長。'],
  ['u', 'ʊ', '太短太鬆；要嘴唇嘟圓並拉長像「屋～」', 'fool 時嘴唇像吹蠟燭並拖長。'],
  ['m', 'n', '嘴沒有閉起來像「ㄋ」；要雙唇閉緊，氣從鼻子出', 'came 結尾把嘴閉起來並停住一拍。'],
  ['n', 'm', '嘴閉起來了像「ㄇ」；要嘴巴保持微開，舌尖頂上牙齦', 'cane 結尾嘴巴保持微開、舌尖頂住。'],
  ['n', 'ŋ', '舌根頂住像「ㄥ」；要舌尖頂上牙齦收尾像「ㄣ」', 'sin 結尾舌尖要碰到上牙齦。'],
  ['ŋ', 'n', '舌尖頂牙齦像「ㄣ」；要舌根抬起頂住喉嚨上方、舌尖不碰牙齦，像「ㄥ」', 'sing 結尾舌尖不要碰任何地方，只動舌根。'],
  ['ʃ', 's', '嘴角拉開像「ㄙ」；要嘴唇嘟起往前像「噓」', 'she 先嘟嘴唇再發聲。'],
  ['s', 'ʃ', '嘴唇嘟起了像「噓」；要嘴角拉開、氣細細地出來像「ㄙ」', 'see 時微笑拉開嘴角。'],
  ['ʌ', 'ɑ', '嘴巴張太大像「啊」；要嘴巴半開、短短的「ㄚ」', 'cup 嘴型小而短，cop 才張大。'],
  ['ɑ', 'ʌ', '嘴巴開太小太短；要嘴巴張大像看牙醫的「啊～」', 'lock 時嘴巴像看牙醫那樣張大。'],
];
export const CONF = {};
for (const [e, h, desc, fix] of SUB_ROWS) CONF[e + '|' + h] = { desc, fix };
// voicing-only confusions are generated in both directions
for (const [vl, vd] of [['p', 'b'], ['t', 'd'], ['k', 'g'], ['f', 'v'], ['s', 'z'], ['tʃ', 'dʒ'], ['θ', 'ð']]) {
  const gen = (e, h, voicedExp) => {
    if (CONF[e + '|' + h]) return;
    CONF[e + '|' + h] = voicedExp
      ? { desc: `喉嚨沒震動，變成輕的「${zh(h)}」；要讓喉嚨震動，像「${zh(e)}」（手摸喉嚨會麻麻的）`, fix: `把 ${soundLabel(e)} 拖長，確認手摸喉嚨有震動再放開。` }
      : { desc: `喉嚨震動了，變成「${zh(h)}」；要不震動而且送出一口氣，像「${zh(e)}」（手放嘴前會感到氣流）`, fix: `把手放在嘴前唸 ${soundLabel(e)}，要感到氣流衝出來、喉嚨不震動。` };
  };
  gen(vl, vd, false);
  gen(vd, vl, true);
}

// ---- 少唸了 whole sounds (typically word-final consonants) ----
const FINAL_FIX = {
  t: '字尾 t：舌尖頂住上牙齦「停住」一下再輕輕放開，不能省略。', d: '字尾 d：舌尖頂住上牙齦並讓喉嚨震動，輕輕收尾。',
  k: '字尾 k：舌根頂住喉嚨上方收住，輕輕放開。', g: '字尾 g：舌根頂住並讓喉嚨震動。', p: '字尾 p：雙唇閉合收尾。', b: '字尾 b：雙唇閉合並讓喉嚨震動。',
  s: '字尾 s（複數／第三人稱）一定要唸出來，氣細細地吹出去。', z: '字尾 z（複數 -s 常唸 z）要讓喉嚨震動、發出來。',
  v: '字尾 v：上齒咬下唇並震動，不要吞掉。', f: '字尾 f：上齒咬下唇吹氣。', l: '字尾 l：舌尖仍要頂上牙齦，像輕輕的「ㄡ」加舌尖頂住。',
  m: '字尾 m：雙唇閉合收尾。', n: '字尾 n：舌尖頂上牙齦收尾。',
};
const FINAL_PAIRS = { t: 'beat/bee suit/sue', d: 'bead/bee tide/tie', k: 'beak/bee bake/bay', p: 'beep/bee cup/cu', s: 'bees/bee ties/tie', z: 'peas/pea buzz/bu', v: 'live/lie grave/gray', l: 'seal/see peel/pea', m: 'beam/bee seem/see', n: 'bean/bee seen/see', f: 'beef/bee leaf/lee', b: 'cub/cu rub/rue', g: 'peg/pea bag/bay' };

const cap = (arr, n = 2) => arr.slice(0, n);
const toPairs = s => s ? s.split(' ').map(p => p.split('/')) : [];

// exp/heard: phoneme symbols (heard '—' = not said, '?' = unclear). letters: the word letters for this sound.
// Returns {type, typeLabel, verdict, fix, pairs} or null when nothing is wrong.
export function explain(exp, heard, { isFinal = false, word = '', letters = '' } = {}) {
  const e = ipaNorm(exp), h = ipaNorm(heard);
  const L = lt(letters), E = soundLabel(e);
  if (!heard || heard === '—') {
    if (e === 'ɹ') return { type: 'del', typeLabel: '少唸了', verdict: `${L}少了捲舌的 r：舌頭沒有往後捲，要在母音後面把舌尖捲起來，唸成「兒」的感覺。`, fix: '唸完前面的母音不要停，舌尖馬上往後捲起、懸空不碰上顎。', pairs: cap(toPairs('sore/saw cart/cot')) };
    return {
      type: 'omit', typeLabel: '少唸了', verdict: `${L}整個音沒有唸出來（要唸 ${E}，像「${zh(e)}」）；中文字尾幾乎不收子音，容易整個吞掉。`,
      fix: (isFinal && FINAL_FIX[e]) || `慢速唸「${word || '這個字'}」，在這個音的位置做出 ${E} 的嘴型，停住 0.5 秒再放開。`,
      pairs: cap(toPairs(isFinal ? FINAL_PAIRS[e] : '')),
    };
  }
  if (e === h) return null;
  const d = DEL[e + '|' + h];
  if (d) return { type: 'del', typeLabel: '少唸了', verdict: `${L}少了${d.part}，你只唸了「${d.said}」，要唸成「${d.should}」，${d.how}。`, fix: d.fix, pairs: cap(toPairs(d.pairs)) };
  const i = INS[e + '|' + h];
  if (i) return { type: 'ins', typeLabel: '多唸了', verdict: `${L}多唸了${i.part}，你唸成「${i.said}」，要唸成「${i.should}」，${i.how}。`, fix: i.fix, pairs: cap(toPairs(i.pairs)) };
  if (h === '?') {
    return { type: 'sub', typeLabel: '唸成別的音', verdict: `${L}唸得不夠準，聽起來接近別的音；要唸 ${E}（${zh(e)}）：${art(e)}。`, fix: `把這個音單獨拖長慢唸，對照 ${E} 的嘴型，再放回「${word || '這個字'}」裡。`, pairs: [] };
  }
  const H = soundLabel(h);
  const lead = (letters && letters.toLowerCase() === E) ? `${E} 唸成了 ${H}` : `${L}該唸 ${E}，你唸成了 ${H}`;
  const c = CONF[e + '|' + h];
  let pairs = cap(pairsFor(e, h));
  if (!pairs.length && exampleWord(e) && exampleWord(h)) pairs = [[exampleWord(e), exampleWord(h)]];
  if (c) return { type: 'sub', typeLabel: '唸成別的音', verdict: `${lead}：${c.desc}。`, fix: c.fix, pairs };
  return {
    type: 'sub', typeLabel: '唸成別的音',
    verdict: `${lead}：你的嘴型是「${art(h) || '另一個音'}」；要改成「${art(e) || '正確的音'}」。`,
    fix: `把 ${E} 單獨拖長慢唸，對照 ${H} 的嘴型有什麼不同，再放進「${word || '這個字'}」裡。`, pairs,
  };
}

// one-line plain description of a sound for hovering / the 標準 cell
export function plainSound(ph) {
  const n = ipaNorm(ph), info = IPA[n];
  return `${soundLabel(n)}（${zh(n)}）：${info ? info[2] : art(n)}`;
}
