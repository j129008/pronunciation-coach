// Plays a slice of the user's captured audio (Float32 PCM), optionally slowed without changing pitch.
import { encodeWav } from './azure.js';

export const TICKS = 1e7; // Azure Offset/Duration are in 100-ns ticks

// Sample range for a segment, padded (default 120 ms each side) and widened to at least `minLen`
// seconds so very short phonemes stay audible. Returns null for missing/invalid timing data.
export function segmentRange(offTicks, durTicks, rate, len, { pad = 0.12, minLen = 0.2 } = {}) {
  if (![offTicks, durTicks, rate, len].every(Number.isFinite) || durTicks < 0 || rate <= 0) return null;
  let s = offTicks / TICKS - pad, e = (offTicks + durTicks) / TICKS + pad;
  if (e - s < minLen) { const mid = (s + e) / 2; s = mid - minLen / 2; e = mid + minLen / 2; }
  const s0 = Math.max(0, Math.floor(s * rate)), s1 = Math.min(len, Math.ceil(e * rate));
  return s1 > s0 ? { s0, s1 } : null;
}

// Which row (phoneme) is sounding at absolute source time t (seconds)? `only` restricts to one index,
// otherwise only mispronounced rows ('bad') are considered. Returns -1 if none.
export function activeIndex(rows, t, only = null) {
  if (t == null) return -1;
  return rows.findIndex((r, i) => (only == null ? r.bad : i === only) && Number.isFinite(r.off) && Number.isFinite(r.dur) && t >= r.off / TICKS && t < (r.off + r.dur) / TICKS);
}

let segAudio = null;

export function stopSeg() {
  if (segAudio) { const a = segAudio; segAudio = null; a.pause(); }
}

// Resolves (true if something played) when the segment ends or is stopped.
// opts: {pad, rate, onTick} — rate 0.5–1 (pitch preserved); onTick(absSec) runs every frame with the position in the
// original recording, then onTick(null) when playback ends — used to highlight the sound being played.
export function playSeg(cap, offTicks, durTicks, { pad, rate = 1, onTick } = {}) {
  return new Promise(resolve => {
    if (!cap) return resolve(false);
    const rg = segmentRange(offTicks, durTicks, cap.rate, cap.data.length, pad == null ? undefined : { pad });
    if (!rg) return resolve(false);
    stopSeg();
    const url = URL.createObjectURL(encodeWav(cap.data.subarray(rg.s0, rg.s1), cap.rate));
    const a = new Audio(url);
    a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = true;
    a.playbackRate = rate;
    let done = false;
    const t0 = rg.s0 / cap.rate;
    const fin = ok => { if (done) return; done = true; if (segAudio === a) segAudio = null; URL.revokeObjectURL(url); if (onTick) onTick(null); resolve(ok); };
    a.onended = () => fin(true);
    a.onpause = () => fin(true);
    a.onerror = () => fin(false);
    segAudio = a;
    a.play().then(() => {
      if (!onTick) return;
      const loop = () => { if (done) return; onTick(t0 + a.currentTime); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }).catch(() => fin(false));
  });
}
