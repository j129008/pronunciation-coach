// "What did I actually say, and what exactly was different?" — English-ish respelling of
// phoneme sequences plus Traditional Chinese articulation diffs for Mandarin speakers.
import { ipaNorm, FINAL_TIP } from './phonemes.js';

// ---- respelling (approximate, for reading aloud like an English speaker) ----
const RESPELL = {
  'ʌ': 'u', 'ɑ': 'ah', 'æ': 'a', 'ɛ': 'e', 'ɪ': 'i', 'i': 'ee', 'ʊ': 'oo', 'u': 'oo', 'ə': 'uh', 'ɚ': 'er', 'ɝ': 'er',
  'eɪ': 'ay', 'aɪ': 'eye', 'ɔɪ': 'oy', 'aʊ': 'ow', 'oʊ': 'oh', 'ɔ': 'o',
  'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g', 'f': 'f', 'v': 'v', 'θ': 'th', 'ð': 'dh', 's': 's', 'z': 'z',
  'ʃ': 'sh', 'ʒ': 'zh', 'tʃ': 'ch', 'dʒ': 'j', 'm': 'm', 'n': 'n', 'ŋ': 'ng', 'l': 'l', 'ɹ': 'r', 'w': 'w', 'j': 'y', 'h': 'h', 'ɾ': 'd', 'ʔ': "'",
};
const SHORT_V = new Set(['u', 'a', 'e', 'i', 'o']);
const DOUBLE_END = new Set(['f', 'l', 's', 'z']);

// phs: IPA symbols (null/''/'—' entries are skipped = omitted sounds)
export function respell(phs) {
  const parts = phs.filter(p => p && p !== '—').map(p => { const n = ipaNorm(p); return RESPELL[n] || n; });
  const n = parts.length;
  if (n >= 2 && DOUBLE_END.has(parts[n - 1]) && SHORT_V.has(parts[n - 2])) parts[n - 1] += parts[n - 1];
  return parts.join('');
}

// ---- articulation descriptions: d = tongue/lips/airflow, v = voiced? ----
export const ART = {
  p: ['雙唇閉緊後爆開，送出一口氣', 0], b: ['雙唇閉緊後爆開', 1],
  t: ['舌尖頂上齒齦後彈開，送出一口氣', 0], d: ['舌尖頂上齒齦後輕輕彈開', 1],
  k: ['舌根頂軟顎後爆開，送出一口氣', 0], g: ['舌根頂軟顎後爆開', 1],
  f: ['上排牙齒輕咬下唇，氣從縫隙擠出', 0], v: ['上排牙齒輕咬下唇，氣從縫隙擠出', 1],
  'θ': ['舌尖放在上下牙齒之間，氣從縫隙吹出', 0], 'ð': ['舌尖放在上下牙齒之間，氣從縫隙吹出', 1],
  s: ['舌尖靠近上齒齦、嘴角拉開，氣流細而尖', 0], z: ['舌尖靠近上齒齦、嘴角拉開，氣流細而尖', 1],
  'ʃ': ['嘴唇嘟起往前、舌面抬高後縮，氣流寬而柔', 0], 'ʒ': ['嘴唇嘟起往前、舌面抬高後縮，氣流寬而柔', 1],
  'tʃ': ['舌面先貼上顎再放開，嘴唇嘟起（像「ㄑ」）', 0], 'dʒ': ['舌面先貼上顎再放開，嘴唇微嘟（像有聲的「ㄐ」）', 1],
  m: ['雙唇閉合，氣從鼻腔出', 1], n: ['舌尖頂上齒齦，氣從鼻腔出', 1], 'ŋ': ['舌根頂軟顎，氣從鼻腔出（像「ㄥ」）', 1],
  l: ['舌尖頂上齒齦，氣從舌頭兩側流出', 1], 'ɹ': ['舌尖往後捲起但不碰上顎，嘴唇微圓', 1],
  w: ['嘴唇先圓起再快速放開，牙齒不碰嘴唇', 1], j: ['舌面貼近硬顎，快速滑向後面的母音', 1], h: ['喉嚨輕輕送氣，嘴型跟著後面的母音', 0],
  'ɾ': ['舌尖快速輕點上齒齦一下', 1], 'ʔ': ['喉嚨瞬間閉住再放開', 0],
  'ʌ': ['嘴巴半開、放鬆短促', 1], 'ɑ': ['嘴巴張很大、舌頭放低往後', 1], 'æ': ['嘴角往兩側拉、下巴降低，介於「ㄝ」和「ㄚ」之間', 1],
  'ɛ': ['嘴巴微開、短促的「ㄝ」', 1], 'ɪ': ['嘴角放鬆、短促，舌位比 /i/ 低一點', 1], i: ['嘴角用力往兩側拉、舌位前高，拉長', 1],
  'ʊ': ['嘴唇微圓、放鬆短促', 1], u: ['嘴唇用力嘟圓、拉長', 1], 'ə': ['嘴巴放鬆、最輕最弱的「ㄜ」', 1],
  'ɚ': ['舌頭捲起、不碰上顎的輕捲舌母音', 1], 'ɝ': ['舌頭捲起、不碰上顎，整個母音帶捲舌', 1],
  'eɪ': ['雙母音：從「ㄝ」滑到「ㄧ」，嘴角漸漸拉開', 1], 'aɪ': ['雙母音：從「ㄚ」滑到「ㄧ」', 1], 'ɔɪ': ['雙母音：從圓唇的「ㄛ」滑到「ㄧ」', 1],
  'aʊ': ['雙母音：從「ㄚ」滑到「ㄨ」，嘴唇漸漸收圓', 1], 'oʊ': ['雙母音：從「ㄛ」開始，嘴唇逐漸收成圓形，結尾滑到「ㄨ」', 1],
  'ɔ': ['單一母音：嘴唇圓而張開、固定不動', 1],
};
const art = p => ART[p] ? ART[p][0] + (ART[p][1] ? '，聲帶振動' : '，聲帶不振動') : '';

