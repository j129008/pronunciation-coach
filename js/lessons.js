// User-added lessons ("加入文章"): items live in IndexedDB next to — never inside — the loaded data set.
// Ids start at USER_ID_BASE so they can never collide with the data file's ids; progress is keyed by id.
export const USER_ID_BASE = 1000000;
export const userLabel = d => '#U' + (d.i - USER_ID_BASE);

export function defaultLabel(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `加入 ${now.getFullYear()}/${p(now.getMonth() + 1)}/${p(now.getDate())}`;
}

export const nextUserId = (user = []) => Math.max(USER_ID_BASE, ...user.map(d => d.i || 0)) + 1;

// sentences → new user items (does not touch existing ones)
export function makeUserItems(lines, label, existingUser = [], now = Date.now()) {
  let id = nextUserId(existingUser);
  const l = String(label || '').trim() || defaultLabel(new Date(now));
  return lines.map(s => String(s).trim()).filter(Boolean).map(e => ({ i: id++, t: 'sentence', e, z: '', x: '', p: '', l, u: 1, added: now }));
}

// data-file items first, user items appended on top; a user item whose id is taken gets a fresh one
export function mergeUserItems(base, user = []) {
  const used = new Set(base.map(d => d.i)), out = base.slice();
  let next = Math.max(USER_ID_BASE, ...user.map(d => d.i || 0), ...base.map(d => d.i)) + 1;
  for (const d of user) {
    let i = d.i;
    if (!Number.isFinite(i) || used.has(i)) i = next++;
    used.add(i);
    out.push({ ...d, i, u: 1, t: d.t || 'sentence' });
  }
  return out;
}

// [{label, count, added}] newest first
export function lessonsOf(items) {
  const m = new Map();
  for (const d of items) if (d.u) {
    const x = m.get(d.l) || { label: d.l, count: 0, added: 0 };
    x.count++;
    x.added = Math.max(x.added, d.added || 0);
    m.set(d.l, x);
  }
  return [...m.values()].sort((a, b) => b.added - a.added);
}

export function deleteLesson(user, label) {
  const removed = user.filter(d => d.l === label).map(d => d.i);
  return { user: user.filter(d => d.l !== label), removedIds: removed };
}

// what the JSON export contains (no internal fields)
export const exportUserItems = user => user.map(({ i, t, e, z, x, p, l, added }) => ({ i, t, e, z, x, p, l, added }));
