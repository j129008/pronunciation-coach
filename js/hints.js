// One-line, plain-Chinese hint for the single most important error in a word (shown when the user plays 我的),
// plus a check for when Azure's own phoneme confidence is too low to trust the "error".
import { ipaNorm } from './phonemes.js';
import { explain } from './explain.js';

const VOWEL = new Set(['ʌ', 'ɑ', 'æ', 'ɛ', 'ɪ', 'i', 'ʊ', 'u', 'ə', 'ɚ', 'ɝ', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'oʊ', 'ɔ']);
export const isVowel = p => VOWEL.has(ipaNorm(p));

// [expected, heard] → hint. Written for learners who can't read IPA.
export const HINTS = {
  'd|ð': '你把 d 唸成了舌頭伸到牙齒間的 th 音（像 this 的 th），d 要舌尖頂上牙齦後面，像注音 ㄉ',
  'ð|d': '你把 th（this 的 th）唸成了 d，像注音 ㄉ；th 要把舌尖輕輕伸到上下牙齒中間，邊吹氣邊讓喉嚨震動',
  'θ|s': '你把 th（think 的 th）唸成了 s，像注音 ㄙ；th 要把舌尖伸到上下牙齒中間吹氣，對鏡子要看得到舌尖',
  's|θ': '你把 s 唸成了舌頭伸出來的 th 音；s 要舌尖縮在牙齒後面、嘴角拉開，像注音 ㄙ',
  'v|b': '你把 v 唸成了 b，雙唇整個閉起來了；v 要上排牙齒輕咬下唇，喉嚨震動、氣持續擠出來',
  'b|v': '你把 b 唸成了 v，牙齒咬到嘴唇了；b 要雙唇閉緊再彈開，像注音 ㄅ',
  'ɹ|l': '你把 r 唸成了 l，舌尖碰到上牙齦了；r 要舌頭往後捲、懸空不碰任何地方，嘴唇微圓',
  'l|ɹ': '你把 l 唸成了 r，舌頭捲起來了；l 要舌尖確實頂住上牙齦，像注音 ㄌ',
  'ɪ|i': '你把短的 i（sit 的 i）唸成了長的 ee（see），太長太用力；要短而放鬆，嘴角不要拉',
  'i|ɪ': '你把長的 ee（see 的 ee）唸太短太鬆了；要嘴角往兩邊拉開、拉長像「一～」',
  'æ|ɛ': '你把 a（cat 的 a）唸成了 e（bed 的 e），嘴巴開太小；要下巴往下掉、嘴角拉開，介於 ㄝ 和 ㄚ 之間',
  'ɛ|æ': '你把 e（bed 的 e）唸成了 a（cat 的 a），嘴巴開太大；要嘴巴微開，短短的 ㄝ',
};

// exp/heard as in analyzeWord rows. Returns a single sentence (never IPA symbols in the text).
export function oneLineHint(exp, heard, { isFinal = false, word = '', letters = '' } = {}) {
  const e = ipaNorm(exp), h = ipaNorm(heard);
  if (!heard || heard === '—') {
    if (isFinal && !isVowel(e)) return `你把字尾的子音（${letters && letters !== '·' ? letters : '最後一個音'}）吞掉了；中文習慣不收尾，英文一定要把最後的音唸出來，輕輕收住就好`;
  } else if (e !== h) {
    if (HINTS[e + '|' + h]) return HINTS[e + '|' + h];
    // a final consonant heard as "uh": you added a vowel after it (elsewhere it was swallowed — see wordfix.js)
    if (isFinal && !isVowel(e) && (h === 'ə' || h === 'ʌ')) return `你在 ${letters && letters !== '·' ? letters : '子音'} 後面多加了一個母音（像多唸了「ㄜ」）；子音唸完就收住，不要再補一個「ㄜ」`;
  }
  const x = explain(exp, heard, { isFinal, word, letters });
  return x ? x.verdict : '';
}

// Azure's own NBest scores say it is unsure: the "heard" sound barely beats the expected one, or scores low itself.
export function lowConfidence(r) {
  if (!r || !r.bad) return false;
  if (r.heard === '?') return true;
  if (r.heard === '—' || r.heardConf == null) return false;
  return r.heardConf < 50 || (r.expConf != null && r.heardConf - r.expConf < 15);
}
export const LOW_CONF_NOTE = 'Azure 對這個音的判斷信心不高，這個「錯誤」可能只是辨識誤差，不一定是你真的唸錯——請以自己耳朵聽到的為準。';

// The row to talk about for a word: worst-scoring mispronounced sound.
export function mainError(rows) {
  let best = -1;
  rows.forEach((r, i) => { if (r.bad && (best < 0 || (r.score ?? 0) < (rows[best].score ?? 0))) best = i; });
  return best;
}
