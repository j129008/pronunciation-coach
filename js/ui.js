// All DOM wiring: sidebar list, dashboard, practice card, recording, results, Azure result cards.
import { $, esc, dkey } from './util.js';
import { IDB, validItems, prepareItems } from './data.js';
import * as P from './progress.js';
import { scoreHyp, tipsFor } from './align.js';
import { phTip, ipaInfo, ipaHint, analyzeWord, ERR_ZH } from './phonemes.js';
import { fillVoices, speak, stopSpeaking } from './tts.js';
import { playSeg, stopSeg } from './playback.js';
import { encodeWav, captureMic, assess } from './azure.js';

const TL = { sentence: '句子', vocab: '單字', extra: '補充' };
const ST = { new: ['未練', '#b0b4bd'], weak: ['要加強', '#e5484d'], fair: ['還不錯', '#f5a524'], good: ['已熟練', '#30a46c'], due: ['待複習', '#7c5cff'] };
const RH = 44, HH = 36;

// ---- data-loading screen ----
export function showLoadScreen() {
  return new Promise(ok => {
    $('loadScreen').style.display = 'flex';
    $('dataFile').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { ok({ items: validItems(JSON.parse(await f.text())), save: true }); }
      catch (err) { $('loadErr').textContent = '讀取失敗：' + err.message; }
    };
    $('loadSample').onclick = async () => {
      try { const r = await fetch('data/sample.json'); ok({ items: validItems(await r.json()), save: false }); }
      catch (err) { $('loadErr').textContent = '無法載入範例：' + err.message; }
    };
  });
}
export function hideLoadScreen() { $('loadScreen').style.display = 'none'; }

// ---- app state ----
let DATA, ORDERED, byId;
let filtered = [], cur = null;
let fStatus = 'all', fType = '', fQuery = '';
const openG = new Set();
let rows = [];
let recog = null, mr = null, chunks = [], stream = null, busy = false, azRec = null;
let lastCap = null, azWords = [], suppressRec = false;

const statusOf = (id, now) => P.statusOf(id, now);
const say = (text, rate) => speak(text, rate || ($('slow').checked ? 0.7 : 1));

function inFilter(d, now) {
  if (fType && d.t !== fType) return false;
  if (fQuery && !(d.e + ' ' + d.z + ' ' + (d.x || '') + ' #' + d.i).toLowerCase().includes(fQuery)) return false;
  if (fStatus !== 'all' && statusOf(d.i, now) !== fStatus) return false;
  return true;
}
function applyFilter() { const now = Date.now(); filtered = ORDERED.filter(d => inFilter(d, now)); renderList(); }

// ---- dashboard ----
function renderDash() {
  const PROG = P.getProg();
  const now = Date.now(), c = { new: 0, weak: 0, fair: 0, good: 0, due: 0 };
  let sum = 0, n = 0;
  for (const d of DATA) {
    const s = statusOf(d.i, now);
    c[s]++;
    const p = PROG[d.i];
    if (p && p.a) { sum += p.l; n++; }
  }
  const today = P.todayCount(now), T = DATA.length;
  $('bar').innerHTML = ['good', 'due', 'fair', 'weak'].map(s => `<span style="width:${100 * c[s] / T}%;background:${ST[s][1]}" title="${ST[s][0]} ${c[s]}"></span>`).join('');
  $('stats').innerHTML = Object.keys(ST).map(s => `<span class="stat" data-chip="${s}"><i class="dot" style="background:${ST[s][1]}"></i>${ST[s][0]} <b>${c[s]}</b></span>`).join('') +
    `<span class="stat">📅 今天 <b>${today}</b></span><span class="stat">🔥 連續 <b>${P.streak()}</b> 天</span><span class="stat">📊 平均 <b>${n ? Math.round(sum / n) : '-'}</b></span>`;
  document.querySelectorAll('#chips .chip').forEach(ch => {
    const s = ch.dataset.st;
    ch.classList.toggle('on', s === fStatus);
    ch.querySelector('em').textContent = s === 'all' ? T : c[s];
  });
}

