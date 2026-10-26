// IPA learning UI: tooltip cards on every symbol, the 音標教學 panel and the mini quiz.
import { $, esc, lsGet } from './util.js';
import { speak, stopSpeaking } from './tts.js';
import { getConf } from './progress.js';
import { GROUPS, phInfo, missRanking, sortByMiss, tokenizeIpa, buildQuiz, WORDS } from './ipa.js';
import { ipaNorm } from './phonemes.js';

let getRate = () => 0.7;

// ---- settings (both default on) ----
export const showIpaTable = () => localStorage.ipaTable !== '0';
export const showIpaExpl = () => localStorage.ipaExpl !== '0';

// ---- markup helpers ----
// A symbol with a hover/tap tooltip. `plain` = no tooltip (used inside quiz options, where the card would give the answer away).
export function chip(sym, { big = false, plain = false } = {}) {
  if (sym == null || sym === '' || sym === '—' || sym === '?') return '';
  return `<span class="ipa${big ? ' big' : ''}"${plain ? '' : ` data-ipa="${esc(sym)}" tabindex="0"`}>${esc(sym)}</span>`;
}
// A whole IPA string (e.g. the dataset's `p` field) with per-symbol tooltips.
export function ipaHtml(str) {
  return tokenizeIpa(str).map(t => t.sym ? chip(t.sym) : esc(t.txt)).join('');
}
// "音標：x → y" row shown in small grey after a plain-language explanation
export function ipaRow(exp, heard) {
  if (!showIpaExpl()) return '';
  const h = heard === '—' ? '<span class="ipa-none">（沒唸）</span>' : chip(heard);
  return `<div class="ipax">音標：${chip(exp)} → ${h}</div>`;
}

// ---- tooltip card ----
let pinned = false, hideT = null;
const card = () => $('ipaCard');
function cardHtml(sym) {
  const x = phInfo(sym);
  if (!x.known) return `<div class="ic-h"><span class="ic-sym">${esc(sym)}</span></div><small>這個符號還沒有說明</small>`;
  const words = x.words.map(w => `<span class="pw" data-say="${esc(w)}">${esc(w)}</span>`).join('　');
  const conf = x.confuse.length ? `<div class="ic-r">常跟 ${x.confuse.map(c => chip(c)).join(' ')} 搞混${x.confuseNote ? `：<small>${esc(x.confuseNote)}</small>` : ''}</div>` : '';
  return `<div class="ic-h"><span class="ic-sym">${esc(x.key)}</span><div><b>${esc(x.label)}</b>${x.voicing ? ` <span class="ic-badge">${esc(x.voicing)}</span>` : ''}<br><small>注音／中文：${esc(x.zh)}</small></div></div>
<div class="ic-r">示範字（點了會唸）：${words}</div><div class="ic-r">🛠 ${esc(x.tip)}</div>${conf}`;
}
function showCard(el, pin) {
  clearTimeout(hideT);
  const c = card();
  c.innerHTML = cardHtml(el.dataset.ipa);
  c.hidden = false;
  pinned = !!pin;
  const r = el.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight;
  const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
  let top = r.bottom + 6 + h > innerHeight ? r.top - h - 6 : r.bottom + 6;
  top = Math.max(8, Math.min(top, innerHeight - h - 8)); // always fully on screen
  c.style.left = left + 'px';
  c.style.top = top + 'px';
}
export function hideCard() { clearTimeout(hideT); pinned = false; const c = card(); if (c) c.hidden = true; }
const scheduleHide = () => { clearTimeout(hideT); hideT = setTimeout(() => { if (!pinned) hideCard(); }, 250); };

// ---- panel ----
const quizStats = () => lsGet('ipaQuiz', {});
function pcard(sym, miss) {
  const x = phInfo(sym), n = miss[x.key] || 0;
  return `<div class="pcard${n ? ' missed' : ''}" data-play="${esc(x.key)}" title="點卡片：依序聽三個示範字">
<div class="ph-top">${chip(x.key, { big: true })} <small>${esc(x.zh)}</small>${x.voicing ? `<span class="ic-badge">${x.voicing.slice(0, 2)}</span>` : ''}${n ? `<span class="miss-badge">🔺 常錯 ×${n}</span>` : ''}</div>
<div class="pw-row">${x.words.map(w => `<span class="pw" data-say="${esc(w)}">${esc(w)}</span>`).join('　')}</div>
<small class="ptip">🛠 ${esc(x.tip)}</small></div>`;
}
export function renderPanel() {
  const miss = missRanking(getConf(), quizStats());
  const top = Object.entries(miss).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
  let h = `<div class="ip-top"><b>⚠️ 你常錯的音</b> ${top.length ? top.map(([k, n]) => `${chip(k)}<small>×${n}</small>`).join('　') : '<small>尚無紀錄（用 Azure 評分或做小測驗後會出現）；之後會排在每一組的最前面</small>'}</div>`;
  for (const g of GROUPS) {
    h += `<h4>${g.title}</h4>`;
    for (const s of g.subs) {
      const syms = s.pairs ? s.syms : sortByMiss(s.syms, miss);
      // voiced/voiceless pairs stay side by side; whole pairs with misses move to the front
      let list = syms;
      if (s.pairs) {
        const pairs = []; for (let i = 0; i < s.syms.length; i += 2) pairs.push(s.syms.slice(i, i + 2));
        pairs.sort((a, b) => ((miss[b[0]] || 0) + (miss[b[1]] || 0)) - ((miss[a[0]] || 0) + (miss[a[1]] || 0)));
        list = pairs.flat();
      }
      h += `<div class="ip-sub">${s.title}</div><div class="pgrid">${list.map(sym => pcard(sym, miss)).join('')}</div>`;
    }
  }
  $('ipaGrid').innerHTML = h;
}
function speakSeq(words) {
  stopSpeaking();
  const go = i => { if (i < words.length) speak(words[i], getRate(), () => go(i + 1)); };
  go(0);
}

