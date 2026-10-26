# Pronunciation Coach · 發音教練

A single-page, no-build web app for practising English pronunciation sentence by sentence — built for Mandarin speakers preparing for English interviews. Listen, record, and get word- and phoneme-level feedback explained in plain Traditional Chinese.

[English](#english) · [繁體中文](#繁體中文)

---

## English

### The four tabs
| Tab | What it is |
|---|---|
| **今天** (Today) | One big **開始練習** button for a ~15-item session (10/15/20 in 設定): spaced-repetition reviews + the latest 課前/課後 lesson + sentences containing your weak words, interleaved. Progress bar, resume if you leave, and a finish screen (average, personal bests, what to retry). |
| **課程** (Library) | Lessons as cards, newest first, with topic, 課前/課後 badges, counts and “已熟練 %”. Inside a lesson: tabs 句子 / 單字 / 補充, status chips, **練這一課**. Instant search over English, Chinese, example sentences and labels. Filters are simple chips (全部 / 沒練過 / 要加強 / 待複習); 更多篩選 hides the rest (還不錯, 已熟練, type, 課前/課後/課堂). **加入文章** adds your own article. |
| **統計** | Streak, today, 14-day history, mastery bar, your most-missed sounds, weak words, the sentences to work on, and the **音標教學** panel + quiz. |
| **設定** | Session size, Azure key/region, demo voice, backup/restore, export your articles, switch data file. |

Practice itself is a focus-mode screen (no tabs): the sentence, `聽示範`, a big `開始錄音`, and after scoring collapsible sections ordered by importance — **分數 → 主要問題 → 逐音比對 → 音標教學**.

### How lessons are grouped
Labels are messy (`L162 (2026/10/22)`, several joined by `; `, `課前練習 L166 (2026/10/26) Company structure`, `課後複習 …`, `英文課 12 (…)`). An item belongs to the lesson of its **latest dated label** (not the first); topic = the text after the date; items with 課前/課後 labels get badges and feed the “latest 課前/課後 lesson” of the daily session. Your own articles stay separate (“我加入的”) and appear first.

### Scoring and practice features
- **Listen**: Google Translate TTS (normal / `慢速`) with a browser-voice fallback; **record & score**: Web Speech API (Chrome/Edge) with a coloured word diff and tips, or **Azure Pronunciation Assessment** (optional) for accuracy / fluency / completeness / prosody and per-phoneme results.
- **Plain-language explanations (no IPA required)**: each wrong sound gets 少唸了 / 多唸了 / 唸成別的音, a whole-word respelling (`uh-FAW-duh-bul` vs `uh-FOR-duh-bul`), one mouth/tongue tip and two clickable minimal-pair words; “聽起來像 → 正確” speaks what you were heard saying, then the correct word.
- **Hear yourself**: `播放我的錄音`, `重錄`; clicking your phoneme plays your whole word slowed (0.5x–1x, pitch kept) and highlights the wrong sound; `只聽這段（放慢）`; A/B compare (standard → pause → yours, loopable).
- **Learn IPA gradually**: every IPA symbol has a tooltip card (注音 approximation, example words, mouth tip, what it is confused with). The 音標教學 panel lists all sounds (missed ones first) and has a 10-question quiz. Switch symbol chips in tables/explanations on or off there.
- **Article import** (`加入文章`): paste text or drop `.txt`/`.md`, label it (e.g. `L045 2026/10/28 Job interview`), fix the split preview (edit / merge / delete), save. Stored in IndexedDB beside — never inside — your data file; exportable and deletable per lesson.
- Keyboard in practice: `Space` record/stop, `N` next, `R` listen.

### Run
```bash
python3 -m http.server 8000
# open http://localhost:8000/ in Chrome or Edge
```
Microphone access requires `localhost` or HTTPS. The app uses ES modules, so it must be served over HTTP (opening `index.html` via `file://` does not work). It is responsive: on phones the tabs become a bottom bar.

### Practice data
On start the app fetches `data/items.json` (git-ignored). If it is missing, the “載入練習資料” screen lets you pick a JSON file (kept in this browser's IndexedDB) or press “試用範例資料” (`data/sample.json`).

Schema: a JSON array (or `{"items": [...]}`) of objects:

| field | required | meaning |
|---|---|---|
| `e` | ✔ | English text to practise |
| `i` |   | unique numeric id (default: position) |
| `t` |   | `sentence` \| `vocab` \| `extra` (default `sentence`) |
| `z` |   | Chinese meaning |
| `x` |   | example sentence (for vocab) |
| `p` |   | IPA |
| `l` |   | lesson label(s); see “How lessons are grouped” |
| `o` |   | the learner's original wording (shown as a note) |

### Azure setup (optional, free tier)
1. Azure Portal → Create resource → **Speech** → pricing tier **Free F0**.
2. Copy **Key 1** and **Region** (e.g. `eastasia`).
3. In **設定 → 發音評分（Azure）** paste them, tick **啟用 Azure 評分**, press **儲存**. Practice then shows “Azure 評分中”.

Keys live **only in your browser's localStorage** and go only to `*.stt.speech.microsoft.com`. For a local convenience you may create an untracked `config.local.js` that seeds `localStorage` (it is git-ignored together with `.env`, `*.key`, `data/items.json`); never commit keys or practice data.

### Code layout
`app.js` (entry) + `js/`: `library.js` (lesson catalog from labels, search, filters), `session.js` (daily session), `router.js`, `state.js`, `ui.js` (shell: router, sessions, wiring), `views.js` (今天/課程/統計/完成), `practice.js` (practice screen, recording, results), `progress.js` (localStorage progress, spaced repetition, history), `data.js`, `lessons.js` + `sentences.js` + `addui.js` (article import), `normalize.js` + `align.js` (text alignment), `phonemes.js` + `explain.js` (phoneme analysis, plain explanations), `ipa.js` + `ipaui.js` (IPA learning), `azure.js`, `tts.js`, `playback.js`, `util.js`.

### Tests
```bash
node --test "test/*.test.js"    # or: npm test   (Node 20+, no dependencies)
```
Tests use synthetic data only; the private `data/items.json` is never read.

### Privacy
No backend. Practice data, progress and keys stay in your browser. Audio goes to Google (Web Speech in Chrome) or Azure only when you record in that mode; TTS text goes to Google Translate.

### License
MIT

---

## 繁體中文

### 四個分頁
| 分頁 | 內容 |
|---|---|
| **今天** | 一顆大大的 **開始練習**：約 15 題（可在設定改 10／15／20）——間隔複習到期的題目＋最新一次課前／課後練習＋含有你弱點字的句子，交錯出題。有進度條、中途離開可繼續，結束時顯示總結（平均分數、破紀錄、建議再練的題目）。 |
| **課程** | 課程卡片（新的在前）：課號、主題、課前／課後標記、題數、已熟練 %。點進課程有 句子／單字／補充 分頁、狀態篩選與 **練這一課**。上方搜尋框可即時搜尋英文、中文、例句與課程標籤；篩選只有 全部／沒練過／要加強／待複習 四個，其餘放在「更多篩選」。**加入文章** 可加入自己的文章。 |
| **統計** | 連續天數、今天練習數、近 14 天紀錄、掌握度、常錯的音、常錯的字、最需要加強的句子，以及 **音標教學** 與小測驗。 |
| **設定** | 每次題數、Azure 金鑰／區域、示範語音、備份／還原、匯出加入的文章、更換練習資料。 |

練習畫面是專注模式（沒有分頁列）：句子、`聽示範`、大大的 `開始錄音`；評分後的結果依重要性折疊成 **分數 → 主要問題 → 逐音比對 → 音標教學**。

### 課程怎麼分組
原始標籤很雜（`L162 (2026/10/22)`、用 `; ` 串起來的多個標籤、`課前練習 L166 (2026/10/26) Company structure`、`課後複習 …`、`英文課 12 (…)`）。每一題歸入**日期最新**那個標籤的課程（不是第一個）；主題＝日期後面的文字；有課前／課後標籤的題目會顯示標記，並成為每日練習中「最新課前／課後課程」的來源。你自己加入的文章另外放在「我加入的」，排在最前面。

### 評分與練習功能
- **聽**：Google 翻譯語音（正常／`慢速`），失敗時改用瀏覽器語音；**錄音評分**：Web Speech（Chrome/Edge）逐字比對與建議，或選用 **Azure 發音評估**（準確度、流暢度、完整度、韻律與逐音素結果）。
- **白話說明（不需要看懂音標）**：每個錯誤的音會標成 少唸了／多唸了／唸成別的音，附上整個字的拼法對照（`uh-FAW-duh-bul` vs `uh-FOR-duh-bul`）、一個嘴型／舌頭提示和兩組可點擊的對比字；「聽起來像 → 正確」會先唸出電腦聽到的版本再唸正確的字。
- **聽自己**：`播放我的錄音`、`重錄`；點「你的」音素會慢速播放整個字（0.5x–1x，音高不變）並標出唸錯的音；`只聽這段（放慢）`；A/B 對照（標準 → 停一下 → 你的，可循環）。
- **慢慢學音標**：每個音標都有提示卡（注音近似、示範字、嘴型、容易跟哪個音搞混）；音標教學面板列出全部英文音（常錯的排最前面）並有 10 題小測驗；也可在面板中開關表格與說明旁的音標標籤。
- **加入文章**：貼上文字或拖入 `.txt`／`.md`，填課程名稱（如 `L045 2026/10/28 Job interview`），在預覽修正拆句（改字、合併、刪除）後儲存。存在 IndexedDB，與練習資料分開；可匯出、可整課刪除。
- 練習中的快捷鍵：`Space` 錄音／停止，`N` 下一題，`R` 聽示範。

### 執行
```bash
python3 -m http.server 8000
# 用 Chrome 或 Edge 開 http://localhost:8000/
```
麥克風需要 `localhost` 或 HTTPS。程式使用 ES modules，必須透過 HTTP 開啟（不能直接雙擊 `index.html`）。手機上分頁列會變成底部導覽列。

### 練習資料
啟動時讀取 `data/items.json`（已加入 .gitignore，不會上傳）。找不到時會出現「載入練習資料」畫面，可選一個 JSON 檔（存在瀏覽器的 IndexedDB）或按「試用範例資料」。欄位格式見上方英文表格（`e` 必填，其餘選填）。

### Azure 設定（選用，免費）
1. Azure 入口網站 → 建立資源 → **Speech（語音服務）** → 定價層選 **Free F0**。
2. 複製 **金鑰 1** 與 **區域**（例如 `eastasia`）。
3. 在 **設定 → 發音評分（Azure）** 貼上並勾選 **啟用 Azure 評分**，按 **儲存**；練習畫面會顯示「Azure 評分中」。

金鑰**只存在你自己瀏覽器的 localStorage**，只會送到 `*.stt.speech.microsoft.com`。想在本機自動帶入設定，可自己建立不進版控的 `config.local.js`（與 `.env`、`*.key`、`data/items.json` 一樣已被 gitignore）；請勿把金鑰或練習資料提交到 git。

### 測試
```bash
node --test "test/*.test.js"    # 或 npm test（Node 20+，無需安裝套件）
```
測試只用合成資料，不會讀取私人的 `data/items.json`。

### 隱私
沒有後端伺服器。練習資料、進度、金鑰都只存在你的瀏覽器。只有在錄音時，音訊才會送到 Google（Chrome 語音辨識）或 Azure；朗讀文字會送到 Google 翻譯。

### 授權
MIT
