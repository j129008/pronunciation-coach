// Hash router (pure parse/format). Routes: #/today #/library #/lesson/<key> #/practice[/<id>[/word/<word>]] #/words
// #/stats #/settings #/done,
// plus the legacy "#<id>" links which open that item.
export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '');
  if (/^\d+$/.test(h)) return { name: 'practice', id: +h };
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  const [name, arg] = parts;
  switch (name) {
    case 'library': return { name: 'library' };
    case 'lesson': return arg ? { name: 'lesson', key: parts.slice(1).join('/') } : { name: 'library' };
    case 'practice': {
      const id = arg && /^\d+$/.test(arg) ? +arg : null;
      return id != null && parts[2] === 'word' && parts[3] ? { name: 'practice', id, word: parts[3] } : { name: 'practice', id };
    }
    case 'words': return { name: 'words' };
    case 'stats': return { name: 'stats', section: arg || '' };
    case 'settings': return { name: 'settings' };
    case 'done': return { name: 'done' };
    default: return { name: 'today' };
  }
}
export function routeHash(r) {
  switch (r.name) {
    case 'library': return '#/library';
    case 'lesson': return '#/lesson/' + encodeURIComponent(r.key);
    case 'practice': return r.id != null ? '#/practice/' + r.id + (r.word ? '/word/' + encodeURIComponent(r.word) : '') : '#/practice';
    case 'words': return '#/words';
    case 'stats': return r.section ? '#/stats/' + r.section : '#/stats';
    case 'settings': return '#/settings';
    case 'done': return '#/done';
    default: return '#/today';
  }
}
// which top-level tab a route belongs to (practice has none: focus mode)
export const tabOf = r => ({ today: 'today', done: 'today', words: 'today', library: 'library', lesson: 'library', stats: 'stats', settings: 'settings' })[r.name] || null;