// ---- minimal-pair words; first word has the first sound, second word the second ----
const PAIRS = {
  'd|dʒ': 'day/jay dough/Joe deep/jeep', 't|tʃ': 'tip/chip tin/chin tease/cheese', 'oʊ|ɔ': 'boat/bought coat/caught low/law',
  'v|w': 'very/wary vine/wine veil/whale', 'v|b': 'vest/best very/berry van/ban', 'f|h': 'fit/hit feel/heel fire/hire',
  'θ|s': 'think/sink thank/sank mouth/mouse', 'θ|f': 'three/free thin/fin thought/fought', 'θ|t': 'thank/tank three/tree thin/tin',
  'ð|d': 'they/day then/den their/dare', 'ð|z': 'breathe/breeze clothe/close seethe/seize',
  'l|n': 'light/night low/no line/nine', 'l|ɹ': 'light/right long/wrong lock/rock', 'ɹ|w': 'red/wed right/white rest/west',
  'ɪ|i': 'ship/sheep sit/seat live/leave', 'æ|ɛ': 'bad/bed pan/pen man/men', 'ʊ|u': 'full/fool pull/pool look/Luke',
  'm|n': 'seem/seen team/teen came/cane', 'n|ŋ': 'sin/sing ban/bang thin/thing', 'ʃ|s': 'she/see ship/sip shy/sigh',
  'tʃ|ʃ': 'chair/share cheap/sheep watch/wash', 'ʌ|ɑ': 'cup/cop luck/lock but/bot', 'eɪ|ɛ': 'late/let wait/wet pain/pen',
  'ɝ|ɛ': 'bird/bed her/head', 'p|b': 'pat/bat pig/big pea/bee', 't|d': 'tie/die ten/den bat/bad', 'k|g': 'coat/goat back/bag cold/gold',
  'f|v': 'leaf/leave safe/save half/have', 's|z': 'peace/peas bus/buzz rice/rise', 'tʃ|dʒ': 'cheap/jeep rich/ridge chain/Jane',
  'θ|ð': 'thigh/thy ether/either',
};
const flip = s => s.split(' ').map(p => p.split('/').reverse().join('/')).join(' ');
export function minimalPairs(exp, heard) {
  const s = PAIRS[exp + '|' + heard] || (PAIRS[heard + '|' + exp] && flip(PAIRS[heard + '|' + exp])) || '';
  return s ? s.split(' ').map(p => p.split('/')) : [];
}