// ---- virtual list ----
function buildRows() {
  const PROG = P.getProg();
  const groups = new Map();
  for (const d of filtered) { if (!groups.has(d.L)) groups.set(d.L, []); groups.get(d.L).push(d); }
  const expandAll = !!fQuery || fStatus !== 'all';
  rows = [];
  for (const [L, items] of groups) {
    let done = 0, sum = 0, n = 0;
    for (const d of items) { const p = PROG[d.i]; if (p && p.a) { done++; sum += p.l; n++; } }
    const open = expandAll ? !openG.has('x' + L) : openG.has(L);
    rows.push({ h: 1, L, items: items.length, done, avg: n ? Math.round(sum / n) : null, open });
    if (open) for (const d of items) rows.push({ d });
  }
  let y = 0;
  for (const r of rows) { r.y = y; y += r.h ? HH : RH; }
  return y;
}
function renderList() {
  const total = buildRows();
  $('vinner').style.height = total + 'px';
  $('lcount').textContent = filtered.length + ' 筆';
  drawRows();
}
function drawRows() {
  const PROG = P.getProg();
  const box = $('vlist'), top = box.scrollTop, bot = top + box.clientHeight + 200, now = Date.now();
  let h = '';
  for (const r of rows) {
    if (r.y + RH < top - 200) continue;
    if (r.y > bot) break;
    if (r.h) {
      h += `<div class="grp" style="top:${r.y}px" data-g="${r.L}"><span>${r.open ? '▾' : '▸'} ${r.L}</span><small>${r.done}/${r.items}${r.avg != null ? ' • 平均 ' + r.avg : ''}</small><i class="gbar"><i style="width:${100 * r.done / r.items}%"></i></i></div>`;
    } else {
      const d = r.d, p = PROG[d.i], s = statusOf(d.i, now);
      h += `<div class="row${cur === d ? ' cur' : ''}" style="top:${r.y}px" data-i="${d.i}"><i class="dot" style="background:${ST[s][1]}" title="${ST[s][0]}"></i><span class="rt">${esc(d.e)}</span><span class="rm">${p && p.a ? `<b>${p.b}</b><small>×${p.a}</small>` : `<small>${TL[d.t]}</small>`}${s === 'due' ? '<em class="due">待複習</em>' : ''}</span></div>`;
    }
  }
  $('vinner').innerHTML = h;
}
function scrollToCur() {
  if (!cur) return;
  if (!openG.has(cur.L)) { openG.add(cur.L); openG.delete('x' + cur.L); renderList(); }
  const r = rows.find(r => r.d === cur);
  if (!r) return;
  const b = $('vlist');
  if (r.y < b.scrollTop || r.y > b.scrollTop + b.clientHeight - RH) b.scrollTop = r.y - b.clientHeight / 3;
  drawRows();
}

// ---- practice card ----
function show(d, reason) {
  if (!d) return;
  cur = d;
  const p = P.getProg()[d.i], s = statusOf(d.i);
  $('meta').innerHTML = `<span class="tag" style="background:${ST[s][1]}">${ST[s][0]}</span> #${d.i}・${TL[d.t]}・${esc(d.L)}${p && p.a ? `・最佳 <b>${p.b}</b>・上次 ${p.l}・練 ${p.a} 次・歷史 ${p.h.join(' → ')}` : ''}`;
  $('reason').textContent = reason || '';
  $('reason').style.display = reason ? 'inline-block' : 'none';
  $('tgt').textContent = d.e;
  $('ipa').textContent = d.p ? '/' + d.p + '/' : '';
  $('zh').innerHTML = esc(d.z) + (d.x ? `<br><small>例句：${esc(d.x)}</small>` : '') + (d.o ? `<br><small>原本說法：${esc(d.o)}</small>` : '');
  $('result').style.display = 'none';
  $('summary').style.display = 'none';
  $('interim').textContent = '';
  clearMine();
  lastCap = null;
  azWords = [];
  $('status').innerHTML = '';
  location.hash = d.i;
  scrollToCur();
  drawRows();
  if (innerWidth < 900) document.body.classList.remove('side-open');
}
function next() {
  if (cur) P.markSeen(cur.i);
  const r = P.smartPick(filtered, Date.now(), cur && cur.i);
  if (!r) return alert('目前篩選條件下沒有項目');
  show(r.d, r.why);
}
function step(k) {
  const a = filtered.length ? filtered : ORDERED;
  const j = cur ? a.indexOf(cur) : -1;
  show(a[(j + k + a.length) % a.length]);
}
function showSummary(score, prevBest, p) {
  const s = $('summary');
  s.style.display = 'flex';
  const st = statusOf(cur.i);
  const diff = prevBest == null ? '第一次練習' : score > prevBest ? `🎉 新紀錄！(+${score - prevBest})` : score === prevBest ? '平最佳紀錄' : `最佳 ${prevBest}（差 ${prevBest - score}）`;
  s.innerHTML = `<div class="big" style="color:${ST[st][1]}">${score}</div><div><div><span class="tag" style="background:${ST[st][1]}">${ST[st][0]}</span> 這次 <b>${score}</b> ・ ${diff}</div><small>最近：${p.h.join(' → ')}（共 ${p.a} 次）</small></div>
 <div class="sp"></div><button id="again" class="ghost">↺ 再唸一次</button><button id="next2" class="primary">▶ 下一題 <kbd>N</kbd></button>`;
  $('again').onclick = () => $('rec').click();
  $('next2').onclick = next;
}
function recordAttempt(score) {
  if (!cur) return;
  const r = P.recordAttempt(cur.i, score);
  renderDash();
  renderList();
  showSummary(r.score, r.prevBest, r.p);
}

