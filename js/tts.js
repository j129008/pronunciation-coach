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

function sysSpeak(text, rate, done) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const name = localStorage.voice;
  let v = speechSynthesis.getVoices().find(v => v.name === name && name !== 'google');
  if (!v) v = englishVoices()[0];
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = rate;
  u.onend = done;
  u.onerror = done;
  speechSynthesis.speak(u);
}

// Speaks `text`. `onDone` runs once when playback ends or fails (never if superseded by a newer speak()),
// so chained playback (example word → word → your recording) also works when Google TTS falls back to system voices.
export function speak(text, rate, onDone) {
  rate = rate || 1;
  speechSynthesis.cancel();
  player.pause();
  const gen = ++ttsGen;
  let finished = false;
  const done = () => {
    if (finished || gen !== ttsGen) return;
    finished = true;
    if (onDone) setTimeout(onDone, 250);
  };
  if ((localStorage.voice || 'google') !== 'google') return sysSpeak(text, rate, done);
  const q = ttsChunks(text);
  let failed = false;
  const fallback = c => { if (failed || gen !== ttsGen) return; failed = true; sysSpeak([c, ...q].join(' '), rate, done); };
  const playNext = () => {
    if (gen !== ttsGen) return;
    if (!q.length) return done();
    const c = q.shift();
    player.src = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=' + encodeURIComponent(c);
    player.onended = playNext;
    player.onerror = () => fallback(c);
    player.playbackRate = rate;
    player.defaultPlaybackRate = rate;
    player.preservesPitch = true;
    const p = player.play();
    if (p) p.catch(e => { if (e.name !== 'AbortError') fallback(c); });
  };
  playNext();
}

export function stopSpeaking() {
  ttsGen++;
  speechSynthesis.cancel();
  player.pause();
}