// ---- confusion table: [expected, heard, what you did, what it should be, one-line drill] ----
const CONF_ROWS = [
  ['d', 'dʒ', '舌面抬高、貼住上顎一段時間，變成帶摩擦的「ㄐ」（常出現在 r、y 前面）', '只用舌尖輕彈一下上齒齦，舌面保持平放、嘴唇不嘟，聲帶振動', '先唸 day 再唸 jay，感覺舌頭位置不同；d 只彈一下就接母音。'],
  ['dʒ', 'd', '舌尖輕彈上齒齦，沒有舌面貼上顎的摩擦', '舌面先貼住硬顎、再慢慢放開形成摩擦，嘴唇微嘟，聲帶振動', '唸 Joe 時想像「ㄐ」加圓唇，比 dough 多一段摩擦。'],
  ['t', 'tʃ', '舌面貼上顎形成「ㄑ」的摩擦（常出現在 tr、ty 前）', '舌尖頂上齒齦後直接彈開，不嘟嘴、沒有摩擦', 'tip 與 chip 交替慢唸，t 只彈一下。'],
  ['tʃ', 't', '只用舌尖彈開，沒有摩擦', '舌面貼上顎再放開，帶出「ㄑ」的摩擦，嘴唇微嘟', 'chip 開頭要有「嗤」的摩擦聲，不能只彈一下。'],
  ['oʊ', 'ɔ', '單一個「ㄛ」，嘴型從頭到尾不變，沒有收圓', '雙母音：從「ㄛ」開始，嘴唇逐漸收圓，結尾滑到「ㄨ」（/ʊ/）', '把 go 唸成「ㄍㄛ‑ㄨ」，結尾嘴唇一定要圓起來。'],
  ['ɔ', 'oʊ', '嘴唇收圓並滑向「ㄨ」，變成雙母音', '單一母音，嘴巴圓而張開、固定不動，不要滑向「ㄨ」', '唸 law 時嘴型不動，像拉長的「ㄛ」。'],
  ['v', 'f', '聲帶沒有振動，變成清音 /f/（字尾尤其常見）', '上齒輕咬下唇，聲帶要持續振動——手摸喉嚨會麻麻的', '唸 leave 時把 v 拖長成 "vvv"，確認喉嚨有震動再放開。'],
  ['v', 'w', '嘴唇圓起、牙齒沒碰到嘴唇（像「ㄨ」）', '上排牙齒輕咬下唇，氣從縫隙擠出並振動聲帶，嘴唇不要圓', 'very 與 wary 對照：唸 v 時要看得到上齒咬下唇。'],
  ['w', 'v', '上齒咬住下唇', '嘴唇圓起像吹口哨，牙齒不碰嘴唇，再快速放開', '唸 wine 前先把嘴唇嘟圓，再快速打開。'],
  ['v', 'b', '雙唇完全閉合再爆開', '只有上齒碰下唇，氣流持續擠出、不閉合', 'van 與 ban 對照：v 的嘴唇不會完全封住。'],
  ['f', 'h', '只有喉嚨送氣（像「ㄏ」），牙齒沒有碰嘴唇', '上排牙齒輕咬下唇，氣從縫隙吹出', '對著鏡子唸 fit，確認上齒有碰到下唇。'],
  ['θ', 's', '舌尖縮在牙齒後面，氣流變成尖細的 /s/', '舌尖輕輕伸到上下牙齒之間，氣從舌尖與牙齒的縫隙吹出，不振動聲帶', '對鏡子唸 think，要看得到舌尖。'],
  ['θ', 'f', '用上齒咬下唇', '舌尖放在上下牙之間（不碰嘴唇）', 'three 與 free 對照：th 時嘴唇不動，只動舌尖。'],
  ['θ', 't', '舌尖頂住上齒齦並彈開，氣流被完全擋住', '舌尖只輕靠牙齒，氣流要持續吹出、不能完全堵住', 'thank 開頭先吹一口持續的氣，再接 ank。'],
  ['ð', 'd', '舌尖頂住上齒齦並彈開（像「ㄉ」）', '舌尖放在上下牙齒之間持續吹氣並振動聲帶，不要堵住', 'they 先唸長長的 "ððð" 再接 ay。'],
  ['ð', 'z', '舌尖縮到牙齒後面變成 /z/', '舌尖輕伸到牙齒之間，持續振動', '對鏡子唸 breathe，結尾也要看得到舌尖。'],
  ['l', 'n', '氣從鼻腔出去（捏鼻子會悶掉）', '舌尖頂上齒齦，氣從舌頭兩側流出，鼻腔不出氣（捏鼻子仍能發聲）', '捏著鼻子唸 light，聲音不變才對；night 則會悶掉。'],
  ['n', 'l', '氣從舌頭兩側流出，鼻腔沒有出氣', '舌尖頂上齒齦，氣從鼻腔出去（捏鼻子會悶掉）', '捏著鼻子唸 night，聲音應該悶掉。'],
  ['l', 'ɹ', '舌尖捲起、沒有頂住上齒齦（像 r）', '舌尖要確實頂住上齒齦，氣從兩側流出', 'light 開頭舌尖用力頂住，感覺舌尖貼著牙齦。'],
  ['ɹ', 'l', '舌尖頂住上齒齦', '舌尖往後捲起但不碰任何地方，嘴唇微圓', '唸 right 時舌尖懸空後捲，千萬不要碰到上顎。'],
  ['ɹ', 'w', '只有嘴唇圓起，舌頭沒有捲', '嘴唇微圓的同時舌尖要往後捲', 'red 的舌頭要先捲起來再發聲。'],
  ['ɪ', 'i', '嘴角用力拉開、拉長（像「一」）', '放鬆短促，嘴角不要用力，舌位比 /i/ 低一點', 'ship 要短，sheep 要長，來回對比。'],
  ['i', 'ɪ', '放鬆短促', '嘴角用力往兩側拉、舌位前高，拉長', 'sheep 時微笑拉開嘴角並拖長。'],
  ['æ', 'ɛ', '嘴巴只開一半（像「ㄝ」）', '嘴巴張大、下巴降低、嘴角拉開，介於「ㄝ」和「ㄚ」之間', 'bad 時下巴明顯往下掉，比 bed 開很多。'],
  ['ɛ', 'æ', '嘴巴張太大', '嘴巴微開，下巴只降一點', 'bed 的嘴型小而放鬆。'],
  ['ʊ', 'u', '嘴唇用力嘟圓、拉長', '放鬆短促，嘴唇只微圓', 'full 要短，fool 要長。'],
  ['u', 'ʊ', '放鬆短促', '嘴唇用力嘟圓、拉長', 'fool 時嘴唇像吹蠟燭並拖長。'],
  ['m', 'n', '舌尖頂上齒齦（像「ㄣ」），嘴唇沒有閉起來', '雙唇完全閉合，氣從鼻腔出', 'came 結尾把嘴閉起來並停住一拍。'],
  ['n', 'm', '雙唇閉合', '舌尖頂上齒齦，嘴巴保持微開', 'cane 結尾嘴巴保持微開、舌尖頂住。'],
  ['n', 'ŋ', '舌根頂軟顎（像「ㄥ」）', '舌尖頂上齒齦收尾（像「ㄣ」）', 'sin 結尾舌尖要碰到上齒齦。'],
  ['ŋ', 'n', '舌尖頂上齒齦', '舌根抬起頂軟顎，舌尖留在下齒後面（像「ㄥ」）', 'sing 結尾舌尖不要碰任何地方，只動舌根。'],
  ['ʃ', 's', '嘴角拉開、舌尖靠前', '嘴唇嘟起往前，舌面抬高後縮，像「噓」', 'she 先嘟嘴唇再發聲。'],
  ['s', 'ʃ', '嘴唇嘟起', '嘴角拉開、舌尖靠近上齒齦，氣流細而尖', 'see 時微笑拉開嘴角。'],
  ['tʃ', 'ʃ', '只有持續摩擦，沒有先堵住', '舌面先貼上顎堵住氣流，再放開形成摩擦', 'chair 開頭先堵一下再放開，與 share 對照。'],
  ['ʌ', 'ɑ', '嘴巴張太大、舌頭放太低', '嘴巴半開，放鬆短促', 'cup 嘴型小而短，cop 才張大。'],
  ['ɑ', 'ʌ', '嘴巴只半開，短促', '嘴巴張大、舌頭放低，聲音稍長', 'lock 時嘴巴像看牙醫那樣張大。'],
  ['eɪ', 'ɛ', '只有單一「ㄝ」，沒有往「一」滑', '雙母音：從「ㄝ」滑到「一」，嘴角漸漸拉開', 'wait 唸成「ㄨㄟ‑ㄧ」，尾巴要滑出來。'],
  ['ɝ', 'ɛ', '舌頭放平，變成「ㄝ」', '舌頭捲起、不碰上顎，整個母音帶捲舌', 'work 從頭到尾舌頭保持捲起。'],
];
export const CONF = {};
for (const [e, h, did, should, fix] of CONF_ROWS) CONF[e + '|' + h] = { did, should, fix };

