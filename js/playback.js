// Plays a slice of the user's captured audio (Float32 PCM) through Web Audio.
export const TICKS = 1e7; // Azure Offset/Duration are in 100-ns ticks

// Sample range for a segment, padded and widened to at least `minLen` seconds so very short
// phonemes stay audible. Returns null for missing/invalid timing data.
export function segmentRange(offTicks, durTicks, rate, len, { pad = 0.08, minLen = 0.2 } = {}) {
  if (![offTicks, durTicks, rate, len].every(Number.isFinite) || durTicks < 0 || rate <= 0) return null;
  let s = offTicks / TICKS - pad, e = (offTicks + durTicks) / TICKS + pad;
  if (e - s < minLen) { const mid = (s + e) / 2; s = mid - minLen / 2; e = mid + minLen / 2; }
  const s0 = Math.max(0, Math.floor(s * rate)), s1 = Math.min(len, Math.ceil(e * rate));
  return s1 > s0 ? { s0, s1 } : null;
}

let playCtx = null, curSrc = null;

export function stopSeg() {
  if (curSrc) { try { curSrc.stop(); } catch (e) { /* already stopped */ } curSrc = null; }
}

// Returns the played duration in seconds, or undefined when there is nothing to play.
export function playSeg(cap, offTicks, durTicks, pad) {
  if (!cap) return;
  const rg = segmentRange(offTicks, durTicks, cap.rate, cap.data.length, pad == null ? undefined : { pad });
  if (!rg) return;
  playCtx = playCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (playCtx.state === 'suspended') playCtx.resume();
  stopSeg();
  const b = playCtx.createBuffer(1, rg.s1 - rg.s0, cap.rate);
  b.copyToChannel(cap.data.subarray(rg.s0, rg.s1), 0);
  const src = playCtx.createBufferSource();
  src.buffer = b;
  src.connect(playCtx.destination);
  src.onended = () => { if (curSrc === src) curSrc = null; };
  src.start();
  curSrc = src;
  return (rg.s1 - rg.s0) / cap.rate;
}
