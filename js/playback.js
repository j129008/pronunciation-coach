// Plays a slice of the user's captured audio (Float32 PCM) through Web Audio.
let playCtx = null;

export function playSeg(cap, startSec, endSec, pad) {
  pad = pad == null ? 0.08 : pad;
  if (!cap) return;
  playCtx = playCtx || new (window.AudioContext || window.webkitAudioContext)();
  const r = cap.rate, s0 = Math.max(0, Math.floor((startSec - pad) * r)), s1 = Math.min(cap.data.length, Math.ceil((endSec + pad) * r));
  if (s1 <= s0) return;
  const b = playCtx.createBuffer(1, s1 - s0, r);
  b.copyToChannel(cap.data.subarray(s0, s1), 0);
  const src = playCtx.createBufferSource();
  src.buffer = b;
  src.connect(playCtx.destination);
  src.start();
  return (s1 - s0) / r;
}
