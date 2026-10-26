export const DAY = 864e5;

export const $ = id => document.getElementById(id);

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function dkey(t) {
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function lsGet(k, def) {
  try { return JSON.parse(localStorage[k] || 'null') || def; } catch (e) { return def; }
}
