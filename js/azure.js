// Azure Speech pronunciation assessment (REST): mic capture, WAV encoding, request.
export function encodeWav(f32, inRate) {
  const r = 16000, ratio = inRate / r, n = Math.floor(f32.length / ratio), pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const s0 = Math.floor(i * ratio), s1 = Math.min(f32.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = s0; j < s1; j++) sum += f32[j];
    let v = sum / Math.max(1, s1 - s0);
    v = Math.max(-1, Math.min(1, v));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const b = new ArrayBuffer(44 + n * 2), d = new DataView(b);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, r, true);
  d.setUint32(28, r * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); ws(36, 'data'); d.setUint32(40, n * 2, true);
  new Int16Array(b, 44).set(pcm);
  return new Blob([b], { type: 'audio/wav' });
}

export function b64utf8(s) {
  const by = new TextEncoder().encode(s);
  let bin = '';
  by.forEach(c => { bin += String.fromCharCode(c); });
  return btoa(bin);
}

export function pronunciationHeader(referenceText) {
  return b64utf8(JSON.stringify({
    ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive',
    EnableMiscue: true, EnableProsodyAssessment: true, PhonemeAlphabet: 'IPA', NBestPhonemeCount: 5,
  }));
}

// Starts recording from the mic. Resolves `done` with {data, rate, peak} after stop() (or after maxMs).
export async function captureMic({ maxMs = 30000 } = {}) {
  const st = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(st);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const bufs = [];
  let peak = 0;
  proc.onaudioprocess = e => {
    const c = new Float32Array(e.inputBuffer.getChannelData(0));
    for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > peak) peak = a; }
    bufs.push(c);
  };
  const mute = ctx.createGain();
  mute.gain.value = 0;
  src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
  let finish, stopped = false;
  const done = new Promise(r => { finish = r; });
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    proc.disconnect(); src.disconnect();
    st.getTracks().forEach(t => t.stop());
    const rate = ctx.sampleRate;
    await ctx.close();
    const len = bufs.reduce((a, b) => a + b.length, 0), all = new Float32Array(len);
    let o = 0;
    for (const b of bufs) { all.set(b, o); o += b.length; }
    finish({ data: all, rate, peak });
  };
  const timer = setTimeout(stop, maxMs);
  return { stop, done };
}

// Returns {ok:true, json} or {ok:false, message} (HTTP / recognition failures). Network errors throw.
export async function assess(wav, referenceText, { key, region }) {
  const resp = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Accept': 'application/json',
      'Pronunciation-Assessment': pronunciationHeader(referenceText),
    },
    body: wav,
  });
  const txt = await resp.text();
  if (!resp.ok) return { ok: false, message: `Azure HTTP ${resp.status} ${resp.statusText}：${txt.slice(0, 400)}` };
  const j = JSON.parse(txt);
  if (j.RecognitionStatus !== 'Success' || !j.NBest || !j.NBest.length) return { ok: false, message: 'Azure RecognitionStatus：' + (j.RecognitionStatus || txt.slice(0, 300)) };
  return { ok: true, json: j };
}
