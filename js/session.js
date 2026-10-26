// "今天練什麼" session builder (pure). Mixes: spaced-repetition reviews, the latest 課前/課後 lesson,
// and sentences that contain your weakest words — then interleaves them.
import { norm } from './normalize.js';
import { preClassLessons } from './library.js';

export const WHY = { due: '待複習', weak: '要加強', lesson: '本週課程', sound: '弱點字', new: '新題', fair: '再練一次' };

// weak: {word: {bad, ok}} (progress.getWeak); how much a word is worth practising
export const weakScore = w => (w && w.bad > 0 ? w.bad - (w.ok || 0) / 2 : 0);

// ctx: {catalog, prog, statusFn(id), weak, now, size, recentMs}
export function buildSession(items, ctx) {
  const { catalog, prog, statusFn, weak = {}, now = Date.now(), size = 15, recentMs = 10 * 60 * 1000 } = ctx;
  const byId = new Map(items.map(d => [d.i, d]));
  const fresh = d => { const p = prog[d.i]; return !p || !p.a || now - p.d >= recentMs; };
  const status = d => statusFn(d.i);
  const used = new Set();
  const take = (list, n, why) => {
    const out = [];
    for (const d of list) {
      if (out.length >= n) break;
      if (used.has(d.i) || !fresh(d)) continue;
      used.add(d.i);
      out.push({ id: d.i, why });
    }
    return out;
  };
  const quota = { review: Math.round(size * 0.4), lesson: Math.round(size * 0.4), sound: Math.max(1, size - 2 * Math.round(size * 0.4)) };

  // 1. reviews: due (most overdue first), then weak (lowest score first)
  const due = items.filter(d => status(d) === 'due').sort((a, b) => prog[a.i].d - prog[b.i].d);
  const weakItems = items.filter(d => status(d) === 'weak').sort((a, b) => prog[a.i].l - prog[b.i].l || prog[a.i].d - prog[b.i].d);
  const review = [...take(due, quota.review, 'due')];
  review.push(...take(weakItems, quota.review - review.length, 'weak'));

  // 2. the latest 課前/課後 lesson (else the latest lesson with something left), unfinished items first
  const pre = preClassLessons(catalog)[0];
  const latest = catalog.file.find(l => l.ids.some(id => ['new', 'weak', 'fair'].includes(statusFn(id))));
  const lesson = pre || latest || null;
  const rank = { new: 0, weak: 1, fair: 2, due: 3, good: 4 };
  const lessonItems = lesson
    ? lesson.ids.map(id => byId.get(id)).filter(d => d && status(d) !== 'good')
      .map((d, k) => [rank[status(d)] ?? 5, k, d]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2])
    : [];
  const fromLesson = take(lessonItems, quota.lesson, 'lesson');

  // 3. sentences containing your weakest words
  const wscore = Object.entries(weak).filter(([, v]) => weakScore(v) > 0);
  const wmap = new Map(wscore.map(([k, v]) => [k.toLowerCase(), weakScore(v)]));
  let sound = [];
  if (wmap.size) {
    sound = items
      .map(d => [norm(d.e).reduce((s, w) => s + (wmap.get(w) || 0), 0), d])
      .filter(x => x[0] > 0).sort((a, b) => b[0] - a[0] || a[1].e.length - b[1].e.length).map(x => x[1]);
  }
  const fromSound = take(sound, quota.sound, 'sound');

  // 4. top up to `size`: more reviews, more lesson items, new items of the newest lessons, then "fair" ones
  const picked = [review, fromLesson, fromSound];
  const total = () => picked.reduce((s, l) => s + l.length, 0);
  const fill = (list, why, bucket) => { if (total() < size) bucket.push(...take(list, size - total(), why)); };
  fill(due, 'due', review);
  fill(weakItems, 'weak', review);
  fill(lessonItems, 'lesson', fromLesson);
  if (total() < size) {
    const fresh2 = [];
    for (const l of catalog.file) for (const id of l.ids) { const d = byId.get(id); if (d && status(d) === 'new') fresh2.push(d); if (fresh2.length > size * 2) break; }
    fromLesson.push(...take(fresh2, size - total(), 'new'));
  }
  if (total() < size) fromLesson.push(...take(items.filter(d => status(d) === 'fair'), size - total(), 'fair'));

  // 5. interleave: lesson, review, sound, lesson, review, ... (no two sources in a block of three)
  const order = [], q = [fromLesson.slice(), review.slice(), fromSound.slice()];
  while (q.some(l => l.length)) for (const l of q) if (l.length) order.push(l.shift());
  return {
    ids: order.map(x => x.id), why: Object.fromEntries(order.map(x => [x.id, x.why])),
    lesson: lesson ? { key: lesson.key, title: lesson.title, topic: lesson.topic } : null,
    parts: { review: review.length, lesson: fromLesson.length, sound: fromSound.length },
  };
}

// lesson-only session: unfinished items of one lesson first
export function lessonSession(lesson, items, statusFn, size = 15) {
  const byId = new Map(items.map(d => [d.i, d]));
  const rank = { new: 0, weak: 1, due: 2, fair: 3, good: 4 };
  const ids = lesson.ids.map((id, k) => [rank[statusFn(id)] ?? 5, k, id]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]).filter(id => byId.has(id)).slice(0, size);
  return { ids, why: Object.fromEntries(ids.map(id => [id, 'lesson'])), lesson: { key: lesson.key, title: lesson.title, topic: lesson.topic }, parts: { review: 0, lesson: ids.length, sound: 0 } };
}

// summary of a finished session: scores = {id: best score this session}, prevBest = {id: best before}
export function summarize(session, scores, prevBest, byId) {
  const done = Object.keys(scores).map(Number);
  const vals = done.map(id => scores[id]);
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const records = done.filter(id => prevBest[id] != null && scores[id] > prevBest[id]).length;
  const firsts = done.filter(id => prevBest[id] == null).length;
  const hard = done.slice().sort((a, b) => scores[a] - scores[b]).filter(id => scores[id] < 85).slice(0, 3).map(id => ({ id, score: scores[id], e: byId.get(id) ? byId.get(id).e : '' }));
  return { total: session.ids.length, done: done.length, skipped: session.ids.length - done.length, avg, records, firsts, hard, good: vals.filter(v => v >= 85).length };
}
