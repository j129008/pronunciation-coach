// Practice screen: the item card, recording (Web Speech or Azure), result sections, playback / A/B / IPA helpers.
// The shell (router, sessions, lists) lives in ui.js and talks to this module through `env`.
import { $, esc } from './util.js';
import * as P from './progress.js';
import { scoreHyp, tipsFor } from './align.js';
import { ipaInfo, analyzeWord, ERR_ZH } from './phonemes.js';
import { speak, stopSpeaking } from './tts.js';
import { playSeg, stopSeg, activeIndex } from './playback.js';
import { encodeWav, captureMic, assess } from './azure.js';
import { explain, respell, plainSound, heardAs } from './explain.js';
import { chip, ipaHtml, ipaRow, showIpaTable, handleIpaClick } from './ipaui.js';
import { userLabel } from './lessons.js';

const TL = { sentence: '句子', vocab: '單字', extra: '補充' };
export const ST = { new: ['未練', '#868e96'], weak: ['要加強', '#e03131'], fair: ['還不錯', '#f08c00'], good: ['已熟練', '#2f9e44'], due: ['待複習', '#7048e8'] };

// env: {onAttempt(item, result), nextLabel(), lessonTitle(item), openIpa()}
let env = { onAttempt() {}, nextLabel: () => '下一題', lessonTitle: d => d.l || '', openIpa() {} };
let cur = null;
let recog = null, mr = null, chunks = [], stream = null, busy = false, azRec = null;
let lastCap = null, azWords = [], suppressRec = false;

export const getCur = () => cur;
const statusOf = (id, now) => P.statusOf(id, now);
const say = (text, rate) => speak(text, rate || ($('slow').checked ? 0.7 : 1));

// ---- show an item ----
export function showItem(d, reason = '') {
  if (!d) return;
  cur = d;
  const p = P.getProg()[d.i], s = statusOf(d.i);
  $('meta').innerHTML = `<span class="tag" style="background:${ST[s][1]}">${ST[s][0]}</span><span>${esc(d.u ? userLabel(d) + ' ' + d.l : env.lessonTitle(d))}</span><span class="muted">${TL[d.t]}</span>${p && p.a ? `<span class="muted">最佳 ${p.b}・上次 ${p.l}・練 ${p.a} 次</span>` : ''}${reason ? `<span class="why">${esc(reason)}</span>` : ''}`;
  $('tgt').textContent = d.e;
  $('ipa').innerHTML = d.p ? '/' + ipaHtml(d.p) + '/' : '';
  $('zh').innerHTML = esc(d.z) + (d.x ? `<br><small>例句：${esc(d.x)}</small>` : '') + (d.o ? `<br><small>原本說法：${esc(d.o)}</small>` : '');
  $('result').hidden = true;
  $('summary').innerHTML = '';
  $('interim').textContent = '';
  cancelAll();
  clearMine();
  lastCap = null;
  azWords = [];
  $('status').innerHTML = '';
  $('rec').textContent = '開始錄音';
  $('rec').classList.remove('on');
}
// leaving the practice screen: stop recording, playback and speech
export function stopAll() {
  cancelAll();
  if (azRec) { const c = azRec; azRec = null; c.stop(); }
  if (recog) { try { recog.abort(); } catch (e) { /* not running */ } }
  stopAudio();
  busy = false;
}

function showSummary(score, prevBest, p) {
  const s = $('summary');
  const st = statusOf(cur.i);
  const diff = prevBest == null ? '第一次練習' : score > prevBest ? `新紀錄！(+${score - prevBest})` : score === prevBest ? '平最佳紀錄' : `最佳 ${prevBest}（差 ${prevBest - score}）`;
  s.innerHTML = `<div class="sumrow"><div class="big" style="color:${ST[st][1]}">${score}</div><div class="sumtxt"><div><span class="tag" style="background:${ST[st][1]}">${ST[st][0]}</span> 這次 <b>${score}</b>・${diff}</div><small>最近：${p.h.join(' → ')}（共 ${p.a} 次）</small></div></div>
 <div class="sumbtns"><button id="again" class="btn">再唸一次</button><button id="next2" class="btn primary">${esc(env.nextLabel())}</button></div>`;
  $('again').onclick = () => $('rec').click();
  $('next2').onclick = () => $('next').click();
}
function recordAttempt(score) {
  if (!cur) return;
  const r = P.recordAttempt(cur.i, score);
  showSummary(r.score, r.prevBest, r.p);
  env.onAttempt(cur, r);
}

