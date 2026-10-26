// "📝 加入文章" dialog: paste / drop an article → split into sentences → edit the preview → save as a lesson.
import { $, esc } from './util.js';
import { splitSentences, mergeLines } from './sentences.js';

let lines = [];
const MAX_LINES = 1000;

function renderPreview() {
  $('addList').innerHTML = lines.map((s, k) => `<li data-k="${k}"><input class="ln" value="${esc(s)}" aria-label="第 ${k + 1} 句">
<button class="sm sec" data-act="up" title="跟上一句合併"${k ? '' : ' disabled'}>⤴ 併上句</button><button class="sm sec" data-act="down" title="跟下一句合併"${k < lines.length - 1 ? '' : ' disabled'}>⤵ 併下句</button><button class="sm sec" data-act="del" title="刪除這句">🗑</button></li>`).join('');
  $('addCount').textContent = lines.length ? `共 ${lines.length} 句` : '';
  $('addSave').disabled = !lines.some(s => s.trim());
  $('addSave').textContent = lines.length ? `💾 儲存 ${lines.filter(s => s.trim()).length} 句` : '💾 儲存';
}

function split() {
  lines = splitSentences($('addText').value).slice(0, MAX_LINES);
  $('addMsg').textContent = lines.length ? '' : '沒有找到英文句子';
  renderPreview();
}

async function readFiles(files) {
  const texts = [];
  for (const f of files) if (/\.(txt|md|markdown)$/i.test(f.name) || /^text\//.test(f.type)) texts.push(await f.text());
  if (!texts.length) { $('addMsg').textContent = '只支援 .txt / .md 檔'; return; }
  $('addText').value = texts.join('\n\n');
  if (!$('addLabel').value.trim() && files.length === 1) $('addLabel').value = files[0].name.replace(/\.[^.]+$/, '');
  $('addMsg').textContent = '';
  split();
}

export function renderAddLessons(lessons) {
  $('addLessons').innerHTML = lessons.length
    ? lessons.map(l => `<div class="al"><span>${esc(l.label)} <small>（${l.count} 句）</small></span><button class="sm sec" data-dellesson="${esc(l.label)}">🗑 刪除</button></div>`).join('')
    : '<small>還沒有加入的課程</small>';
}

// onSave({label, lines}) → Promise; onDeleteLesson(label) → Promise; onExport()
export function initAdd({ onSave, onDeleteLesson, onExport }) {
  const dlg = $('addDlg');
  $('addBtn').onclick = () => { $('addMsg').textContent = ''; dlg.showModal(); };
  $('addClose').onclick = () => dlg.close();
  $('addSplit').onclick = split;
  $('addFile').onchange = async e => { await readFiles([...e.target.files]); e.target.value = ''; };
  $('addExport').onclick = onExport;
  for (const ev of ['dragenter', 'dragover']) dlg.addEventListener(ev, e => { e.preventDefault(); $('addDrop').classList.add('over'); });
  for (const ev of ['dragleave', 'drop']) dlg.addEventListener(ev, () => $('addDrop').classList.remove('over'));
  dlg.addEventListener('drop', async e => { e.preventDefault(); await readFiles([...e.dataTransfer.files]); });
  $('addList').addEventListener('input', e => { const li = e.target.closest('li'); if (li && e.target.classList.contains('ln')) { lines[+li.dataset.k] = e.target.value; renderPreview2(); } });
  // typing must not rebuild the list (focus!) — only refresh counters
  function renderPreview2() { $('addSave').disabled = !lines.some(s => s.trim()); $('addSave').textContent = `💾 儲存 ${lines.filter(s => s.trim()).length} 句`; }
  $('addList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'), li = e.target.closest('li');
    if (!b || !li) return;
    const k = +li.dataset.k;
    if (b.dataset.act === 'del') lines.splice(k, 1);
    else if (b.dataset.act === 'up' && k > 0) lines.splice(k - 1, 2, mergeLines(lines[k - 1], lines[k]));
    else if (b.dataset.act === 'down' && k < lines.length - 1) lines.splice(k, 2, mergeLines(lines[k], lines[k + 1]));
    renderPreview();
  });
  $('addLessons').addEventListener('click', async e => {
    const b = e.target.closest('[data-dellesson]');
    if (b) await onDeleteLesson(b.dataset.dellesson);
  });
  $('addSave').onclick = async () => {
    const out = lines.map(s => s.trim()).filter(Boolean);
    if (!out.length) return;
    $('addSave').disabled = true;
    try {
      await onSave({ label: $('addLabel').value.trim(), lines: out });
      lines = []; $('addText').value = ''; $('addLabel').value = ''; renderPreview();
      dlg.close();
    } catch (err) {
      $('addMsg').textContent = '儲存失敗：' + err.message;
      $('addSave').disabled = false;
    }
  };
  renderPreview();
}
