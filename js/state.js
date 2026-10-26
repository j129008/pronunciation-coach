// Shared app state (items, lesson catalog, current practice context, library filters).
import * as P from './progress.js';
import { buildCatalog } from './library.js';

export const App = {
  items: [], base: [], user: [], byId: new Map(), catalog: { lessons: [], user: [], file: [], other: [], byKey: new Map() },
  session: null,                    // {ids, idx, why, scores, prevBest, lesson, started, date}
  ctx: null,                        // practice context: {ids, idx, returnTo, reasons}
  filters: { status: 'all', type: '', kind: '' },
  query: '', libLimit: 36, rowLimit: 100, tabs: {}, listIds: [], listReturn: '#/library',
  act: {},                          // actions provided by ui.js (openItem, startSession, …)
};

export function setItems(items) {
  App.items = items;
  App.base = items.filter(d => !d.u);
  App.user = items.filter(d => d.u);
  App.byId = new Map(items.map(d => [d.i, d]));
  App.catalog = buildCatalog(items);
}
export const status = id => P.statusOf(id);
export const lessonOf = d => App.catalog.byKey.get(d.lk);
export function lessonTitle(d) {
  const l = lessonOf(d);
  return l ? (l.user ? l.title : l.title + (l.topic ? ' ' + l.topic : '')) : '';
}
export const sessionSize = () => +localStorage.sessSize || 15;
