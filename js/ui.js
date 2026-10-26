// App shell: data-loading screen, hash router, practice sessions, and wiring for all screens.
import { $, esc, dkey, lsGet } from './util.js';
import { IDB, validItems, saveUserItems } from './data.js';
import { lessonsOf, makeUserItems, deleteLesson, exportUserItems } from './lessons.js';
import { initAdd, renderAddLessons } from './addui.js';
import * as P from './progress.js';
import { fillVoices } from './tts.js';
import { initIpa } from './ipaui.js';
import { initPractice, showItem, stopAll, stdRate, updBadge } from './practice.js';
import { parseRoute, tabOf } from './router.js';
import { App, setItems, lessonTitle, sessionSize, status } from './state.js';
import { lessonSession, summarize, WHY } from './session.js';
import * as V from './views.js';

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

const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };
const VIEWS = { today: 'v-today', library: 'v-library', lesson: 'v-lesson', stats: 'v-stats', settings: 'v-settings', practice: 'v-practice', done: 'v-done' };

// ---- practice context (what "next" means) ----
const curId = () => (App.ctx ? App.ctx.ids[App.ctx.idx] : null);
function saveSession() { if (App.session) localStorage.session = JSON.stringify(App.session); else localStorage.removeItem('session'); }

function openItem(id, { ids, returnTo } = {}) {
  const list = (ids && ids.includes(id) ? ids : [id]).filter(x => App.byId.has(x));
  App.ctx = { ids: list, idx: Math.max(0, list.indexOf(id)), returnTo: returnTo || '#/library', session: false };
  go('#/practice/' + id);
}
function startSession(plan) {
  if (!plan || !plan.ids.length) return go('#/library');
  App.session = { ids: plan.ids, why: plan.why, idx: 0, scores: {}, prevBest: {}, lesson: plan.lesson, started: Date.now(), date: dkey(Date.now()) };
  saveSession();
  resumeSession();
}
function resumeSession() {
  const s = App.session;
  if (!s) return go('#/today');
  App.ctx = { ids: s.ids, idx: Math.min(s.idx, s.ids.length - 1), returnTo: '#/today', session: true };
  go('#/practice/' + curId());
}
function finishSession() {
  const s = App.session;
  const summary = summarize(s, s.scores, s.prevBest, App.byId);
  localStorage.lastSession = JSON.stringify({ date: s.date, finished: Date.now(), lesson: s.lesson, summary });
  App.session = null; App.ctx = null;
  saveSession();
  go('#/done');
}
function next() {
  const c = App.ctx;
  if (!c) return go('#/today');
  if (c.session) {
    App.session.idx = c.idx + 1;
    saveSession();
    if (App.session.idx >= c.ids.length) return finishSession();
    c.idx = App.session.idx;
  } else if (c.idx + 1 < c.ids.length) c.idx++;
  else return go(c.returnTo);
  showCurrent();
}
function prev() {
  const c = App.ctx;
  if (!c || c.idx <= 0) return;
  c.idx--;
  if (c.session) { App.session.idx = c.idx; saveSession(); }
  showCurrent();
}
function back() {
  const c = App.ctx;
  if (c && c.session && (App.session.idx > 0 || Object.keys(App.session.scores).length) && !confirm('先離開這次練習？進度會保留，之後可以從「今天」繼續。')) return;
  go(c ? c.returnTo : '#/today');
}
function nextLabel() {
  const c = App.ctx;
  if (!c) return '下一題';
  if (c.session) return c.idx + 1 < c.ids.length ? `下一題（${c.idx + 2} / ${c.ids.length}）` : '完成';
  return c.idx + 1 < c.ids.length ? '下一題' : '回列表';
}
function showCurrent() {
  const c = App.ctx, d = c && App.byId.get(curId());
  if (!d) return go('#/today');
  showItem(d, c.session ? WHY[App.session.why[d.i]] || '' : '');
  $('next').textContent = nextLabel();
  $('prev').disabled = c.idx === 0;
  const n = c.ids.length;
  $('pProg').hidden = !c.session;
  $('pProgFill').style.width = (c.session ? Math.round(100 * c.idx / n) : 0) + '%';
  $('pCount').textContent = n > 1 ? `${c.session ? '第 ' : ''}${c.idx + 1} / ${n}${c.session ? ' 題' : ''}` : '';
  history.replaceState(null, '', '#/practice/' + d.i);
  document.body.dataset.shown = String(d.i);
}
function onAttempt(item, r) {
  const s = App.session;
  if (!(App.ctx && App.ctx.session && s && item.i === curId())) return;
  s.scores[item.i] = Math.max(s.scores[item.i] || 0, r.score);
  if (!(item.i in s.prevBest)) s.prevBest[item.i] = r.prevBest;
  saveSession();
}

