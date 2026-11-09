// 單字練習: practise the mispronounced words of a sentence one at a time — record just that word, get it
// assessed, retry until OK — in a panel on the practice screen, so the sentence stays in view.
// Route: #/practice/<id>/word/<word>. Recording goes through the shared recorder (重來 / 取消 work here too).
import { $, esc } from './util.js';
import * as WQ from './wordqueue.js';
import { wordFix } from './wordfix.js';
import { encodeWav, assess } from './azure.js';
import { analyzeWord } from './phonemes.js';
import { applyRef } from './stress.js';
import { speak } from './tts.js';

let deps = null;
let D = null; // {item, list:[{w,k}], idx, ok:boolean, tries}
let url = null, clip = null;

export const drillOpen = () => !!D;
const word = () => (D ? D.list[D.idx].w : '');

export function stopDrillAudio() { if (clip) { clip.pause(); clip = null; } }
function setClip(blob) {
  if (url) URL.revokeObjectURL(url);
  url = blob ? URL.createObjectURL(blob) : null;
  $('drillMine').hidden = !url;
}

const ui = {
  status: s => { $('drillStatus').innerHTML = '<small>' + s + '</small>'; },
  interim: t => { $('drillInterim').textContent = t; },
  state(s, ctx) {
    const on = s !== 'idle';
    $('drillRec').textContent = on ? (ctx.web || !deps.useAzure() ? '停止' : '停止並評分') : D && D.tries ? '再錄一次' : '錄這個字';
    $('drillRec').classList.toggle('on', on);
    $('drillRetry').hidden = !on;
    $('drillCancel').hidden = !on;
    $('drillMine').disabled = on;
    if (s === 'recording') ui.status(`只唸「${esc(ctx.word)}」這一個字，唸完按停止。唸錯了？按「重來」或 Esc，這次不會評分。`);
  },
};

function render() {
  const { item, list, idx } = D, w = word();
  $('drillCount').textContent = list.length > 1 ? `第 ${idx + 1} / ${list.length} 個字` : '';
  $('drillCtx').innerHTML = WQ.markWord(item.e, w).map(p => (p.hit ? `<mark>${esc(p.text)}</mark>` : esc(p.text))).join('');
  $('drillWord').textContent = w;
  $('drillRes').innerHTML = '';
  $('drillStatus').innerHTML = '';
  $('drillInterim').textContent = '';
  $('drillNext').textContent = idx + 1 < list.length ? '下一個字' : '完成';
  $('drillNext').classList.remove('primary');
  setClip(null);
  ui.state('idle', { word: w });
}

export function openDrill(item, w, list) {
  const k = WQ.wordKey(w);
  if (!item || !k) return;
  if (D && D.item === item && word() && WQ.wordKey(word()) === k) return; // already there
  if (deps.recorder.busy) deps.recorder.cancel();
  const l = list && list.length ? list : [{ w, k }];
  D = { item, list: l, idx: Math.max(0, l.findIndex(x => x.k === k)), ok: false, tries: 0 };
  $('drill').hidden = false;
  render();
  $('drill').scrollIntoView({ block: 'nearest' });
}
export function closeDrill() {
  if (!D) return;
  if (deps.recorder.busy && deps.recorder.ctx && deps.recorder.ctx.kind === 'word') deps.recorder.cancel();
  D = null;
  stopDrillAudio();
  setClip(null);
  $('drill').hidden = true;
}

function startWord() {
  if (!D || deps.recorder.busy) return;
  deps.prepareToRecord();
  deps.recorder.start({ kind: 'word', item: D.item, word: word(), ui });
}
export function drillRecKey() {
  const r = deps.recorder;
  if (r.busy) { if (r.ctx.kind === 'word') r.finish(); return; }
  startWord();
}

