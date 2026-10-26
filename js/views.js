// Screens: 今天 / 課程 (library + lesson) / 統計 / 設定 / 完成. Pure rendering; actions go through App.act.
import { $, esc, dkey } from './util.js';
import * as P from './progress.js';
import { App, status, lessonOf, lessonTitle, sessionSize } from './state.js';
import { fmtDate, lessonStats, searchItems, makeFilter, filterActive, preClassLessons } from './library.js';
import { buildSession, summarize } from './session.js';
import { chip } from './ipaui.js';
import { missRanking, phInfo } from './ipa.js';
import { explain, respell } from './explain.js';
import { ST } from './practice.js';
import { lsGet } from './util.js';

const TL = { sentence: '句子', vocab: '單字', extra: '補充' };
const KL = { pre: '課前', post: '課後', class: '課堂' };
const stat = (v, label) => `<div class="stat"><b>${v}</b><span>${label}</span></div>`;
const bar = pct => `<div class="meter"><i style="width:${pct}%"></i></div>`;

// ---- shared bits ----
export function lessonCard(l) {
  const st = lessonStats(l, status, P.getProg());
  const badges = [l.kinds.pre ? `<span class="badge pre">課前 ${l.kinds.pre}</span>` : '', l.kinds.post ? `<span class="badge post">課後 ${l.kinds.post}</span>` : '', l.user ? '<span class="badge usr">我加入的</span>' : ''].join('');
  const counts = [l.counts.sentence ? `句子 ${l.counts.sentence}` : '', l.counts.vocab ? `單字 ${l.counts.vocab}` : '', l.counts.extra ? `補充 ${l.counts.extra}` : ''].filter(Boolean).join('・');
  return `<a class="lcard" href="#/lesson/${encodeURIComponent(l.key)}">
<div class="lc-top"><b class="lc-id">${esc(l.title)}</b><span class="muted">${l.date ? fmtDate(l.date) : ''}</span></div>
<div class="lc-topic">${l.topic ? esc(l.topic) : '<span class="muted">&nbsp;</span>'}</div>
<div class="lc-badges">${badges}</div>
<div class="lc-meta muted">${counts}</div>${bar(st.pct)}
<div class="lc-meta"><span>已熟練 <b>${st.pct}%</b></span><span class="muted">練過 ${st.practiced}/${st.total}${st.due ? `・待複習 ${st.due}` : ''}</span></div></a>`;
}
export function itemRow(d, extra = '') {
  const s = status(d.i), p = P.getProg()[d.i];
  return `<button class="irow" data-act="open" data-id="${d.i}"><i class="dot" style="background:${ST[s][1]}" title="${ST[s][0]}"></i>
<span class="irow-t"><b class="e">${esc(d.e)}</b>${d.z ? `<small class="z">${esc(d.z)}</small>` : ''}${extra}</span>
<span class="irow-s">${p && p.a ? `<b>${p.b}</b>` : `<small>${ST[s][0]}</small>`}${s === 'due' ? '<em class="badge due">待複習</em>' : ''}</span></button>`;
}

// ---- 今天 ----
export function computePlan() {
  return buildSession(App.items, { catalog: App.catalog, prog: P.getProg(), statusFn: status, weak: P.getWeak(), now: Date.now(), size: sessionSize() });
}
export function renderToday() {
  $('todayDate').textContent = new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
  const s = App.session;
  if (!App.items.length) { $('hero').innerHTML = '<p>還沒有練習資料。</p><a class="btn primary big" href="#/settings">前往設定</a>'; return; }
  if (s && s.idx < s.ids.length) {
    $('hero').innerHTML = `<div class="hero-k">進行中</div><h2 class="hero-t">繼續今天的練習</h2>
<div class="meter big"><i style="width:${Math.round(100 * s.idx / s.ids.length)}%"></i></div>
<p class="muted">進度 ${s.idx} / ${s.ids.length} 題${s.lesson ? `・本次課程：${esc(s.lesson.title)} ${esc(s.lesson.topic || '')}` : ''}</p>
<div class="btnrow"><button class="btn primary big" data-act="resume">繼續</button><button class="btn" data-act="restart">重新開始</button></div>`;
  } else {
    const plan = computePlan();
    App.plan = plan;
    const n = plan.ids.length, pt = plan.parts;
    $('hero').innerHTML = n
      ? `<div class="hero-k">今天的練習</div><h2 class="hero-t">建議練 ${n} 題，約 ${Math.max(3, Math.round(n * 0.7))} 分鐘</h2>
<ul class="plan">${pt.review ? `<li><b>${pt.review}</b> 題複習<span class="muted">（待複習與要加強的）</span></li>` : ''}${pt.lesson ? `<li><b>${pt.lesson}</b> 題${plan.lesson ? ` ${esc(plan.lesson.title)} ${esc(plan.lesson.topic || '')}` : '新題'}</li>` : ''}${pt.sound ? `<li><b>${pt.sound}</b> 題含有你的弱點字</li>` : ''}</ul>
<div class="btnrow"><button class="btn primary big" data-act="start">開始練習</button></div>`
      : '<div class="hero-k">今天的練習</div><h2 class="hero-t">目前沒有需要練的題目</h2><p class="muted">可以到「課程」挑一課來練，或加入新的文章。</p><a class="btn primary big" href="#/library">看課程</a>';
  }
  const prog = P.getProg(), all = App.items.length;
  const mastered = App.items.filter(d => ['good', 'due'].includes(status(d.i))).length;
  $('todayStats').innerHTML = stat(P.todayCount(), '今天練了') + stat(P.streak(), '連續天數') + stat(all ? Math.round(100 * mastered / all) + '%' : '-', '已熟練');
  $('todayLessons').innerHTML = App.catalog.lessons.slice(0, 3).map(lessonCard).join('') || '<p class="muted">還沒有課程。</p>';
}