// ---- results ----
function renderWeak() {
  const w = P.getWeak();
  const arr = Object.entries(w).filter(([k, v]) => v.bad > 0).sort((a, b) => (b[1].bad - b[1].ok / 2) - (a[1].bad - a[1].ok / 2)).slice(0, 60);
  $('weakList').innerHTML = arr.length ? arr.map(([k, v]) => `<span class="w bad" style="font-size:15px;cursor:pointer" data-w="${esc(k)}" title="點擊聽發音">${esc(k)} <small>✗${v.bad} ✓${v.ok}${v.heard ? ' 聽成:' + esc(v.heard) : ''}</small></span>`).join('') : '<small>尚無紀錄</small>';
}
function renderConf() {
  const c = P.getConf();
  const arr = Object.entries(c).sort((a, b) => b[1].n - a[1].n).slice(0, 15);
  $('confList').innerHTML = arr.length ? '<table class="cmp"><tr><th>標準</th><th>你常唸成</th><th>次數</th><th>例字</th><th>建議</th></tr>' + arr.map(([k, v]) => {
    const [e, h] = k.split('→');
    return `<tr><td class="pe">/${esc(e)}/</td><td class="ph-bad">/${esc(h)}/</td><td>${v.n}</td><td>${esc((v.w || []).slice(-4).join(', '))}</td><td><small>${esc(phTip(e, h, false, ''))}</small></td></tr>`;
  }).join('') + '</table>' : '<small>尚無紀錄（使用 Azure 模式後會累積）</small>';
}
function showResult(best, alts) {
  $('azure').innerHTML = '';
  const { a, score } = best;
  $('result').style.display = 'block';
  $('score').textContent = score + '%';
  $('score').style.color = score >= 85 ? '#1a8a1a' : score >= 60 ? '#c80' : '#c00';
  $('words').innerHTML = (best.disp || a).map(x => x.s === 'extra' ? `<span class="w extra">+${esc(x.h)}</span>` : `<span class="w ${x.s}" data-w="${esc(x.d || x.t)}">${esc(x.d || x.t)}${x.s === 'bad' ? `<span class="heard">${esc(x.h)}</span>` : ''}</span>`).join('');
  $('heardAll').innerHTML = '<small>辨識結果（最佳）：' + alts.map((h, i) => i ? esc(h) : '<b>' + esc(h) + '</b>').join(' ｜ ') + '</small>';
  const t = tipsFor(a);
  $('tips').innerHTML = t.length ? '<b>💡 建議</b><ul>' + t.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : (score === 100 ? '🎉 完美！' : '');
  P.recordWeakWords(a);
  P.setWeakItem(cur.i, score);
  renderWeak();
  if (!suppressRec) recordAttempt(score);
}

// ---- recording (default: Web Speech) ----
function status(s) { $('status').innerHTML = '<small>' + s + '</small>'; }