function showVerdict(ok, html) {
  D.ok = ok;
  D.tries++;
  $('drillRes').innerHTML = (ok ? '<div class="drill-ok">✓ OK！這個字唸對了</div>' : '<div class="drill-no">還不夠準，再錄一次</div>') + html;
  $('drillNext').classList.toggle('primary', ok);
  ui.state('idle', { word: word() });
  if (ok) WQ.saveQueue(WQ.removeWord(WQ.loadQueue(), D.item.i, word()));
}
const fixHtml = w => {
  const f = wordFix(w);
  return '<div class="fix drillfix"><div class="fixword">' + f.segments.map(g => !g.bad ? esc(g.text)
    : `<span class="fl${g.text ? '' : ' gap'}">${g.text ? esc(g.text) : '‸'}<small>${esc(g.sound)}</small></span>`).join('') + '</div>' +
    f.regions.map(r => `<div class="fixreg"><div class="fixsay">${esc(r.sentence)}</div><div class="fixhow">👉 ${esc(r.howto)}</div></div>`).join('') + '</div>';
};

export async function drillTake(res, ctx) {
  if (!D || ctx.item !== D.item || WQ.wordKey(ctx.word) !== WQ.wordKey(word())) return;
  const target = word();
  if (res.mode === 'web') {
    if (res.blob) setClip(res.blob);
    const alts = res.finals.flat();
    if (!alts.length) { ui.status('沒有聽到聲音，請再試一次。'); return; }
    const j = WQ.judgeSpeechWord(alts, target);
    ui.status('');
    showVerdict(j.ok, j.ok ? '' : `<div class="fixsay">電腦聽成「${esc(j.heard)}」</div><div class="fixhow">👉 先按「聽這個字」，跟著慢慢唸一次再錄</div>`);
    return;
  }
  const wav = encodeWav(res.data, res.rate);
  setClip(wav);
  if (res.peak < 0.01) { ui.status('麥克風幾乎沒有聲音，請確認麥克風設定後再錄一次。'); return; }
  ui.status('評分中…');
  try {
    const r = await assess(wav, target, { key: localStorage.azKey, region: localStorage.azRegion });
    if (!D || WQ.wordKey(word()) !== WQ.wordKey(target)) return;
    if (!r.ok) { ui.status(esc(r.message)); return; }
    const words = (r.json.NBest[0].Words || []).map(analyzeWord).map(w => applyRef(w, deps.refIpa(w.word)));
    const j = WQ.judgeAzureWord(words, target);
    ui.status(`這次 ${j.score} 分（${WQ.PASS} 分以上且沒有唸錯的音＝OK）`);
    showVerdict(j.ok, j.w && j.w.et !== 'Omission' && !j.ok ? fixHtml(j.w) : j.ok ? '' : '<div class="fixsay">沒有聽到這個字，請再唸一次</div>');
  } catch (e) {
    ui.status('Azure 錯誤：' + esc(e.message) + ' → 改用預設模式，請再錄一次');
    deps.recorder.start({ ...ctx, web: true });
  }
}

export function initDrill(d) {
  deps = d;
  $('drillRec').onclick = drillRecKey;
  $('drillRetry').onclick = () => { if (deps.recorder.busy) { deps.prepareToRecord(); deps.recorder.restart(); ui.status('已丟掉這次錄音，重新開始…'); } };
  $('drillCancel').onclick = () => { if (deps.recorder.busy) { deps.recorder.cancel(); ui.status('已取消，這次不會評分。'); } };
  $('drillListen').onclick = () => { if (D) { stopDrillAudio(); speak(word(), deps.stdRate()); } };
  $('drillMine').onclick = () => { if (!url) return; stopDrillAudio(); clip = new Audio(url); clip.play().catch(() => {}); };
  $('drillClose').onclick = () => { if (D) deps.close(D.item); };
  const advance = () => {
    if (!D) return;
    const { item, list, idx } = D;
    if (deps.next(item, word())) return; // the shell moved on (要練的字 run)
    if (idx + 1 < list.length) deps.go(item, list[idx + 1].w);
    else deps.close(item);
  };
  $('drillNext').onclick = advance;
}
