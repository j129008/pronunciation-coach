// Library model (pure): turns the messy lesson labels into lessons, searches and filters items.
// Labels look like "L162 (2026/10/22)", several joined by "; ", "課前練習 L166 (2026/10/26) Company structure",
// "課後複習 L166 (…) topic", "英文課 12 (…)", "課前練習 面試自我介紹 (…)". An item belongs to the lesson of its
// LATEST dated label (not the first one).

const KIND_RE = /^\s*(課前練習|課後複習)\s*/;
const DATE_RE = /(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/;

export function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}

// one "; "-separated segment → {raw, kind:'pre'|'post'|'class', num, name, date, topic}
export function parseSegment(raw) {
  let s = String(raw || '').trim();
  const km = s.match(KIND_RE);
  const kind = km ? (km[1] === '課前練習' ? 'pre' : 'post') : 'class';
  if (km) s = s.slice(km[0].length);
  const dm = s.match(DATE_RE);
  const date = dm ? Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) : 0;
  let before = s, after = '';
  if (dm) {
    before = s.slice(0, dm.index);
    after = s.slice(dm.index + dm[0].length).replace(/^\s*\)?\s*/, '');
  }
  const lm = before.match(/\bL\s?(\d{1,4})\b/);
  const num = lm ? +lm[1] : null;
  const name = before.replace(/\bL\s?\d{1,4}\b/, '').replace(/[()（）]/g, ' ').replace(/\s+/g, ' ').trim();
  // no date: whatever follows the lesson id is the topic
  const topic = (dm ? after : name && num != null ? name : '').replace(/^[-–:：\s]+/, '').trim();
  return { raw: String(raw || '').trim(), kind, num, name: dm || num == null ? name : '', date, topic };
}

export function parseLabels(label) {
  return String(label || '').split(/\s*;\s*/).map(parseSegment).filter(s => s.raw);
}

// latest date wins; same day → higher lesson number; undated → highest number
export function primarySegment(segs) {
  return segs.slice().sort((a, b) => (b.date - a.date) || ((b.num ?? -1) - (a.num ?? -1)))[0] || null;
}

export const lessonKey = seg => !seg ? 'other' : seg.num != null ? 'L' + String(seg.num).padStart(3, '0') : seg.name ? 'n:' + seg.name : 'other';

// Annotates every item (d.lk lesson key, d.kind, d.lDate) and groups them into lessons.
// User-added items (d.u) never merge into file lessons: key 'u:<label>'.
export function buildCatalog(items) {
  const map = new Map();
  for (const d of items) {
    let key, seg = null;
    if (d.u) {
      seg = primarySegment(parseLabels(d.l)) || { kind: 'pre', date: 0, num: null, name: '', topic: '' };
      key = 'u:' + d.l;
      d.kind = 'pre';
      d.lDate = d.added || seg.date || 0;
    } else {
      seg = primarySegment(parseLabels(d.l));
      key = lessonKey(seg);
      d.kind = seg ? seg.kind : 'class';
      d.lDate = seg ? seg.date : 0;
    }
    d.lk = key;
    let L = map.get(key);
    if (!L) {
      L = { key, user: !!d.u, num: seg && seg.num != null ? seg.num : null, name: d.u ? d.l : (seg && seg.name) || '', date: 0, ids: [], counts: { sentence: 0, vocab: 0, extra: 0 }, kinds: { pre: 0, post: 0, class: 0 }, topics: new Map() };
      map.set(key, L);
    }
    L.ids.push(d.i);
    L.counts[d.t] = (L.counts[d.t] || 0) + 1;
    L.kinds[d.kind]++;
    L.date = Math.max(L.date, d.lDate);
    if (seg && seg.topic && !d.u) L.topics.set(seg.topic, (L.topics.get(seg.topic) || 0) + (seg.kind === 'class' ? 1 : 3));
  }
  const lessons = [...map.values()].map(L => {
    const topic = [...L.topics.entries()].sort((a, b) => b[1] - a[1])[0];
    L.topic = topic ? topic[0] : '';
    L.title = L.user ? L.name : L.num != null ? 'L' + String(L.num).padStart(3, '0') : L.key === 'other' ? '其他' : L.name;
    L.hasPre = L.kinds.pre + L.kinds.post > 0;
    delete L.topics;
    return L;
  });
  const file = lessons.filter(l => !l.user && l.key !== 'other')
    .sort((a, b) => (b.date - a.date) || ((b.num ?? -1) - (a.num ?? -1)) || a.title.localeCompare(b.title));
  const user = lessons.filter(l => l.user).sort((a, b) => b.date - a.date || a.title.localeCompare(b.title));
  const other = lessons.filter(l => l.key === 'other');
  const all = [...user, ...file, ...other];
  return { lessons: all, user, file, other, byKey: new Map(all.map(l => [l.key, l])) };
}

// the lessons that count as 課前／課後 practice, newest first (user-added lessons are always pre-class)
export function preClassLessons(cat) {
  return cat.lessons.filter(l => l.user || l.hasPre).sort((a, b) => b.date - a.date || (b.num ?? -1) - (a.num ?? -1));
}

// {total, practiced, mastered, pct, avg, due, weak}; statusFn(id) → 'new'|'weak'|'fair'|'good'|'due', prog = {id:{a,l,b…}}
export function lessonStats(lesson, statusFn, prog) {
  let practiced = 0, mastered = 0, due = 0, weak = 0, sum = 0;
  for (const id of lesson.ids) {
    const s = statusFn(id), p = prog[id];
    if (p && p.a) { practiced++; sum += p.l; }
    if (s === 'good' || s === 'due') mastered++;
    if (s === 'due') due++;
    if (s === 'weak') weak++;
  }
  const total = lesson.ids.length;
  return { total, practiced, mastered, due, weak, pct: total ? Math.round(100 * mastered / total) : 0, avg: practiced ? Math.round(sum / practiced) : null };
}

// ---- search ----
const hay = d => d._h || (d._h = [d.e, d.z, d.x, d.o, d.l].filter(Boolean).join(' ').toLowerCase());
// instant substring search over English, Chinese, example sentence and label; every word must match.
// Ranking: English starts-with, English contains, Chinese contains, anything else.
export function searchItems(items, query, { limit = 200, pred = null } = {}) {
  const toks = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const out = [];
  for (const d of items) {
    if (pred && !pred(d)) continue;
    const h = hay(d);
    let ok = true, rank = 3;
    for (const t of toks) {
      if (t[0] === '#' && /^#\d+$/.test(t)) { if (String(d.i) !== t.slice(1)) { ok = false; break; } rank = 0; continue; }
      if (!h.includes(t)) { ok = false; break; }
    }
    if (!ok) continue;
    const e = d.e.toLowerCase();
    if (rank !== 0) rank = e.startsWith(toks[0]) ? 0 : e.includes(toks[0]) ? 1 : (d.z || '').toLowerCase().includes(toks[0]) ? 2 : 3;
    out.push([rank, d]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1].e.length - b[1].e.length);
  return out.slice(0, limit).map(x => x[1]);
}

// ---- filters (library chips) ----
// f = {status:'all'|'new'|'weak'|'due'|'fair'|'good', type:''|'sentence'|'vocab'|'extra', kind:''|'pre'|'post'|'class'}
export function makeFilter(f, statusFn) {
  return d => (!f.type || d.t === f.type) && (!f.kind || d.kind === f.kind) && (f.status === 'all' || statusFn(d.i) === f.status);
}
export const filterActive = f => f.status !== 'all' || !!f.type || !!f.kind;