// ---- results ----
function setSections(open) { for (const id of ['secScore', 'secIssues', 'secCards', 'secIpa']) $(id).open = open.includes(id); }
function showResult(best, alts) {
  for (const id of ['azIssues', 'azCards', 'azScores', 'resIpa']) $(id).innerHTML = '';
  $('abTools').hidden = false;
  const { a, score } = best;
  $('result').hidden = false;
  $('secCards').hidden = true;
  $('secIpa').hidden = true;
  setSections(['secScore', 'secIssues']);
  $('score').textContent = score + '%';
  $('score').style.color = score >= 85 ? '#2f9e44' : score >= 60 ? '#f08c00' : '#e03131';
  $('words').innerHTML = (best.disp || a).map(x => x.s === 'extra' ? `<span class="w extra">+${esc(x.h)}</span>` : `<span class="w ${x.s}" data-w="${esc(x.d || x.t)}">${esc(x.d || x.t)}${x.s === 'bad' ? `<span class="heard">${esc(x.h)}</span>` : ''}</span>`).join('');
  $('heardAll').innerHTML = '<small>辨識結果（最佳）：' + alts.map((h, i) => i ? esc(h) : '<b>' + esc(h) + '</b>').join(' ｜ ') + '</small>';
  const t = tipsFor(a);
  $('tips').innerHTML = t.length ? '<ul class="tiplist">' + t.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : (score === 100 ? '<p>完美，沒有需要改的地方。</p>' : '<p class="muted">沒有特別的建議。</p>');
  $('secIssues').hidden = false;
  P.recordWeakWords(a);
  P.setWeakItem(cur.i, score);
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
  a.hidden = false;
  $('playMine').hidden = false;
  $('reRec').hidden = false;
}
function clearMine() {
  const a = $('myAudio');
  a.pause();
  a.removeAttribute('src');
  a.load();
  a.hidden = true;
  if (myUrl) URL.revokeObjectURL(myUrl);
  myUrl = null;
  stopSeg();
  $('playMine').hidden = true;
  $('reRec').hidden = true;
}
// ---- playback speed + A/B compare ----
const segRate = () => +$('segRate').value || 0.6;
const stdRate = () => +$('stdRate').value || 0.7;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const speakP = (text, rate) => new Promise(res => speak(text, rate, res));
let abTok = 0;
function cancelAll() {
  abTok++;
  stopSpeaking();
  stopSeg();
  $('abStop').hidden = true;
}
// standard (TTS of `text`) → short pause → your own slice, optionally looped
async function runAB(text, off, dur) {
  if (!lastCap || off == null || dur == null) { status('沒有錄音或時間資料可播'); return; }
  $('myAudio').pause();
  cancelAll();
  const tok = abTok;
  $('abStop').hidden = false;
  do {
    await speakP(text, stdRate());
    if (tok !== abTok) return;
    await sleep(250);
    if (tok !== abTok) return;
    await playSeg(lastCap, off, dur, { rate: segRate() });
    if (tok !== abTok) return;
    if (!$('abLoop').checked) break;
    await sleep(700);
    if (tok !== abTok) return;
  } while ($('abLoop').checked);
  if (tok === abTok) $('abStop').hidden = true;
}
const abWord = wi => { const w = azWords[wi]; if (w && w.et !== 'Omission') runAB(w.word, w.offset, w.dur); };
const abPhoneme = (wi, k) => { const w = azWords[wi], r = w && w.rows[k]; if (r && w.et !== 'Omission') runAB(w.word, r.off, r.dur); };