// ---- 課程 ----
const PRIMARY = [['all', '全部'], ['new', '沒練過'], ['weak', '要加強'], ['due', '待複習']];
const MORE = [['status', 'fair', '還不錯'], ['status', 'good', '已熟練'], ['type', 'sentence', '句子'], ['type', 'vocab', '單字'], ['type', 'extra', '補充'], ['kind', 'pre', '課前練習'], ['kind', 'post', '課後複習'], ['kind', 'class', '課堂']];
const chipBtn = (grp, val, label, on) => `<button class="chip${on ? ' on' : ''}" data-f="${grp}:${val}">${label}</button>`;
export function chipsHtml() {
  const f = App.filters;
  return {
    primary: PRIMARY.map(([v, l]) => chipBtn('status', v, l, f.status === v)).join('') + `<button class="chip link" data-act="more-f">${App.moreOpen ? '收起篩選' : '更多篩選'}</button>`,
    more: MORE.map(([g, v, l]) => chipBtn(g, v, l, f[g] === v)).join(''),
  };
}
export function setFilter(grp, val) {
  const f = App.filters;
  f[grp] = (grp !== 'status' && f[grp] === val) ? '' : val;
  if (grp === 'status' && val === 'all') f.status = 'all';
  App.libLimit = 36; App.rowLimit = 100;
}
const pred = () => makeFilter(App.filters, status);

export function renderLibrary() {
  const c = chipsHtml();
  $('fchips').innerHTML = c.primary;
  $('moreF').innerHTML = c.more;
  $('moreF').hidden = !App.moreOpen;
  const q = App.query.trim(), body = $('libBody');
  if (q) {
    const res = searchItems(App.items, q, { limit: 200, pred: filterActive(App.filters) ? pred() : null });
    App.listIds = res.map(d => d.i);
    App.listReturn = '#/library';
    const shown = res.slice(0, App.rowLimit);
    body.innerHTML = `<p class="muted">找到 ${res.length}${res.length >= 200 ? '+' : ''} 筆</p><div class="ilist">${shown.map(d => itemRow(d, `<small class="from">${esc(lessonTitle(d))}</small>`)).join('')}</div>` +
      (res.length > shown.length ? '<button class="btn" data-act="more-rows">顯示更多</button>' : '') + (!res.length ? '<p class="muted">找不到符合的句子。試試別的關鍵字，或放寬篩選。</p>' : '');
    return;
  }
  const cat = App.catalog, active = filterActive(App.filters), p = pred();
  const cnt = l => (active ? l.ids.filter(id => p(App.byId.get(id))).length : l.ids.length);
  const keep = l => !active || cnt(l) > 0;
  const pre = preClassLessons(cat).filter(keep).slice(0, 3);
  const preKeys = new Set(pre.map(l => l.key));
  const rest = cat.lessons.filter(l => !preKeys.has(l.key) && keep(l));
  const shown = rest.slice(0, App.libLimit);
  body.innerHTML = (pre.length ? `<h2>最近的課前／課後練習</h2><div class="lgrid">${pre.map(lessonCard).join('')}</div>` : '') +
    `<h2>所有課程${active ? `<small class="muted">（符合篩選的 ${rest.length + pre.length} 課）</small>` : `<small class="muted">（${cat.lessons.length} 課，新的在前）</small>`}</h2>
<div class="lgrid">${shown.map(lessonCard).join('') || '<p class="muted">沒有符合的課程。</p>'}</div>` +
    (rest.length > shown.length ? `<div class="center"><button class="btn" data-act="more-cards">顯示更多（還有 ${rest.length - shown.length} 課）</button></div>` : '');
}

