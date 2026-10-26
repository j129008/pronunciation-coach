// Practice data: validation, ordering, and loading (data/items.json → IndexedDB → file picker).
export const IDB = {
  open() {
    return new Promise((ok, no) => {
      const r = indexedDB.open('pronunciation-coach', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise((ok, no) => {
      const q = db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
  },
  async set(k, v) {
    const db = await this.open();
    return new Promise((ok, no) => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').put(v, k);
      t.oncomplete = () => ok();
      t.onerror = () => no(t.error);
    });
  },
  async del(k) {
    const db = await this.open();
    return new Promise(ok => {
      const t = db.transaction('kv', 'readwrite');
      t.objectStore('kv').delete(k);
      t.oncomplete = () => ok();
    });
  },
};

export function validItems(a) {
  if (!Array.isArray(a)) a = a && a.items;
  if (!Array.isArray(a) || !a.length) throw new Error('JSON 必須是陣列（或 {items:[...]}）');
  const items = a.map((d, k) => {
    if (!d || typeof d.e !== 'string') throw new Error('第 ' + (k + 1) + ' 筆缺少 "e"（英文）欄位');
    return Object.assign({ i: k + 1, t: 'sentence', z: '', x: '', p: '', l: '' }, d);
  });
  // ids must be unique numbers (lookups use Number ids); fix up strings and duplicates
  const used = new Set();
  for (const d of items) { d.i = Number(d.i); if (Number.isFinite(d.i) && !used.has(d.i)) used.add(d.i); else d.i = NaN; }
  let nextId = Math.max(0, ...used) + 1;
  for (const d of items) if (Number.isNaN(d.i)) d.i = nextId++;
  return items;
}

export function lessonOf(d) {
  const m = (d.l || '').match(/L(\d{2,4})/);
  return m ? 'L' + m[1].padStart(3, '0') : '其他';
}

// "課前練習…" lessons that come from the data file itself (not the user-lesson store)
export const isPreClassLabel = l => typeof l === 'string' && l.startsWith('課前練習');
// YYYY/MM/DD (also - or .) inside a label → UTC ms, 0 when there is none
export function labelDate(label) {
  const m = String(label || '').match(/(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : 0;
}

// Adds lesson `L` and sort position `o_`; returns the lookup structures the UI needs.
// Pinned section on top: user-added lessons (d.u, newest-added first), then file lessons labelled 課前練習…
// (d.pre, newest date in the label first). `pinned` = label of the top group, `pinnedLabels` = all pinned labels in order.
export function prepareItems(DATA) {
  DATA.forEach(d => {
    d.pre = !d.u && isPreClassLabel(d.l);
    d.L = d.u || d.pre ? d.l : lessonOf(d);
  });
  const added = new Map(), dated = new Map();
  for (const d of DATA) {
    if (d.u) added.set(d.L, Math.max(added.get(d.L) || 0, d.added || 0));
    else if (d.pre) dated.set(d.L, labelDate(d.L));
  }
  const rank = d => (d.u ? 0 : d.pre ? 1 : 2);
  const ORDERED = DATA.slice().sort((a, b) => (rank(a) - rank(b)) ||
    (a.u ? (added.get(b.L) - added.get(a.L)) || a.L.localeCompare(b.L) || a.i - b.i
      : a.pre ? (dated.get(b.L) - dated.get(a.L)) || a.L.localeCompare(b.L) || a.i - b.i
        : (a.L === '其他') - (b.L === '其他') || a.L.localeCompare(b.L) || a.i - b.i));
  ORDERED.forEach((d, k) => { d.o_ = k; });
  const byId = new Map(DATA.map(d => [d.i, d]));
  const pinnedLabels = [...new Set(ORDERED.filter(d => d.u || d.pre).map(d => d.L))];
  const pinned = pinnedLabels[0] || null;
  return { DATA, ORDERED, byId, pinned, pinnedLabels };
}

// user-added items (separate IndexedDB key, so they survive reloads and data-file changes)
export const USER_KEY = 'userItems';
export async function loadUserItems(store = IDB) {
  try { const v = await store.get(USER_KEY); return Array.isArray(v) ? v.filter(d => d && typeof d.e === 'string' && d.u) : []; } catch (e) { return []; }
}
export const saveUserItems = (items, store = IDB) => store.set(USER_KEY, items);

// Order: data/items.json → items saved in IndexedDB → `pick()` (UI prompt, resolves {items, save}).
export async function loadData({ fetchFn = (...a) => fetch(...a), store = IDB, pick } = {}) {
  try {
    const r = await fetchFn('data/items.json', { cache: 'no-store' });
    if (r.ok) return validItems(await r.json());
  } catch (e) { /* fall through */ }
  try {
    const v = await store.get('items');
    if (v && v.length) return v;
  } catch (e) { /* fall through */ }
  const { items, save } = await pick();
  if (save) await Promise.resolve(store.set('items', items)).catch(() => {});
  return items;
}