const explainHtml = (x, exp, heard) => !x ? '' : `<div class="vd"><b class="tl ${x.type}">${esc(x.typeLabel)}</b> ${esc(x.verdict)}</div>${ipaRow(exp, heard)}<div class="xp"><b>練習：</b>${esc(x.fix)}</div>` +
  (x.pairs.length ? '<div class="xp">對比字（點了會唸）：' + x.pairs.map(([a, b]) => `<span class="pw" data-say="${esc(a)}">${esc(a)}</span> / <span class="pw" data-say="${esc(b)}">${esc(b)}</span>`).join('　') + '</div>' : '');
const spellHtml = (w, wi) => {
  const ha = heardAs(w.word, w.rows);
  if (!ha) return w.rows.some(r => r.bad) && w.et === 'Omission' ? '<div class="rsp">這個字沒有被唸出來</div>' : '';
  return `<div class="rsp">${esc(ha.text)} <button class="btn sm" data-like="${wi}" title="先唸電腦聽到的版本，再唸正確的字">聽起來像 → 正確</button><br><small>拼法對照：<b class="rs bad">${esc(ha.saidCaps)}</b> vs <b class="rs">${esc(ha.target)}</b>（大寫＝出問題的音節）</small></div>`;
};
// highlight the sound being played (one phoneme if `only` is given, otherwise any mispronounced one)
let hlKey = null;
function setHl(wi, k) {
  const key = k >= 0 ? wi + ',' + k : null;
  if (key === hlKey) return;
  hlKey = key;
  document.querySelectorAll('.phc.playing').forEach(x => x.classList.remove('playing'));
  if (key) document.querySelectorAll(`[data-pe="${key}"],[data-ph="${key}"]`).forEach(x => x.classList.add('playing'));
}
const tickFor = (wi, w, only = null) => t => setHl(wi, activeIndex(w.rows, t, only));
function likeAudio(wi) {
  const w = azWords[wi], ha = w && heardAs(w.word, w.rows);
  if (!ha) return;
  $('myAudio').pause();
  cancelAll();
  const rate = stdRate();
  speak(ha.said, rate, () => speak(w.word, rate));
}
function playOwnSegment(wi, k) {
  const w = azWords[wi], r = w && w.rows[k];
  if (!r || !lastCap || w.et === 'Omission') return;
  cancelAll();
  playSeg(lastCap, r.off, r.dur, { pad: 0.25, rate: 0.5, onTick: tickFor(wi, w, k) });
}
const segButtons = (wi, k, w) => (lastCap && w.et !== 'Omission')
  ? `<div class="xp"><button class="btn sm" data-seg="${wi},${k}">只聽這段（放慢）</button> ${heardAs(w.word, w.rows) ? `<button class="btn sm" data-like="${wi}">聽起來像 → 正確</button>` : ''}</div>` : '';
// table cell: IPA symbol chip (tooltip) + letters respelling; chip is optional (setting 表格顯示音標)
const cellHtml = ph => (ph === '—' ? '—' : showIpaTable() ? `${chip(ph, { big: true })}<br><small>${esc(respell([ph]))}</small>` : esc(respell([ph])));

function playMine() {
  const a = $('myAudio');
  if (!myUrl) return;
  cancelAll();
  a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = true;
  a.playbackRate = segRate();
  a.currentTime = 0;
  a.play().catch(() => {});
}
function toggleMine() {
  const a = $('myAudio');
  if (!a.paused) { a.pause(); a.currentTime = 0; } else playMine();
}
function syncRecButtons() { $('playMine').disabled = $('reRec').disabled = busy; }
// silence everything that could bleed into the mic before a new take
function prepareToRecord() { cancelAll(); $('myAudio').pause(); }
const useAzure = () => localStorage.azOn === '1' && !!localStorage.azKey && !!localStorage.azRegion;
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
  $('rec').textContent = '停止';
  $('rec').classList.add('on');
  status('請開始唸…');
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
    $('rec').textContent = '開始錄音';
    $('rec').classList.remove('on');
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
    status('完成。可以按下方播放器聽自己的聲音，再按「聽示範」對照。');
    showResult(res[bi], [combos[bi], ...combos.filter((c, i) => i !== bi).slice(0, 4)]);
  };
  recog.start();
}