export function renderLesson(key) {
  const l = App.catalog.byKey.get(key), page = $('lessonPage');
  if (!l) { page.innerHTML = '<p>找不到這個課程。</p><a class="btn" href="#/library">回課程</a>'; return false; }
  const st = lessonStats(l, status, P.getProg());
  const items = l.ids.map(id => App.byId.get(id)).filter(Boolean);
  const tabs = ['sentence', 'vocab', 'extra'].filter(t => l.counts[t]);
  let tab = App.tabs[key];
  if (!tabs.includes(tab)) tab = tabs[0];
  App.tabs[key] = tab;
  const kinds = ['pre', 'post', 'class'].filter(k => l.kinds[k]);
  const f = App.filters, active = f.status !== 'all' || !!f.kind;
  const p = makeFilter({ ...f, type: '' }, status);
  const inTab = items.filter(d => d.t === tab);
  const list = inTab.filter(p);
  App.listIds = list.map(d => d.i);
  App.listReturn = '#/lesson/' + encodeURIComponent(key);
  const c = chipsHtml();
  const more = MORE.filter(([g]) => g === 'status' || (g === 'kind' && kinds.length > 1)).map(([g, v, lab]) => chipBtn(g, v, lab, f[g] === v)).join('');
  page.innerHTML = `<a class="back" href="#/library">← 課程</a>
<div class="lh"><div><h1>${esc(l.title)}${l.topic ? ` <span class="lh-topic">${esc(l.topic)}</span>` : ''}</h1><div class="muted">${l.date ? fmtDate(l.date) + '・' : ''}${l.user ? '我加入的文章・' : ''}句子 ${l.counts.sentence}・單字 ${l.counts.vocab}${l.counts.extra ? `・補充 ${l.counts.extra}` : ''}</div></div>
<button class="btn primary" data-act="lesson-start" data-key="${esc(key)}">練這一課</button></div>
<div class="lstat">${bar(st.pct)}<span>已熟練 <b>${st.pct}%</b></span><span class="muted">練過 ${st.practiced}/${st.total}${st.avg != null ? `・平均 ${st.avg}` : ''}${st.due ? `・待複習 ${st.due}` : ''}</span></div>
<div class="tabs2">${tabs.map(t => `<button class="tab2${t === tab ? ' on' : ''}" data-act="ltab" data-tab="${t}">${TL[t]} <small>${items.filter(d => d.t === t).length}</small></button>`).join('')}</div>
<div class="chips">${c.primary.replace(/<button class="chip link"[^>]*>.*?<\/button>/, '')}</div>
<div class="chips more">${more}</div>
<div class="ilist">${list.slice(0, App.rowLimit).map(d => itemRow(d, kinds.length > 1 ? `<small class="from">${KL[d.kind]}</small>` : '')).join('') || '<p class="muted pad">沒有符合的句子。</p>'}</div>` +
    (list.length > App.rowLimit ? `<div class="center"><button class="btn" data-act="more-rows">顯示更多（還有 ${list.length - App.rowLimit} 句）</button></div>` : '');
  return true;
}

// ---- 統計 ----
function renderConf() {
  const c = P.getConf();
  const arr = Object.entries(c).sort((a, b) => b[1].n - a[1].n).slice(0, 15);
  $('confList').innerHTML = arr.length ? '<div class="tscroll"><table class="cmp"><tr><th>該唸</th><th>你常唸成</th><th>次數</th><th>例字</th><th>說明</th></tr>' + arr.map(([k, v]) => {
    const [e, h] = k.split('→');
    const x = explain(e, h, { word: (v.w || []).slice(-1)[0] });
    return `<tr><td class="pe">${esc(respell([e]))} ${chip(e)}</td><td class="ph-bad">${h === '—' ? '（沒唸）' : esc(respell([h])) + ' ' + chip(h)}</td><td>${v.n}</td><td>${esc((v.w || []).slice(-4).join(', '))}</td><td><small>${x ? `<b>${esc(x.typeLabel)}</b> ${esc(x.verdict)}<br><b>練習：</b>${esc(x.fix)}` : ''}</small></td></tr>`;
  }).join('') + '</table></div>' : '<p class="muted">尚無紀錄（使用 Azure 評分後會累積）</p>';
}
function renderWeak() {
  const w = P.getWeak();
  const arr = Object.entries(w).filter(([k, v]) => v.bad > 0).sort((a, b) => (b[1].bad - b[1].ok / 2) - (a[1].bad - a[1].ok / 2)).slice(0, 40);
  $('weakList').innerHTML = arr.length ? arr.map(([k, v]) => `<span class="w bad" data-w="${esc(k)}" title="點擊聽發音">${esc(k)} <small>錯 ${v.bad}・對 ${v.ok}${v.heard ? ' 聽成：' + esc(v.heard) : ''}</small></span>`).join('') : '<p class="muted">尚無紀錄</p>';
}
export { renderConf, renderWeak };