// voicing-only confusions (b/p, d/t, g/k, v/f, z/s, dʒ/tʃ, ð/θ) are generated in both directions
for (const [vl, vd] of [['p', 'b'], ['t', 'd'], ['k', 'g'], ['f', 'v'], ['s', 'z'], ['tʃ', 'dʒ'], ['θ', 'ð']]) {
  const gen = (e, h, voicedExp) => {
    const key = e + '|' + h;
    if (CONF[key]) return;
    CONF[key] = voicedExp
      ? { did: `聲帶沒有振動，唸成清音 /${h}/`, should: `/${e}/ 要振動聲帶——手摸喉嚨會麻麻的，字尾也要保持振動`, fix: `把 /${e}/ 拖長成 "${e}${e}${e}"，確認喉嚨有震動再放開。` }
      : { did: `聲帶振動了，唸成有聲的 /${h}/`, should: `/${e}/ 不振動聲帶，而且要送氣——手掌放在嘴前會感到一口氣`, fix: `把手放在嘴前唸 /${e}/，要感到氣流衝出來、喉嚨不震動。` };
  };
  gen(vl, vd, false);
  gen(vd, vl, true);
}

// Returns {did, should, fix, pairs:[[wordWithExpected, wordWithHeard]...], kind} — null when nothing is wrong.
export function explain(exp, heard, { isFinal = false, word = '' } = {}) {
  const e = ipaNorm(exp), h = ipaNorm(heard);
  if (!heard || heard === '—') {
    const should = (isFinal && FINAL_TIP[e]) || `要發出 /${e}/：${art(e)}`;
    return {
      kind: 'omit', did: '這個音沒有唸出來（中文字尾幾乎不收子音，容易整個吞掉）', should,
      fix: `慢速唸「${word || '這個字'}」，在${isFinal ? '結尾' : '這個音的位置'}刻意做出 /${e}/ 的口型並停住 0.5 秒再放開。`, pairs: [],
    };
  }
  if (e === h) return null;
  const c = CONF[e + '|' + h];
  if (c) return { kind: 'known', ...c, pairs: minimalPairs(e, h) };
  const pairs = minimalPairs(e, h);
  return {
    kind: 'generic',
    did: ART[h] ? `/${h}/：${art(h)}` : `唸成 /${heard}/`,
    should: ART[e] ? `/${e}/：${art(e)}` : `唸成 /${e}/`,
    fix: `把 /${e}/ 單獨拖長慢唸，對照口型，再放進「${word || '這個字'}」裡。`,
    pairs,
  };
}