// ---- quiz ----
let quiz = null;
function saveQuiz(sym, ok) {
  const st = quizStats(), k = ipaNorm(sym);
  st[k] = st[k] || { ok: 0, bad: 0 };
  st[k][ok ? 'ok' : 'bad']++;
  localStorage.ipaQuiz = JSON.stringify(st);
}
function askQuestion() {
  const q = quiz.qs[quiz.i], box = $('quizBox');
  const head = `<div class="qh">第 ${quiz.i + 1} / ${quiz.qs.length} 題　<small>目前答對 ${quiz.score}</small></div>`;
  if (q.type === 'words') {
    box.innerHTML = head + `<div class="qq">🎧 聽三個字，它們<b>共同的音</b>是哪個符號？ <button class="sm" id="qHear">🔊 再聽一次</button></div>
<div class="qopts">${q.options.map(o => `<button class="qo" data-qa="${esc(o)}">${chip(o, { big: true, plain: true })}</button>`).join('')}</div><div id="qFb"></div>`;
    speakSeq(q.words);
  } else {
    box.innerHTML = head + `<div class="qq">符號 ${chip(q.sym, { big: true, plain: true })}（例如 <b>${esc(q.word)}</b> <button class="sm" id="qHear">🔊</button>）的聲音，哪個描述最接近？</div>
<div class="qopts">${q.options.map(o => `<button class="qo" data-qa="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="qFb"></div>`;
  }
  $('qHear').onclick = () => (q.type === 'words' ? speakSeq(q.words) : speak(q.word, getRate()));
}
function answer(btn) {
  const q = quiz.qs[quiz.i];
  if (quiz.done) return;
  quiz.done = true;
  const ok = btn.dataset.qa === q.answer;
  if (ok) quiz.score++;
  saveQuiz(q.sym, ok);
  document.querySelectorAll('#quizBox .qo').forEach(b => { b.disabled = true; if (b.dataset.qa === q.answer) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
  const info = phInfo(q.sym);
  $('qFb').innerHTML = `<div class="${ok ? 'qok' : 'qbad'}">${ok ? '✅ 答對了！' : '❌ 答案是'} ${chip(q.sym, { big: true })} <small>${esc(info.zh)}；${info.words.map(esc).join('、')}</small></div>
<button class="primary" id="qNext">${quiz.i + 1 < quiz.qs.length ? '下一題 ▶' : '看結果'}</button>`;
  $('qNext').onclick = () => { quiz.i++; quiz.done = false; quiz.i < quiz.qs.length ? askQuestion() : finishQuiz(); };
}
function finishQuiz() {
  const { score, qs } = quiz;
  $('quizBox').innerHTML = `<div class="qh"><b>測驗完成：${score} / ${qs.length}</b></div><small>答錯的音會被標成「常錯」，之後在下面排在最前面。</small><br><button class="primary" id="qAgain">再測一次</button> <button class="sec" id="qClose">關閉</button>`;
  $('qAgain').onclick = startQuiz;
  $('qClose').onclick = () => { $('quizBox').hidden = true; };
  renderPanel();
}
export function startQuiz() {
  quiz = { qs: buildQuiz(10, Math.random, missRanking(getConf(), quizStats())), i: 0, score: 0, done: false };
  $('quizBox').hidden = false;
  askQuestion();
}

// ---- wiring ----
// Returns true when the click was about the IPA UI (symbol chips, panel cards, outside-click to close the card).
export function handleIpaClick(e) {
  const t = e.target;
  if (!t.closest) return false;
  if (!t.closest('#ipaCard') && !t.closest('[data-ipa]')) hideCard();
  const chipEl = t.closest('[data-ipa]');
  if (chipEl) { showCard(chipEl, true); return true; }
  if (t.closest('#quizBox')) {
    const qa = t.closest('[data-qa]');
    if (qa) answer(qa);
    return !!qa;
  }
  const play = t.closest('[data-play]');
  if (play && !t.closest('[data-say]')) { speakSeq(WORDS[play.dataset.play] || []); return true; }
  return false;
}

export function initIpa({ stdRate }) {
  getRate = stdRate;
  $('ipaTable').checked = showIpaTable();
  $('ipaExpl').checked = showIpaExpl();
  $('ipaTable').onchange = e => { localStorage.ipaTable = e.target.checked ? '1' : '0'; };
  $('ipaExpl').onchange = e => { localStorage.ipaExpl = e.target.checked ? '1' : '0'; };
  $('quizBtn').onclick = startQuiz;
  $('ipaPanel').addEventListener('toggle', () => { if ($('ipaPanel').open) renderPanel(); });
  const hoverOk = matchMedia('(hover: hover)').matches;
  if (hoverOk) {
    document.addEventListener('mouseover', e => { const c = e.target.closest && e.target.closest('[data-ipa]'); if (c && !pinned) showCard(c, false); });
    document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-ipa]')) scheduleHide(); });
    card().addEventListener('mouseenter', () => clearTimeout(hideT));
    card().addEventListener('mouseleave', scheduleHide);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideCard();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-ipa]')) { e.preventDefault(); e.stopPropagation(); showCard(e.target, true); }
  }, true);
}
