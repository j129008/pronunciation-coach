// Everything persisted in localStorage: per-item progress, daily counts, weak words,
// phoneme confusions, backup/restore — plus the "smart next item" picker.
import { DAY, dkey, lsGet } from './util.js';

let PROG = lsGet('progress', {});
export const getProg = () => PROG;
export function saveProg() { localStorage.progress = JSON.stringify(PROG); }
export function reloadProg() { PROG = lsGet('progress', {}); }

// one-off: seed progress from the legacy weakItems map
export function migrate(byId) {
  if (localStorage.progMigrated) return;
  const wi = lsGet('weakItems', {});
  const now = Date.now() - 36e5;
  for (const [id, s] of Object.entries(wi)) if (!PROG[id] && byId.has(+id)) PROG[id] = { a: 1, b: s, l: s, d: now, h: [s] };
  saveProg();
  localStorage.progMigrated = '1';
}

// spaced repetition: the more consecutive good (>=85) takes, the longer until the item is due again
export function srDays(p) {
  const h = p.h && p.h.length ? p.h : [p.l];
  let c = 0;
  for (let i = h.length - 1; i >= 0 && h[i] >= 85; i--) c++;
  return c <= 1 ? 3 : c === 2 ? 7 : c === 3 ? 14 : 30;
}
// how long past its review date a good item is (ms; negative = not due yet)
export const overdueMs = (p, now = Date.now()) => now - p.d - srDays(p) * DAY;

export function statusOf(id, now, prog = PROG) {
  const p = prog[id];
  now = now || Date.now();
  if (!p || !p.a) return 'new';
  if (p.l >= 85) return overdueMs(p, now) >= 0 ? 'due' : 'good';
  if (p.l >= 70) return 'fair';
  return 'weak';
}

export function recordAttempt(id, score, now = Date.now()) {
  score = Math.max(0, Math.min(100, Math.round(score)));
  const p = PROG[id] || { a: 0, b: 0, l: 0, d: 0, h: [] };
  const prevBest = p.a ? p.b : null;
  p.a++;
  p.l = score;
  p.b = Math.max(p.a > 1 ? p.b : 0, score);
  p.d = now;
  p.h = (p.h || []).concat(score).slice(-5);
  PROG[id] = p;
  saveProg();
  const days = lsGet('days', {});
  const k = dkey(now);
  days[k] = (days[k] || 0) + 1;
  localStorage.days = JSON.stringify(days);
  const ds = lsGet('dayScores', {});
  ds[k] = { n: (ds[k] ? ds[k].n : 0) + 1, sum: (ds[k] ? ds[k].sum : 0) + score };
  localStorage.dayScores = JSON.stringify(ds);
  return { score, prevBest, p };
}

export function todayCount(now = Date.now()) { return lsGet('days', {})[dkey(now)] || 0; }

// last n calendar days (oldest first): [{key, n, avg}] — pure given the two stored maps
export function lastDays(days, scores, n = 14, now = Date.now()) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const key = dkey(now - k * DAY), s = scores[key];
    out.push({ key, n: days[key] || 0, avg: s && s.n ? Math.round(s.sum / s.n) : null });
  }
  return out;
}
export const dayHistory = (n = 14) => lastDays(lsGet('days', {}), lsGet('dayScores', {}), n);

export function streak() {
  const days = lsGet('days', {});
  let n = 0, t = Date.now();
  if (!days[dkey(t)]) t -= DAY;
  while (days[dkey(t)]) { n++; t -= DAY; }
  return n;
}

// weak words / items
export const getWeak = () => { try { return JSON.parse(localStorage.weakWords || '{}'); } catch (e) { return {}; } };
export const setWeak = w => { localStorage.weakWords = JSON.stringify(w); };
export const getWeakItems = () => { try { return JSON.parse(localStorage.weakItems || '{}'); } catch (e) { return {}; } };

export function recordWeakWords(al) {
  const w = getWeak();
  for (const x of al) {
    if (!x.t) continue;
    const k = x.t;
    w[k] = w[k] || { bad: 0, ok: 0, heard: '' };
    if (x.s === 'ok') w[k].ok++;
    else { w[k].bad++; if (x.h) w[k].heard = x.h; }
  }
  setWeak(w);
}

export function setWeakItem(id, score) {
  const wi = getWeakItems();
  if (score < 85) wi[id] = score; else delete wi[id];
  localStorage.weakItems = JSON.stringify(wi);
}

export function clearWeak() {
  localStorage.removeItem('weakWords');
  localStorage.removeItem('weakItems');
}

// phoneme confusions (Azure mode)
export const getConf = () => { try { return JSON.parse(localStorage.phConf || '{}'); } catch (e) { return {}; } };
export function saveConf(c) { localStorage.phConf = JSON.stringify(c); }
export function clearConf() { localStorage.removeItem('phConf'); }

// backup / restore
const BACKUP_KEYS = ['progress', 'days', 'dayScores', 'weakWords', 'weakItems', 'phConf'];
export function exportProgress() {
  const o = { version: 1, exported: new Date().toISOString() };
  for (const k of BACKUP_KEYS) o[k] = lsGet(k, {});
  return o;
}
export function importProgress(o) {
  for (const k of BACKUP_KEYS) if (o[k]) localStorage[k] = JSON.stringify(o[k]);
  localStorage.progMigrated = '1';
  reloadProg();
}

// removes progress for deleted items
export function forgetItems(ids) {
  const wi = getWeakItems();
  for (const id of ids) { delete PROG[id]; delete wi[id]; }
  saveProg();
  localStorage.weakItems = JSON.stringify(wi);
}