// ---- the user's last recording (full-take playback + re-record) ----
let myUrl = null;
function setMyAudio(blob) {
  if (myUrl) URL.revokeObjectURL(myUrl);
  myUrl = URL.createObjectURL(blob);
  const a = $('myAudio');
  a.src = myUrl;
  a.style.display = 'block';
  $('playMine').hidden = false;
  $('reRec').hidden = false;
}
function clearMine() {
  const a = $('myAudio');
  a.pause();
  a.removeAttribute('src');
  a.load();
  a.style.display = 'none';
  if (myUrl) URL.revokeObjectURL(myUrl);
  myUrl = null;
  stopSeg();
  $('playMine').hidden = true;
  $('reRec').hidden = true;
}
function playMine() {
  const a = $('myAudio');
  if (!myUrl) return;
  stopSpeaking();
  stopSeg();
  a.currentTime = 0;
  a.play().catch(() => {});
}
function toggleMine() {
  const a = $('myAudio');
  if (!a.paused) { a.pause(); a.currentTime = 0; } else playMine();
}
function syncRecButtons() { $('playMine').disabled = $('reRec').disabled = busy; }
// silence everything that could bleed into the mic before a new take
function prepareToRecord() { stopSpeaking(); stopSeg(); $('myAudio').pause(); }
const useAzure = () => $('azOn').checked && !!localStorage.azKey && !!localStorage.azRegion;
function updBadge() {
  const b = $('modeBadge');
  if (b) { const az = useAzure(); b.textContent = az ? 'Azure 評分中' : '預設模式'; b.style.background = az ? '#0a7' : '#888'; }
}
async function startAudio() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mr = new MediaRecorder(stream);
    chunks = [];
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => {
      setMyAudio(new Blob(chunks, { type: mr.mimeType }));
      stream.getTracks().forEach(t => t.stop());
    };
    mr.start();
  } catch (e) { status('無法使用麥克風：' + esc(e.message)); }
}
function stopAudio() { if (mr && mr.state !== 'inactive') mr.stop(); }

async function defaultRecognize() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return alert('此瀏覽器不支援語音辨識，請使用 Chrome 或 Edge。');
  const item = cur;
  prepareToRecord();
  recog = new SR();
  recog.lang = 'en-US'; recog.interimResults = true; recog.maxAlternatives = 5; recog.continuous = false;
  const finals = [];
  busy = true;
  syncRecButtons();
  $('rec').textContent = '■ 停止';
  status('🎙️ 請開始唸…');
  await startAudio();
  recog.onresult = e => {
    let it = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finals.push([...r].map(x => x.transcript)); else it += r[0].transcript;
    }
    $('interim').textContent = it;
  };
  recog.onerror = e => status('辨識錯誤：' + e.error + (e.error === 'not-allowed' ? '（請允許麥克風；file:// 可能被擋，請改用 localhost）' : e.error === 'network' ? '（需連網，Chrome 語音辨識走 Google 伺服器）' : ''));
  recog.onend = () => {
    busy = false;
    syncRecButtons();
    $('rec').textContent = '● 錄音並評分';
    stopAudio();
    $('interim').textContent = '';
    if (cur !== item) { clearMine(); return; } // user moved on: don't score the wrong item
    if (!finals.length) { status('沒有聽到聲音，請再試一次。'); return; }
    const tops = finals.map(f => f[0]);
    const set = new Set([tops.join(' ')]);
    finals.forEach((f, i) => f.forEach(alt => { const c = tops.slice(); c[i] = alt; set.add(c.join(' ')); }));
    finals.flat().forEach(x => set.add(x));
    const combos = [...set];
    const res = combos.map(h => scoreHyp(cur.e, h));
    let bi = 0;
    res.forEach((r, i) => { if (r.score > res[bi].score) bi = i; });
    status('完成。可以按下方播放器聽自己的聲音，再按 🔊 對照。');
    showResult(res[bi], [combos[bi], ...combos.filter((c, i) => i !== bi).slice(0, 4)]);
  };
  recog.start();
}

// ---- recording (Azure) ----
function azReset() { busy = false; syncRecButtons(); $('rec').textContent = '● 錄音並評分'; }
async function azureAssess() {
  if (azRec) { azRec.stop(); return; }
  const item = cur;
  prepareToRecord();
  let cap;
  try { cap = await captureMic({ maxMs: 30000 }); } catch (e) { status('無法使用麥克風：' + esc(e.message)); return; }
  azRec = cap;
  busy = true;
  syncRecButtons();
  $('rec').textContent = '■ 停止並評分';
  status('🎙️ Azure 模式：請唸出整句，唸完按「停止並評分」（最長 30 秒）');
  const { data, rate, peak } = await cap.done;
  azRec = null;
  azReset();
  if (cur !== item) return; // user moved on: don't score the wrong item
  lastCap = { data, rate };
  const wav = encodeWav(data, rate);
  setMyAudio(wav);
  if (peak < 0.01) {
    status(`⚠️ 麥克風幾乎沒有聲音（峰值 ${peak.toFixed(4)}）。請到 Chrome 網址列左側 🔒 / chrome://settings/content/microphone 確認選到正確的麥克風，並檢查 macOS 系統設定 → 隱私權 → 麥克風。`);
    return;
  }
  status(`上傳到 Azure 評分中…（${(data.length / rate).toFixed(1)} 秒）`);
  try {
    const res = await assess(wav, item.e, { key: localStorage.azKey, region: localStorage.azRegion });
    if (cur !== item) return;
    if (!res.ok) { status(esc(res.message)); return; }
    renderAzure(res.json);
  } catch (e) {
    if (cur !== item) return;
    status('Azure 錯誤：' + esc(e.message) + ' → 改用預設模式，請再唸一次');
    defaultRecognize();
  }
}