// ---- recording (Azure) ----
function azReset() { busy = false; syncRecButtons(); $('rec').textContent = '開始錄音'; $('rec').classList.remove('on'); }
async function azureAssess() {
  if (azRec) { azRec.stop(); return; }
  const item = cur;
  prepareToRecord();
  let cap;
  try { cap = await captureMic({ maxMs: 30000 }); } catch (e) { status('無法使用麥克風：' + esc(e.message)); return; }
  azRec = cap;
  busy = true;
  syncRecButtons();
  $('rec').textContent = '停止並評分';
  $('rec').classList.add('on');
  status('Azure 模式：請唸出整句，唸完按「停止並評分」（最長 30 秒）');
  const { data, rate, peak } = await cap.done;
  azRec = null;
  azReset();
  if (cur !== item) return; // user moved on: don't score the wrong item
  lastCap = { data, rate };
  const wav = encodeWav(data, rate);
  setMyAudio(wav);
  if (peak < 0.01) {
    status(`注意：麥克風幾乎沒有聲音（峰值 ${peak.toFixed(4)}）。請到 Chrome 網址列左側的鎖頭圖示或 chrome://settings/content/microphone 確認選到正確的麥克風，並檢查 macOS 系統設定 → 隱私權 → 麥克風。`);
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
  for (const [wi, w] of words.entries()) {
    if (w.et === 'Insertion') continue;
    for (const [ki, r] of w.rows.entries()) if (r.bad || w.et === 'Omission') {
      const k = r.exp + '→' + r.heard;
      issues.push({ w: w.word, k, r, score: r.score, wi, ki });
      conf[k] = conf[k] || { n: 0, w: [] };
      conf[k].n++;
      if (!conf[k].w.includes(w.word)) conf[k].w.push(w.word);
      conf[k].w = conf[k].w.slice(-8);
    }
  }
  P.saveConf(conf);
  // dedupe by confusion, worst first
  const seen = new Set(), top = [];
  for (const x of issues.sort((a, b) => a.score - b.score)) {
    if (seen.has(x.k)) continue;
    seen.add(x.k);
    top.push(x);
    if (top.length >= 5) break;
  }
  $('azScores').innerHTML = `<div class="azs"><b>Azure 評估</b>　總分 <b>${f(p.PronScore)}</b>・準確度 ${f(p.AccuracyScore)}・流暢度 ${f(p.FluencyScore)}・完整度 ${f(p.CompletenessScore)}・韻律 ${f(p.ProsodyScore)}</div>
 <button id="abAll" class="btn sm">整句 A/B（標準 → 我的）</button>`;
  const spShown = new Set();
  let h = '';
  if (top.length) h += '<div class="issues"><ol>' + top.map(x => {
    const sp = spShown.has(x.wi) ? '' : spellHtml(words[x.wi], x.wi);
    spShown.add(x.wi);
    return `<li><b>${esc(x.w)}</b>${sp}${explainHtml(explain(x.r.exp, x.r.heard, { isFinal: x.r.isFinal, word: x.w, letters: x.r.let }), x.r.exp, x.r.heard)}
 ${lastCap && words[x.wi].et !== 'Omission' ? `<button class="btn sm" data-abp="${x.wi},${x.ki}">A/B：標準 → 我的</button><button class="btn sm" data-seg="${x.wi},${x.ki}">只聽這段（放慢）</button>` : ''}</li>`;
  }).join('') + '</ol></div>';
  else h += '<div class="issues ok">沒有明顯的錯誤音素。</div>';
  $('azIssues').innerHTML = h;
  h = '<div class="wcards">' + words.map((w, i) => {
    const cls = w.et === 'Omission' ? 'miss' : (w.et === 'None' && w.score >= 80 ? 'ok' : 'bad');
    const canPlay = w.et !== 'Omission' && lastCap;
    return `<div class="wcard ${cls}"><div><b style="font-size:18px">${esc(w.word)}</b> <small>${f(w.score)}分 ${ERR_ZH[w.et] ? '・' + ERR_ZH[w.et] : ''}</small>
  <button class="btn sm" data-std="${i}">標準</button>${canPlay ? `<button class="btn sm" data-mine="${i}">我的</button><button class="btn sm" data-abw="${i}">A/B</button>` : ''}</div>
  ${spellHtml(w, i)}
  <table class="cmp"><tr><th>字母</th>${w.rows.map(r => `<td class="lt">${esc(r.let || '')}</td>`).join('')}</tr>
  <tr><th>標準<br><small>（點我聽）</small></th>${w.rows.map((r, k) => `<td class="phc ${r.bad ? 'pe' : ''}" data-pe="${i},${k}" title="${esc(plainSound(r.exp))}">${cellHtml(r.exp)}</td>`).join('')}</tr>
  <tr><th>你的<br><small>（點我聽）</small></th>${w.rows.map((r, k) => `<td class="phc ${r.bad ? 'ph-bad' : 'ph-ok'}" data-ph="${i},${k}" title="${esc(r.bad && r.heard !== '—' ? '你唸成 ' + plainSound(r.heard) : '點我聽你自己這個音')}">${cellHtml(r.bad ? r.heard : r.exp)}</td>`).join('')}</tr>
  <tr><th>分數</th>${w.rows.map(r => `<td><small>${f(r.score)}</small></td>`).join('')}</tr>
  ${canPlay ? `<tr><th>A/B</th>${w.rows.map((r, k) => `<td><button class="btn sm" data-abp="${i},${k}" title="標準單字 → 你的這個音">A/B</button></td>`).join('')}</tr>` : ''}</table><div class="phint" id="phint${i}"></div></div>`;
  }).join('') + '</div>';
  $('azCards').innerHTML = h + '<p class="muted">點「標準」格：聽這個音的示範字；點「你的」格：播放你唸的整個字，並標出唸錯的音。點單字卡其他地方：先播標準發音再播你自己的那段錄音。A/B：先聽標準單字，停一下，再聽你的那一段（可勾選循環）。紅色＝不準的音素；「你的」格是 Azure 判斷最像的音。</p>';
  $('abTools').hidden = false;
  $('secCards').hidden = false;
  $('secIpa').hidden = !top.length;
  $('resIpa').innerHTML = top.length ? '<p class="muted">這次出現的音標（滑過或點一下看發音卡）：</p><ul class="ipalist">' + top.map(x => `<li><b>${esc(x.w)}</b>：${chip(x.r.exp)} → ${x.r.heard === '—' ? '<span class="ipa-none">（沒唸）</span>' : chip(x.r.heard)}</li>`).join('') + '</ul><button class="btn sm" data-goipa="1">開啟完整音標教學</button>' : '';
  $('secIssues').hidden = false;
  status('Azure 評估完成');
  recordAttempt(p.PronScore != null ? p.PronScore : base.score);
}

function onAzureClick(e) {
  const t = e.target;
  if (!t.closest) return;
  if (handleIpaClick(e)) return;
  if (t.closest('[data-goipa]')) { env.openIpa(); return; }
  const std = t.closest('[data-std]'), mine = t.closest('[data-mine]'), card = t.closest('.wcard'), ab = t.closest('#abAll');
  const W = azWords;
  const seg = t.closest('[data-seg]'), like = t.closest('[data-like]');
  if (seg) { const [wi, k] = seg.dataset.seg.split(',').map(Number); playOwnSegment(wi, k); return; }
  if (like) { likeAudio(+like.dataset.like); return; }
  const abp = t.closest('[data-abp]'), abw = t.closest('[data-abw]'), say = t.closest('[data-say]');
  if (abp) { const [wi, k] = abp.dataset.abp.split(',').map(Number); abPhoneme(wi, k); return; }
  if (abw) { abWord(+abw.dataset.abw); return; }
  if (say) { speak(say.dataset.say, stdRate()); return; }
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
      if (box) box.innerHTML = `<b>${esc(r.let || '')}</b> → ${esc(plainSound(r.exp))}` + (x ? `　<small>示範字：<b>${esc(x.w)}</b>，接著唸 ${esc(w.word)}</small>` : '');
      if (x) speak(x.w, stdRate(), () => speak(w.word, stdRate())); else speak(w.word, stdRate());
    } else {
      const ex = r.bad ? explain(r.exp, r.heard, { isFinal: r.isFinal, word: w.word, letters: r.let }) : null;
      let m = ex ? '<b>你的這個音</b>' : `<b>這個音唸得不錯</b>：${esc(plainSound(r.exp))}`;
      m += explainHtml(ex, r.exp, r.heard);
      if (!lastCap || r.off == null || w.et === 'Omission') m += '<br><small>（沒有錄音或時間資料可播）</small>';
      else {
        // whole word (slowed, padded) so there is enough audio to hear; the wrong sound lights up while it plays
        cancelAll();
        const whole = Number.isFinite(w.offset) && Number.isFinite(w.dur);
        playSeg(lastCap, whole ? w.offset : r.off, whole ? w.dur : r.dur, { rate: segRate(), onTick: tickFor(wi, w, k) });
        m += segButtons(wi, k, w);
      }
      if (box) box.innerHTML = m;
    }
    return;
  }
  if (std) { speak(W[+std.dataset.std].word, stdRate()); return; }
  if (mine) { const wi = +mine.dataset.mine, w = W[wi]; cancelAll(); playSeg(lastCap, w.offset, w.dur, { rate: segRate(), onTick: tickFor(wi, w) }); return; }
  if (ab) { speak(cur.e, stdRate(), playMine); return; }
  if (card) {
    const i = [...card.parentNode.children].indexOf(card);
    const w = W[i];
    if (!w) return;
    speak(w.word, stdRate(), () => { if (w.et !== 'Omission') playSeg(lastCap, w.offset, w.dur, { rate: segRate(), onTick: tickFor(i, w) }); });
  }
}


