// Azure neural TTS (REST) for "what you said" vs "what it should be": SSML <phoneme alphabet="ipa"> built from
// phoneme rows, so a respelling like "dhi-darg" is never read out letter by letter. Clips are cached in memory + IndexedDB.
import { ipaNorm } from './phonemes.js';

export const VOICE = 'en-US-JennyNeural';
export const SLOW = '-30%';

export const xmlEsc = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

// Azure en-US IPA has no symbol for flap / glottal stop; everything else from analyzeWord's normalized set is accepted.
const TTS_MAP = { 'ɾ': 't', 'ʔ': 't', 'n̩': 'ən', 'l̩': 'əl' };
const ttsPh = p => { const n = ipaNorm(p); return TTS_MAP[n] || n; };
const usable = p => p && p !== '—' && p !== '?';

// IPA strings for the expected word and for what the recognizer heard (omitted sounds dropped,
// unclear '?' sounds fall back to the expected one because there is nothing better to synthesize).
export function targetIpa(rows) { return rows.map(r => r.exp).filter(usable).map(ttsPh).join(''); }
export function heardIpa(rows) {
  return rows.map(r => (!r.bad ? r.exp : r.heard === '?' ? r.exp : r.heard)).filter(usable).map(ttsPh).join('');
}

export function phonemeSsml({ word, ipa, voice = VOICE, rate = SLOW }) {
  const inner = ipa ? `<phoneme alphabet="ipa" ph="${xmlEsc(ipa)}">${xmlEsc(word)}</phoneme>` : xmlEsc(word);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="${xmlEsc(voice)}"><prosody rate="${xmlEsc(rate)}">${inner}</prosody></voice></speak>`;
}

export const azureTtsReady = () => !!(globalThis.localStorage && localStorage.azKey && localStorage.azRegion);

// ---- cache (key = SSML text; the subscription key is never part of it) ----
const mem = new Map();
let dbP = null;
function db() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (!dbP) dbP = new Promise(res => {
    const rq = indexedDB.open('pc-tts', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('clips');
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => res(null);
  });
  return dbP;
}
async function idbGet(k) {
  const d = await db();
  if (!d) return null;
  return new Promise(res => { const rq = d.transaction('clips').objectStore('clips').get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); });
}
async function idbPut(k, v) {
  const d = await db();
  if (d) try { d.transaction('clips', 'readwrite').objectStore('clips').put(v, k); } catch (e) { /* quota / private mode */ }
}

// Returns an mp3 Blob or throws.
export async function synth(ssml, { key = localStorage.azKey, region = localStorage.azRegion } = {}) {
  if (mem.has(ssml)) return mem.get(ssml);
  let blob = await idbGet(ssml);
  if (!blob) {
    const resp = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' },
      body: ssml,
    });
    if (!resp.ok) throw new Error(`Azure TTS HTTP ${resp.status}`);
    blob = await resp.blob();
    idbPut(ssml, blob);
  }
  mem.set(ssml, blob);
  return blob;
}

let clip = null;
export function stopClip() { if (clip) { const a = clip; clip = null; a.pause(); } }
// Resolves true when the clip played to the end, false if it failed or was stopped.
export function playBlob(blob) {
  return new Promise(resolve => {
    stopClip();
    const url = URL.createObjectURL(blob), a = new Audio(url);
    let done = false;
    const fin = ok => { if (done) return; done = true; if (clip === a) clip = null; URL.revokeObjectURL(url); resolve(ok); };
    a.onended = () => fin(true);
    a.onpause = () => fin(a.ended); // 'pause' also fires right before 'ended'
    a.onerror = () => fin(false);
    clip = a;
    a.play().catch(() => fin(false));
  });
}

// Speak `word` pronounced as `ipa` (slowed). Resolves false on any failure so callers can fall back.
export async function sayIpa(word, ipa, opts = {}) {
  try { return await playBlob(await synth(phonemeSsml({ word, ipa, rate: opts.rate }))); } catch (e) { console.warn(e); return false; }
}