function renderAzure(j) {
  const nb = j.NBest[0], p = nb.PronunciationAssessment || nb;
  const text = j.DisplayText || nb.Display || nb.Lexical || '';
  const base = scoreHyp(cur.e, text);
  suppressRec = true;
  showResult(base, [text]);
  suppressRec = false;
  const f = v => v == null ? '-' : Math.round(v);
  const words = (nb.Words || []).map(analyzeWord);
  azWords = words;
  const issues = [];
  const conf = P.getConf();
  for (const w of words) {
    if (w.et === 'Insertion') continue;
    for (const r of w.rows) if (r.bad || w.et === 'Omission') {
      const k = r.exp + '→' + r.heard;
      issues.push({ w: w.word, k, r, score: r.score });
      conf[k] = conf[k] || { n: 0, w: [] };
      conf[k].n++;
      if (!conf[k].w.includes(w.word)) conf[k].w.push(w.word);
      conf[k].w = conf[k].w.slice(-8);
    }
  }
  P.saveConf(conf);
  renderConf();
  // dedupe by confusion, worst first
  const seen = new Set(), top = [];
  for (const x of issues.sort((a, b) => a.score - b.score)) {
    if (seen.has(x.k)) continue;
    seen.add(x.k);
    top.push(x);
    if (top.length >= 5) break;
  }
  let h = `<hr><b>Azure 評估</b>：總分 ${f(p.PronScore)}・準確度 ${f(p.AccuracyScore)}・流暢度 ${f(p.FluencyScore)}・完整度 ${f(p.CompletenessScore)}・韻律 ${f(p.ProsodyScore)}
 <div style="margin:6px 0"><button id="abAll">🔁 整句 A/B（標準 → 我的）</button></div>`;
  if (top.length) h += '<div class="issues"><b>🎯 你這句最需要改的音</b><ol>' + top.map(x => `<li><b>${esc(x.w)}</b>：/<span class="pe">${esc(x.r.exp)}</span>/ → /<span class="ph-bad">${esc(x.r.heard)}</span>/ — ${esc(phTip(x.r.exp, x.r.heard, x.r.isFinal, x.w))}</li>`).join('') + '</ol></div>';
  else h += '<div class="issues">🎉 沒有明顯的錯誤音素！</div>';
  h += '<div class="cards">' + words.map((w, i) => {
    const cls = w.et === 'Omission' ? 'miss' : (w.et === 'None' && w.score >= 80 ? 'ok' : 'bad');
    return `<div class="wcard ${cls}"><div><b style="font-size:18px">${esc(w.word)}</b> <small>${f(w.score)}分 ${ERR_ZH[w.et] ? '・' + ERR_ZH[w.et] : ''}</small>
  <button class="sm" data-std="${i}">🔊 標準</button>${w.et !== 'Omission' && lastCap ? `<button class="sm" data-mine="${i}">🎤 我的</button>` : ''}</div>
  <table class="cmp"><tr><th>字母</th>${w.rows.map(r => `<td class="lt">${esc(r.let || '')}</td>`).join('')}</tr>
  <tr><th>標準<br><small>（點我聽）</small></th>${w.rows.map((r, k) => `<td class="phc ${r.bad ? 'pe' : ''}" data-pe="${i},${k}" title="${esc(ipaHint(r.exp))}">${esc(r.exp)}</td>`).join('')}</tr>
  <tr><th>你的<br><small>（點我聽）</small></th>${w.rows.map((r, k) => `<td class="phc ${r.bad ? 'ph-bad' : 'ph-ok'}" data-ph="${i},${k}" title="${esc(r.heard !== r.exp && r.heard !== '—' ? '你唸成 ' + ipaHint(r.heard) : '點我聽你自己這個音')}">${esc(r.heard)}</td>`).join('')}</tr>
  <tr><th>分數</th>${w.rows.map(r => `<td><small>${f(r.score)}</small></td>`).join('')}</tr></table><div class="phint" id="phint${i}"></div></div>`;
  }).join('') + '</div>';
  $('azure').innerHTML = h + '<small>👉 點「標準」格：聽這個音的示範字；點「你的」格：只播你自己唸的那一小段。點單字卡其他地方：先播標準發音（慢速）再播你自己的那段錄音。紅色＝不準的音素；「你的發音」為 Azure 判斷最像的音。</small>';
  status('Azure 評估完成');
  recordAttempt(p.PronScore != null ? p.PronScore : base.score);
}