// ---- setup (called once by the shell) ----
export function initPractice(e) {
  env = { ...env, ...e };
  $('rec').onclick = async () => {
    if (!cur) return;
    if (azRec) return azRec.stop();
    if (busy) { recog && recog.stop(); return; }
    if (useAzure()) return azureAssess();
    defaultRecognize();
  };
  $('listen').onclick = () => cur && say(cur.e);
  $('slow').checked = localStorage.slow === '1';
  $('slow').onchange = ev => { localStorage.slow = ev.target.checked ? '1' : '0'; };
  $('segRate').value = localStorage.segRate || '0.6';
  $('stdRate').value = localStorage.stdRate || '0.7';
  $('abLoop').checked = localStorage.abLoop === '1';
  $('segRate').onchange = ev => { localStorage.segRate = ev.target.value; };
  $('stdRate').onchange = ev => { localStorage.stdRate = ev.target.value; };
  $('abLoop').onchange = ev => { localStorage.abLoop = ev.target.checked ? '1' : '0'; };
  $('abStop').onclick = cancelAll;
  $('playMine').onclick = toggleMine;
  $('reRec').onclick = () => $('rec').click();
  $('words').onclick = ev => { const s = ev.target.closest('[data-w]'); if (s) speak(s.dataset.w, 0.7); };
  document.addEventListener('click', onAzureClick);
}
export { stdRate, useAzure, updBadge };
