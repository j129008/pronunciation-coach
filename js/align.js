// Word-level alignment of the target sentence against what was recognized, plus tips.
import { tokenize, norm } from './normalize.js';

export function lev(a, b) {
  const m = a.length, n = b.length, D = [];
  for (let i = 0; i <= m; i++) D[i] = [i];
  for (let j = 0; j <= n; j++) D[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return D;
}

export function charSim(a, b) {
  const D = lev(a, b);
  return 1 - D[a.length][b.length] / Math.max(a.length, b.length, 1);
}

// T, H: arrays of word keys. Returns [{t,h,s:'ok'|'bad'|'miss'|'extra'}]
export function align(T, H) {
  const m = T.length, n = H.length, D = [];
  for (let i = 0; i <= m; i++) { D[i] = new Array(n + 1); D[i][0] = i; }
  for (let j = 0; j <= n; j++) D[0][j] = j;
  const sub = (a, b) => a === b ? 0 : (charSim(a, b) > 0.5 ? 0.8 : 1);
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub(T[i - 1], H[j - 1]));
  }
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + sub(T[i - 1], H[j - 1]))) < 1e-9) {
      out.push({ t: T[i - 1], h: H[j - 1], s: T[i - 1] === H[j - 1] ? 'ok' : 'bad' });
      i--; j--;
    } else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) {
      out.push({ t: T[i - 1], s: 'miss' });
      i--;
    } else {
      out.push({ h: H[j - 1], s: 'extra' });
      j--;
    }
  }
  return out.reverse();
}

export function scoreHyp(Tsrc, h) {
  const G = tokenize(Tsrc), T = G.flatMap(g => g.k), own = G.flatMap((g, gi) => g.k.map(() => gi));
  const a = align(T, norm(h));
  const ok = a.filter(x => x.s === 'ok').length;
  const ex = a.filter(x => x.s === 'extra').length;
  // regroup to display words
  const disp = [];
  let ti = 0, last = -1;
  for (const x of a) {
    if (x.s === 'extra') { disp.push(x); continue; }
    const gi = own[ti++];
    if (gi !== last) { disp.push({ t: x.t, d: G[gi].d, parts: [x] }); last = gi; }
    else disp[disp.length - 1].parts.push(x);
  }
  for (const g of disp) if (g.parts) {
    const ps = g.parts;
    g.s = ps.every(p => p.s === 'ok') ? 'ok' : ps.every(p => p.s === 'miss') ? 'miss' : 'bad';
    g.h = ps.map(p => p.h).filter(Boolean).join(' ');
    if (ps.length === 1) { g.t = ps[0].t; } else g.t = ps.map(p => p.t).join(' ');
  }
  return { a, disp, score: Math.round(100 * ok / Math.max(T.length + ex * 0.5, 1)) };
}

// Chinese coaching tips derived from the word-level alignment
export function tipsFor(al) {
  const tips = new Set();
  for (const x of al) {
    const t = x.t || '', h = x.h || '';
    if (x.s === 'miss') {
      if (['a', 'an', 'the'].includes(t)) tips.add('冠詞 a/an/the 被吞掉了：雖然要輕讀，但仍要發出聲音。');
      else tips.add(`漏掉「${t}」：整句要把每個字都唸到，可放慢速度。`);
    }
    if (x.s !== 'bad') continue;
    if (/ed$/.test(t) && h === t.replace(/e?d$/, '')) tips.add(`過去式 -ed 字尾不見了（${t}）：注意 /t/、/d/、/ɪd/ 要輕輕發出。`);
    if (/s$/.test(t) && h === t.replace(/e?s$/, '')) tips.add(`複數/第三人稱 -s 字尾不見了（${t}）：結尾 /s/ /z/ 要發出來。`);
    if (/s$/.test(h) && t === h.replace(/e?s$/, '')) tips.add(`多加了 -s（${t}）：注意單複數。`);
    if (/th/.test(t)) tips.add(`「th」音（${t}）：舌尖輕放上下齒之間吹氣 /θ/ 或振動 /ð/，不要唸成 s/z/d/f。`);
    if ((/v/.test(t) && /w|b|f/.test(h)) || (/w/.test(t) && /v/.test(h))) tips.add(`v/w 混淆（${t}→${h}）：/v/ 上齒輕咬下唇並振動；/w/ 嘴唇圓起不碰牙齒。`);
    if ((/l/.test(t) && /n/.test(h) && !/n/.test(t)) || (/n/.test(t) && /l/.test(h) && !/l/.test(t))) tips.add(`l/n 混淆（${t}→${h}）：/n/ 由鼻腔出氣；/l/ 舌尖頂上齒齦、氣從舌頭兩側出。`);
    if (/r/.test(t) && /l/.test(h) || /l/.test(t) && /r/.test(h)) tips.add(`r/l 混淆（${t}→${h}）：/r/ 舌尖不碰上顎並捲起；/l/ 舌尖要頂住。`);
    if (h && t.startsWith(h) && t.length > h.length && !/(ed|s)$/.test(t)) tips.add(`字尾子音被吞掉（${t}→${h}）：英文結尾子音如 t/d/k/g/p/b 要輕輕收尾，不要省略。`);
    else if (h && h.length > 2 && t.length > 2 && h.slice(0, -1) === t.slice(0, -1)) tips.add(`結尾子音不清楚（${t}→${h}）：注意最後一個音。`);
    if (/sh/.test(t) && /s/.test(h) && !/sh/.test(h) || /s/.test(t) && /sh/.test(h) && !/sh/.test(t)) tips.add(`s/sh 混淆（${t}→${h}）：/ʃ/ 嘴唇嘟起、舌頭後縮。`);
    if (/^(i|e)/.test(t) && charSim(t, h) > 0.5) tips.add(`母音長短（${t}→${h}）：注意 /iː/（長、嘴角拉開）與 /ɪ/（短、放鬆）等的差別。`);
  }
  if (!tips.size && al.some(x => x.s === 'bad')) tips.add('有些字被聽成別的字：試試慢速聽示範，跟讀並注意重音與每個子音。');
  return [...tips].slice(0, 8);
}