function onAzureClick(e) {
  const t = e.target;
  if (!t.closest) return;
  const std = t.closest('[data-std]'), mine = t.closest('[data-mine]'), card = t.closest('.wcard'), ab = t.closest('#abAll');
  const W = azWords;
  const pe = t.closest('[data-pe]'), pm = t.closest('[data-ph]');
  if (pe || pm) {
    const [wi, k] = (pe || pm).dataset[pe ? 'pe' : 'ph'].split(',').map(Number);
    const w = W[wi], r = w && w.rows[k];
    if (!r) return;
    document.querySelectorAll('.phc.sel').forEach(x => x.classList.remove('sel'));
    (pe || pm).classList.add('sel');
    const box = document.getElementById('phint' + wi);
    if (pe) {
      const x = ipaInfo(r.exp);
      if (box) box.innerHTML = `🔊 <b>${esc(r.let || '')}</b> → ${esc(ipaHint(r.exp))}` + (x ? `　<small>示範字：<b>${esc(x.w)}</b>，接著唸 ${esc(w.word)}</small>` : '');
      if (x) speak(x.w, 0.7, () => speak(w.word, 0.7)); else speak(w.word, 0.7);
    } else {
      let m = '🎤 你的這個音';
      if (r.heard === '—') m = '⚠️ 這個音你沒唸出來（漏音）';
      else if (r.heard !== r.exp) m += `：你唸成 ${esc(ipaHint(r.heard))}<br>✅ 應該是 ${esc(ipaHint(r.exp))}`;
      else m += `：${esc(ipaHint(r.exp))}`;
      if (!lastCap || r.off == null || w.et === 'Omission') m += '<br><small>（沒有錄音或時間資料可播）</small>';
      else playSeg(lastCap, r.off, r.dur, 0.06);
      if (box) box.innerHTML = m;
    }
    return;
  }
  if (std) { speak(W[+std.dataset.std].word, 0.7); return; }
  if (mine) { const w = W[+mine.dataset.mine]; playSeg(lastCap, w.offset, w.dur); return; }
  if (ab) { speak(cur.e, 1, playMine); return; }
  if (card) {
    const i = [...card.parentNode.children].indexOf(card);
    const w = W[i];
    if (!w) return;
    speak(w.word, 0.7, () => { if (w.et !== 'Omission') playSeg(lastCap, w.offset, w.dur); });
  }
}