// ---- router ----
let lastHash = null;
function render() {
  const r = parseRoute(location.hash);
  const prevView = document.body.dataset.view;
  if (prevView === 'practice' && r.name !== 'practice') stopAll();
  document.body.dataset.view = r.name;
  for (const [n, id] of Object.entries(VIEWS)) $(id).hidden = n !== r.name;
  document.querySelectorAll('#tabs [data-tab]').forEach(a => { const on = a.dataset.tab === tabOf(r); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  switch (r.name) {
    case 'today': V.renderToday(); break;
    case 'library': V.renderLibrary(); break;
    case 'lesson': if (!V.renderLesson(r.key)) break; break;
    case 'stats':
      V.renderStats();
      if (r.section === 'ipa') { $('ipaPanel').open = true; $('ipaWrap').scrollIntoView(); }
      break;
    case 'settings': renderSettings(); break;
    case 'done': V.renderDone(); break;
    case 'practice':
      if (r.id != null && curId() !== r.id) {
        if (!App.byId.has(r.id)) return go('#/today');
        const inSession = App.session && App.session.ids.includes(r.id);
        if (inSession) { App.ctx = { ids: App.session.ids, idx: App.session.ids.indexOf(r.id), returnTo: '#/today', session: true }; App.session.idx = App.ctx.idx; saveSession(); }
        else App.ctx = { ids: [r.id], idx: 0, returnTo: '#/library', session: false };
        showCurrent();
      } else if (!App.ctx) return go('#/today');
      else if (r.id == null || document.body.dataset.shown !== String(curId())) showCurrent();
      break;
    default: break;
  }
  if (r.name !== 'practice') delete document.body.dataset.shown;
  if (lastHash !== location.hash && !(r.name === 'stats' && r.section)) window.scrollTo(0, 0);
  lastHash = location.hash;
}

// ---- settings screen ----
function renderSettings() {
  $('sessSize').value = String(sessionSize());
  $('azKey').value = localStorage.azKey || '';
  $('azRegion').value = localStorage.azRegion || '';
  $('azOn').checked = localStorage.azOn === '1';
  updBadge();
}

// ---- user-added lessons ----
function refreshLessons() { renderAddLessons(lessonsOf(App.user)); }
async function saveLesson({ label, lines }) {
  const added = makeUserItems(lines, label, App.user);
  const user = [...App.user, ...added];
  await saveUserItems(user);
  setItems([...App.base, ...user]);
  refreshLessons();
  go('#/lesson/' + encodeURIComponent('u:' + added[0].l));
}
async function removeLesson(label) {
  const n = App.user.filter(d => d.l === label).length;
  if (!confirm(`刪除課程「${label}」的 ${n} 個句子與它們的練習紀錄？（原本的題目不受影響）`)) return;
  const { user, removedIds } = deleteLesson(App.user, label);
  await saveUserItems(user);
  P.forgetItems(removedIds);
  if (App.session) { App.session.ids = App.session.ids.filter(id => !removedIds.includes(id)); App.session.idx = Math.min(App.session.idx, App.session.ids.length); saveSession(); if (!App.session.ids.length) { App.session = null; saveSession(); } }
  setItems([...App.base, ...user]);
  refreshLessons();
  if (location.hash.startsWith('#/lesson/')) go('#/library'); else render();
}
function download(name, data) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  a.download = name;
  a.click();
}
const exportUser = () => download('my_articles_' + dkey(Date.now()) + '.json', exportUserItems(App.user));

// ---- entry ----
export function startApp(items) {
  setItems(items);
  P.migrate(App.byId);
  const saved = lsGet('session', null);
  if (saved && saved.date === dkey(Date.now()) && Array.isArray(saved.ids) && saved.idx < saved.ids.length) {
    saved.ids = saved.ids.filter(id => App.byId.has(id));
    if (saved.ids.length && saved.idx < saved.ids.length) App.session = saved;
  }
  App.act = { openItem, startSession, resumeSession };
  initPractice({ onAttempt, nextLabel, lessonTitle, openIpa: () => go('#/stats/ipa') });
  initIpa({ stdRate });
  initAdd({ onSave: saveLesson, onDeleteLesson: removeLesson, onExport: exportUser });
  refreshLessons();

  // navigation + actions (event delegation)
  $('app').addEventListener('click', e => {
    const f = e.target.closest('[data-f]');
    if (f) { const [g, v] = f.dataset.f.split(':'); V.setFilter(g, v); render(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const d = a.dataset;
    switch (d.act) {
      case 'open': openItem(+d.id, { ids: App.listIds, returnTo: App.listReturn }); break;
      case 'start': startSession(App.plan || V.computePlan()); break;
      case 'start-new': startSession(V.computePlan()); break;
      case 'resume': resumeSession(); break;
      case 'restart': if (confirm('重新開始今天的練習？目前的進度會被取代。')) { App.session = null; saveSession(); startSession(V.computePlan()); } break;
      case 'more-f': App.moreOpen = !App.moreOpen; render(); break;
      case 'more-cards': App.libLimit += 36; render(); break;
      case 'more-rows': App.rowLimit += 100; render(); break;
      case 'ltab': App.tabs[decodeURIComponent(location.hash.replace('#/lesson/', ''))] = d.tab; App.rowLimit = 100; render(); break;
      case 'lesson-start': { const l = App.catalog.byKey.get(d.key); if (l) startSession(lessonSession(l, App.items, status, sessionSize())); break; }
      case 'open-ipa': go('#/stats/ipa'); break;
      default: break;
    }
  });
  $('q').oninput = () => { App.query = $('q').value; App.rowLimit = 100; V.renderLibrary(); };
  $('pBack').onclick = back;
  $('next').onclick = next;
  $('prev').onclick = prev;
  document.addEventListener('keydown', e => {
    if (document.body.dataset.view !== 'practice') return;
    if (e.target.matches && e.target.matches('input,select,textarea,button') && e.code === 'Space') return;
    if (e.target.matches && e.target.matches('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); $('rec').click(); }
    else if (e.key === 'n' || e.key === 'N') next();
    else if (e.key === 'r' || e.key === 'R') $('listen').click();
  });

  // stats page clear buttons / weak-word playback
  $('clearWeak').onclick = () => { if (confirm('清除所有弱點紀錄？')) { P.clearWeak(); V.renderWeak(); } };
  $('clearConf').onclick = () => { if (confirm('清除常錯音紀錄？')) { P.clearConf(); V.renderStats(); } };
  $('weakList').onclick = e => { const s = e.target.closest('[data-w]'); if (s) import('./tts.js').then(m => m.speak(s.dataset.w, 0.7)); };

  // settings
  $('sessSize').onchange = e => { localStorage.sessSize = e.target.value; };
  $('azSave').onclick = () => {
    localStorage.azKey = $('azKey').value.trim();
    localStorage.azRegion = $('azRegion').value.trim();
    localStorage.azOn = $('azOn').checked ? '1' : '0';
    updBadge();
    alert('已儲存');
  };
  $('azOn').onchange = () => { localStorage.azOn = $('azOn').checked ? '1' : '0'; updBadge(); };
  renderSettings();
  speechSynthesis.onvoiceschanged = () => fillVoices($('voice'));
  fillVoices($('voice'));
  $('voice').onchange = e => { localStorage.voice = e.target.value; };
  $('exportUserBtn').onclick = exportUser;
  $('exportBtn').onclick = () => download('pronunciation_progress_' + dkey(Date.now()) + '.json', P.exportProgress());
  $('importFile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!confirm('匯入會覆蓋目前進度，確定？')) return;
      P.importProgress(o);
      alert('已匯入');
      render();
    } catch (err) { alert('匯入失敗：' + err.message); }
  };
  $('forgetBtn').onclick = async () => {
    if (confirm('移除瀏覽器中保存的練習資料？（練習進度與你加入的文章不會刪除）')) { await IDB.del('items'); location.reload(); }
  };

  window.addEventListener('hashchange', render);
  render();
}