export function renderStats() {
  const prog = P.getProg(), now = Date.now();
  const counts = { good: 0, due: 0, fair: 0, weak: 0, new: 0 };
  let sum = 0, n = 0, tries = 0;
  for (const d of App.items) {
    counts[status(d.i, now)]++;
    const p = prog[d.i];
    if (p && p.a) { sum += p.l; n++; tries += p.a; }
  }
  const T = App.items.length || 1;
  $('statNums').innerHTML = stat(P.streak(), '連續天數') + stat(P.todayCount(), '今天練了') + stat(tries, '總練習次數') + stat(n ? Math.round(sum / n) : '-', '平均分數');
  const hist = P.dayHistory(14), max = Math.max(1, ...hist.map(h => h.n));
  $('histChart').innerHTML = `<div class="hist">${hist.map(h => `<div class="hbar" title="${h.key}：${h.n} 題${h.avg != null ? `，平均 ${h.avg}` : ''}"><em>${h.avg != null ? h.avg : ''}</em><i style="height:${Math.round(100 * h.n / max)}%"></i><span>${+h.key.slice(-2)}</span></div>`).join('')}</div><p class="muted">長條＝當天練的題數，上方數字＝當天平均分數。</p>`;
  $('masteryBar').innerHTML = `<div class="stack">${['good', 'due', 'fair', 'weak', 'new'].map(s => `<i style="width:${100 * counts[s] / T}%;background:${ST[s][1]}" title="${ST[s][0]} ${counts[s]}"></i>`).join('')}</div>
<div class="legend">${['good', 'due', 'fair', 'weak', 'new'].map(s => `<span><i class="dot" style="background:${ST[s][1]}"></i>${ST[s][0]} <b>${counts[s]}</b></span>`).join('')}</div>`;
  const miss = missRanking(P.getConf(), lsGet('ipaQuiz', {}));
  const top = Object.entries(miss).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  $('weakSounds').innerHTML = top.length
    ? '<div class="wsounds">' + top.map(([k, v]) => { const x = phInfo(k); return `<div class="wsound">${chip(k, { big: true })}<div><b>${esc(x.known ? x.label : k)}</b> <span class="muted">錯 ${v} 次</span><br><small>${esc(x.known ? x.tip : '')}</small></div></div>`; }).join('') + '</div><button class="btn sm" data-act="open-ipa">看音標教學</button>'
    : '<p class="muted">還沒有資料。用 Azure 評分練幾題、或做音標小測驗後，常錯的音會出現在這裡。</p>';
  renderConf();
  renderWeak();
  const worst = App.items.filter(d => prog[d.i] && prog[d.i].a && prog[d.i].l < 70).sort((a, b) => prog[a.i].l - prog[b.i].l).slice(0, 8);
  App.listIds = worst.map(d => d.i);
  App.listReturn = '#/stats';
  $('weakItemsList').innerHTML = worst.length ? `<div class="ilist">${worst.map(d => itemRow(d)).join('')}</div>` : '<p class="muted">目前沒有低於 70 分的句子。</p>';
}

// ---- 完成 ----
export function renderDone() {
  const r = lsGet('lastSession', null), page = $('donePage');
  if (!r) { page.innerHTML = '<p>還沒有完成的練習。</p><a class="btn primary" href="#/today">回今天</a>'; return; }
  const sm = r.summary;
  const msg = sm.done === 0 ? '這次沒有完成任何一題。' : sm.avg >= 85 ? '很棒，維持這個節奏。' : sm.avg >= 70 ? '不錯，再練幾次會更穩。' : '有進步空間，下面幾題值得再練。';
  App.listIds = sm.hard.map(h => h.id);
  App.listReturn = '#/done';
  page.innerHTML = `<div class="card done"><div class="hero-k">練習完成</div><h1>練了 ${sm.done} 題</h1><p class="muted">${sm.skipped ? `略過 ${sm.skipped} 題・` : ''}共 ${sm.total} 題</p><p>${msg}</p>
<div class="statrow">${stat(sm.avg ?? '-', '平均分數')}${stat(sm.good, '達到 85 分以上')}${stat(sm.records, '破個人最佳')}${stat(P.streak(), '連續天數')}</div>
${sm.hard.length ? `<h2>建議再練</h2><div class="ilist">${sm.hard.map(h => { const d = App.byId.get(h.id); return d ? itemRow(d) : ''; }).join('')}</div>` : ''}
<div class="btnrow"><button class="btn primary big" data-act="start-new">再練一輪</button><a class="btn" href="#/stats">看統計</a><a class="btn" href="#/today">回首頁</a></div></div>`;
}
