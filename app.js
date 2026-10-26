import { loadData, loadUserItems } from './js/data.js';
import { mergeUserItems } from './js/lessons.js';
import { startApp, showLoadScreen, hideLoadScreen } from './js/ui.js';

// user-added lessons are merged on top of whatever data set was loaded (data/items.json, saved file or sample)
loadData({ pick: showLoadScreen }).then(async items => { hideLoadScreen(); startApp(mergeUserItems(items, await loadUserItems())); });