// ---- entry ----
export function startApp(items) {
  ({ DATA, ORDERED, byId } = prepareItems(items));
  filtered = ORDERED;
  P.migrate(byId);

  $('rec').onclick = async () => {
    if (!cur) return alert('請先選擇一個項目');
    if (azRec) return azRec.stop();
    if (busy) { recog && recog.stop(); return; }
    if (useAzure()) return azureAssess();
    defaultRecognize();
  };
  $('listen').onclick = () => cur && say(cur.e);
  $('playMine').onclick = toggleMine;
  $('reRec').onclick = () => $('rec').click();
  $('weakList').onclick = e => { const s = e.target.closest('[data-w]'); if (s) speak(s.dataset.w, 0.7); };
  $('words').onclick = e => { const s = e.target.closest('[data-w]'); if (s) speak(s.dataset.w, 0.7); };
  $('clearWeak').onclick = () => { if (confirm('清除所有弱點紀錄？')) { P.clearWeak(); renderWeak(); } };
  $('clearConf').onclick = () => { if (confirm('清除常錯音紀錄？')) { P.clearConf(); renderConf(); } };
  $('forgetBtn').onclick = async () => {
    if (confirm('移除瀏覽器中保存的練習資料？（練習進度不會刪除）')) { await IDB.del('items'); location.reload(); }
  };
  document.addEventListener('click', onAzureClick);

  // Azure settings
  $('azKey').value = localStorage.azKey || '';
  $('azRegion').value = localStorage.azRegion || '';
  $('azOn').checked = localStorage.azOn === '1';
  $('azSave').onclick = () => {
    localStorage.azKey = $('azKey').value.trim();
    localStorage.azRegion = $('azRegion').value.trim();
    localStorage.azOn = $('azOn').checked ? '1' : '0';
    updBadge();
    alert('已儲存');
  };
  $('azOn').onchange = () => { localStorage.azOn = $('azOn').checked ? '1' : '0'; updBadge(); };
  updBadge();

  // voices
  speechSynthesis.onvoiceschanged = () => fillVoices($('voice'));
  fillVoices($('voice'));
  $('voice').onchange = e => { localStorage.voice = e.target.value; };
  renderWeak();
  renderConf();

  // list + filters
  $('vlist').addEventListener('scroll', () => requestAnimationFrame(drawRows));
  $('vinner').onclick = e => {
    const g = e.target.closest('[data-g]');
    if (g) {
      const L = g.dataset.g, ea = !!fQuery || fStatus !== 'all';
      if (ea) { openG.has('x' + L) ? openG.delete('x' + L) : openG.add('x' + L); }
      else { openG.has(L) ? openG.delete(L) : openG.add(L); }
      renderList();
      return;
    }
    const i = e.target.closest('[data-i]');
    if (i) show(byId.get(+i.dataset.i));
  };
  $('chips').onclick = e => { const c = e.target.closest('[data-st]'); if (!c) return; fStatus = c.dataset.st; applyFilter(); renderDash(); };
  $('stats').onclick = e => { const c = e.target.closest('[data-chip]'); if (!c) return; fStatus = c.dataset.chip; applyFilter(); renderDash(); document.body.classList.add('side-open'); };
  $('tchips').onclick = e => {
    const c = e.target.closest('[data-t]');
    if (!c) return;
    fType = c.dataset.t;
    document.querySelectorAll('#tchips .chip').forEach(x => x.classList.toggle('on', x === c));
    applyFilter();
  };
  let qT;
  $('q').oninput = () => { clearTimeout(qT); qT = setTimeout(() => { fQuery = $('q').value.trim().toLowerCase(); applyFilter(); }, 150); };
  $('jump').onclick = () => { const d = byId.get(+$('jid').value); d ? show(d) : alert('找不到此編號'); };
  $('jid').onkeydown = e => { if (e.key === 'Enter') $('jump').onclick(); };
  $('rand').onclick = () => { const a = filtered.length ? filtered : ORDERED; show(a[Math.floor(Math.random() * a.length)], '🎲 隨機'); };
  $('prev').onclick = () => step(-1);
  $('next').onclick = () => step(1);
  $('smart').onclick = next;
  $('menuBtn').onclick = () => document.body.classList.toggle('side-open');
  // tap outside the drawer closes it on small screens
  document.addEventListener('click', e => {
    if (innerWidth < 900 && document.body.classList.contains('side-open') && !e.target.closest('aside,#menuBtn,#stats')) document.body.classList.remove('side-open');
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); $('rec').click(); }
    else if (e.key === 'n' || e.key === 'N') { next(); }
    else if (e.key === 'r' || e.key === 'R') { $('listen').click(); }
  });

  // backup / restore
  $('exportBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(P.exportProgress(), null, 1)], { type: 'application/json' }));
    a.download = 'pronunciation_progress_' + dkey(Date.now()) + '.json';
    a.click();
  };
  $('importFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!confirm('匯入會覆蓋目前進度，確定？')) return;
      P.importProgress(o);
      renderDash(); applyFilter(); renderWeak(); renderConf();
      alert('已匯入');
    } catch (err) { alert('匯入失敗：' + err.message); }
  };

  applyFilter();
  renderDash();
  if (innerWidth >= 900) document.body.classList.add('side-open');
  const h = +location.hash.slice(1);
  if (byId.get(h)) show(byId.get(h));
  else { const r = P.smartPick(ORDERED); r ? show(r.d, r.why) : show(ORDERED[0]); }
}
