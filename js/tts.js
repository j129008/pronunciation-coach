// Text-to-speech: Google Translate TTS with a browser-voice fallback.
import { esc } from './util.js';

const RANK = ['Google US English', 'Samantha', 'Ava', 'Allison', 'Zoe', 'Premium', 'Enhanced', 'Natural', 'Aria', 'Jenny'];
function rankV(v) {
  const r = RANK.findIndex(k => v.name.includes(k));
  return (r < 0 ? 99 : r) + (v.lang === 'en-US' || v.lang === 'en_US' ? 0 : 50);
}
const englishVoices = () => speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang)).sort((a, b) => rankV(a) - rankV(b));

export function fillVoices(sel) {
  const saved = localStorage.voice || 'google';
  sel.innerHTML = '<option value="google">Google（預設）</option>' + englishVoices().map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${v.lang})</option>`).join('');
  sel.value = [...sel.options].some(o => o.value === saved) ? saved : 'google';
}

export const player = new Audio();
let ttsGen = 0;

function ttsChunks(text) {
  const out = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > 190 && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

function sysSpeak(text, rate) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const name = localStorage.voice;
  let v = speechSynthesis.getVoices().find(v => v.name === name && name !== 'google');
  if (!v) v = englishVoices()[0];
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = rate;
  speechSynthesis.speak(u);
}

export function speak(text, rate) {
  rate = rate || 1;
  speechSynthesis.cancel();
  player.pause();
  if ((localStorage.voice || 'google') !== 'google') return sysSpeak(text, rate);
  const gen = ++ttsGen;
  const q = ttsChunks(text);
  let failed = false;
  const playNext = () => {
    if (gen !== ttsGen || !q.length) return;
    const c = q.shift();
    player.src = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=' + encodeURIComponent(c);
    player.onended = playNext;
    player.onerror = () => { if (gen !== ttsGen || failed) return; failed = true; sysSpeak([c, ...q].join(' '), rate); };
    player.playbackRate = rate;
    player.defaultPlaybackRate = rate;
    player.preservesPitch = true;
    const p = player.play();
    if (p) p.catch(e => { if (e.name !== 'AbortError' && !failed && gen === ttsGen) { failed = true; sysSpeak([c, ...q].join(' '), rate); } });
  };
  playNext();
}

export function speakThen(text, rate, cb) {
  const v = localStorage.voice || 'google';
  speak(text, rate);
  if (v === 'google') {
    const done = () => { player.removeEventListener('ended', done); setTimeout(cb, 250); };
    player.addEventListener('ended', done);
    setTimeout(() => { player.removeEventListener('ended', done); }, 15000);
  } else setTimeout(cb, 600 + text.length * 120 / rate);
}
