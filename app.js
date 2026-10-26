import { loadData } from './js/data.js';
import { startApp, showLoadScreen, hideLoadScreen } from './js/ui.js';

loadData({ pick: showLoadScreen }).then(items => { hideLoadScreen(); startApp(items); });
