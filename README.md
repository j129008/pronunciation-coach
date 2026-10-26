# Pronunciation Coach · 英文發音教練

A single-page, no-build web app for practicing English pronunciation sentence by sentence: listen, record, and get word- and phoneme-level feedback with Traditional Chinese coaching tips.

[English](#english) · [繁體中文](#繁體中文)

---

## English

### Features
- **Listen** (`🔊 聽`): Google Translate TTS (normal / `慢速` 0.7×) with fallback to browser voices; voice drop-down next to it.
- **Record & score (default)**: Web Speech API recognition (Chrome/Edge), word-level alignment with colored diff, number/unit/abbreviation normalization, score + tips. After each take, `▶ 播放我的錄音` replays your whole recording and `↺ 重錄` records it again without leaving the item.
- **Azure Pronunciation Assessment (optional)**: accuracy / fluency / completeness / prosody, per-phoneme IPA comparison. In the word cards, click a phoneme in the `標準` row to hear an example word then the word, or in the `你的` row to hear only your own slice of audio (with 120 ms padding, slowed by `我的錄音速度` 0.5x / 0.6x (default) / 0.75x / 1x without changing pitch; `標準示範速度` sets the TTS speed), with plain-language Chinese hints and letter↔sound mapping.
- **“What did I actually say?”** (Azure mode): no IPA is shown in explanations. Each wrong sound gets a one-line verdict — `少唸了` (e.g. 「or」少了捲舌的 r，你只唸了「歐」，要唸成「歐兒」), `多唸了`, or `唸成別的音` (d 唸成了 t：太硬像「特」，要輕、喉嚨震動像「的」) — then a whole-word respelling (`uh-FAW-duh-bul` vs `uh-FOR-duh-bul`, capitals = the problem syllable), one mouth/tongue fix tip and two clickable minimal-pair words. Compound sounds (r-colored vowels, diphthongs, ch/j) where you produced only part are treated as 少唸了. The table covers common Mandarin-speaker confusions (t/d, s/z, f/v, v/w, o/aw, m/n and n/ng endings, th/s, th/d, l/n, r/l, i/ee, a/e, oo, …) with a generic fallback built from mouth-movement notes.
- **Hear your own sound clearly**: clicking a `你的` cell plays your whole word (slowed, padded) and lights up the mispronounced sound while it plays; `🔍 只聽這段（放慢）` plays just that sound with 250 ms of context each side at 0.5x. `🔈 聽起來像 → 正確` speaks the respelling of what you actually said (e.g. “ree”) and then the correct word (“we”): 電腦聽你唸成「ree」，正確是「we」.
- **A/B compare**: `⇄` buttons per word and per phoneme (and in the “🎯 你這句最需要改的音” list) play the standard word, a short pause, then your own slice; tick `循環播放 A/B` to loop, `■ 停止播放` to stop.
- **Learn IPA gradually**: explanations stay in plain language; after each one a small grey `音標：w → ɹ` row shows the symbols. Every IPA symbol anywhere (word-card table cells, that row, the item's own IPA line, the confusion table, the panel) has a tooltip card — hover on desktop, tap on phones — with the symbol, 注音/中文 approximation, 3 clickable example words, a one-line mouth/tongue tip and “常跟哪個音搞混”. `🔤 音標教學（慢慢學 IPA）` lists all English sounds (母音 / 雙母音 / 子音, voiced/voiceless pairs side by side); tap a card to hear its three words; sounds you often miss (from Azure runs and quiz mistakes) are marked 🔺 and sorted first. `🎯 小測驗` asks 10 questions: hear 3 words → pick the shared symbol, or symbol → pick the right 注音 description. Two checkboxes there switch `表格顯示音標` and `說明旁顯示音標小標籤` on/off (both default on; they apply to the next result).
- **Pre-class practice** (`📝 加入文章`): paste an English article (or drop a `.txt` / `.md` file), enter a `課程名稱／日期` label such as `L045 2026/10/28 Job interview`, press `✂ 拆成句子`, fix the preview (edit a line, `⤴ 併上句` / `⤵ 併下句` to merge, `🗑` to delete) and save. The splitter handles abbreviations (Mr., Dr., e.g., a.m./p.m., U.S., etc.), numbers like 3.5, initials, quotes, markdown and hard-wrapped lines. Sentences are added as type `sentence` with the label as lesson, in their own IndexedDB entry (ids from 1,000,001 up, shown as `#U1`…), so they are merged on top of `data/items.json` / the loaded file on every start and never overwrite it. The newest added lesson is pinned at the top of the sidebar as `📝 課前練習`, `▶ 下一題` picks from it first while it still has unpracticed/weak items, and the drop-down next to the button filters by lesson. `🗑` on a lesson header (or in the dialog's list) deletes the whole lesson and its progress. `⬇ 匯出加入的文章 JSON` (dialog or backup panel) exports only your added items. Lessons in the data file whose `l` label starts with `課前練習` (e.g. `課前練習 2026/10/28 Job interview`) are treated the same for display and picking — pinned as `📌` groups at the top (below your own added lessons), newest `YYYY/MM/DD` first, and preferred by `▶ 下一題` — but they belong to the file, so they have no delete button and are not part of the export.
- **Progress tracking**: per-item attempts / best / last / history, statuses (new / needs work / good / mastered / due for review), lesson-grouped sidebar, dashboard with streak, smart `▶ 下一題` (1 review : 2 new), weak-phoneme stats.
- Keyboard: `Space` record/stop, `N` next, `R` listen. `💾 備份 / 還原進度` exports / imports progress JSON.
- Responsive: on phones the item list becomes a drawer opened with `☰`.

### Run
```bash
python3 -m http.server 8000
# open http://localhost:8000/ in Chrome or Edge
```
Microphone access requires `localhost` or HTTPS. The app uses ES modules, so it must be served over HTTP (as above); opening `index.html` via `file://` does not work.

### Code layout
`app.js` (entry) + `js/`: `data.js` (load/validate items), `normalize.js` + `align.js` (text normalizer, alignment, tips), `phonemes.js` (IPA hints, Azure word → phoneme rows), `explain.js` (respelling, articulation diffs, minimal pairs), `ipa.js` + `ipaui.js` (IPA learning panel, tooltip cards, quiz), `sentences.js` + `lessons.js` + `addui.js` (article import, user lessons), `azure.js` (mic capture, WAV, REST call), `tts.js`, `playback.js` (segment playback), `progress.js` (localStorage progress, smart pick), `ui.js` (DOM).

### Tests
```bash
node --test "test/*.test.js"    # or: npm test   (Node 20+, no dependencies)
```
Tests use synthetic data only; the private `data/items.json` is never read.

### Practice data
On start the app fetches `data/items.json` (git-ignored). If it is missing, the “載入練習資料” screen lets you pick a JSON file (stored in this browser's IndexedDB) or press “試用範例資料” to use `data/sample.json`. Use `💾 備份 / 還原進度 → 📂 更換練習資料` to switch files later.

Schema: a JSON array (or `{"items": [...]}`) of objects:

| field | required | meaning |
|---|---|---|
| `e` | ✔ | English text to practice |
| `i` |   | unique numeric id (default: position) |
| `t` |   | type: `sentence` \| `vocab` \| `extra` (default `sentence`) |
| `z` |   | Chinese meaning |
| `x` |   | example sentence (for vocab) |
| `p` |   | IPA |
| `l` |   | lesson label(s), e.g. `"L012 (2026/03/01)"`; the first `L###` is used for grouping |

### Azure setup (optional, free tier)
1. Azure Portal → Create resource → **Speech** → pricing tier **Free F0** (5 audio hours/month).
2. Copy **Key 1** and **Region** (e.g. `eastasia`).
3. In the app open **⚙️ 進階：Azure 發音評估（音素級分數）**, paste the key and region, tick **啟用**, press **儲存**. The badge next to the record button then reads “Azure 評分中” (otherwise “預設模式”).

The key is stored **only in your browser's localStorage** and sent only to `*.stt.speech.microsoft.com`. Never commit keys; `.env`, `*.key`, `config.local.*` are git-ignored.

### Privacy
No backend. Practice data, progress and keys stay in your browser (localStorage / IndexedDB). Audio is sent to Google (Web Speech recognition in Chrome) or to Azure only when you record in that mode; TTS text is sent to Google Translate.

### License
MIT

---

## 繁體中文

### 功能
- **聽**（`🔊 聽`）：Google 翻譯語音（正常／勾選 `慢速` 為 0.7×），失敗時改用瀏覽器內建語音，旁邊的下拉選單可選語音。
- **錄音評分（預設）**：Web Speech API 語音辨識（Chrome/Edge），逐字對齊並以顏色標示錯誤，自動處理數字、單位、縮寫，給分數與中文建議，錄完後 `▶ 播放我的錄音` 可聽完整錄音，`↺ 重錄` 可在同一題重新錄。
- **Azure 發音評估（選用）**：準確度、流暢度、完整度、韻律，以及每個音素的比對。在單字卡中點 `標準` 列的音素會先播示範字再播該單字，點 `你的` 列的音素只播你唸的那一小段，附白話中文說明與字母對應。
- **「我到底唸成什麼？」**（Azure 模式）：說明裡完全不出現音標。每個錯誤音先給一句白話判定——`少唸了`（例：「or」少了捲舌的 r，你只唸了「歐」，要唸成「歐兒」）、`多唸了`、`唸成別的音`（例：d 唸成了 t：太硬像「特」，要輕、喉嚨震動像「的」）——再用英文字母拼出「整個字聽起來像」與正確讀法的對照（如 `uh-FAW-duh-bul` vs `uh-FOR-duh-bul`，大寫＝出問題的音節），最後給一個嘴型／舌頭的練習提示與兩組可點擊試聽的對比字。複合音（捲舌母音、雙母音、ch/j）只唸出一部分時視為「少唸了」。涵蓋華語使用者常見混淆，沒收錄的組合會用嘴型說明自動產生。
- **聽清楚自己的音**：點 `你的` 格會慢速播放你整個單字（前後留白），並在播到唸錯的音時把它標亮；`🔍 只聽這段（放慢）` 只播那個音，前後各多留 250 毫秒、0.5 倍速；`🔈 聽起來像 → 正確` 先唸出電腦聽到的拼法（如 ree）再唸正確單字（we）：電腦聽你唸成「ree」，正確是「we」。
- **A/B 對照**：單字與音素旁的 `⇄` 鈕（以及「🎯 你這句最需要改的音」清單）會先播標準單字、停一下、再播你的那一段；勾選 `循環播放 A/B` 可重複，`■ 停止播放` 停止。播放速度可用 `我的錄音速度`（0.5x／0.6x 預設／0.75x／1x，音高不變）與 `標準示範速度` 調整。
- **慢慢學音標**：說明文字仍是白話中文，後面多一行小小的灰色 `音標：w → ɹ`。畫面上每個音標符號（單字卡表格、這一行、題目自帶的音標、常錯音表格、教學面板）都有提示卡——電腦版滑過去、手機點一下——內容有符號、注音／中文近似、三個可點擊聽的示範字、一句嘴型／舌頭提示，以及「常跟哪個音搞混」。`🔤 音標教學（慢慢學 IPA）` 列出全部英文音（母音／雙母音／子音，清濁成對並排），點卡片會依序唸三個示範字；你常錯的音（來自 Azure 評分與小測驗答錯）會標 🔺 並排在每組最前面。`🎯 小測驗` 共 10 題：聽三個字選出共同的符號，或看符號選出正確的注音描述。面板內可開關 `表格顯示音標`、`說明旁顯示音標小標籤`（預設都開，下次結果起生效）。
- **課前練習**（`📝 加入文章`）：貼上英文文章（或拖入 `.txt` / `.md`），填 `課程名稱／日期`（例如 `L045 2026/10/28 Job interview`），按 `✂ 拆成句子`，在預覽裡改字、`⤴ 併上句`／`⤵ 併下句` 合併、`🗑` 刪除後儲存。拆句會處理縮寫（Mr.、Dr.、e.g.、a.m./p.m.、U.S.、etc.）、小數、人名縮寫、引號、markdown 與換行硬折行。句子以 `sentence` 類型加入，課程名稱就是標籤，另存在 IndexedDB（編號從 1,000,001 起，畫面顯示 `#U1`…），每次啟動都會疊在 `data/items.json`／已載入的資料之上，不會覆蓋原資料。最新加入的課程會固定在側欄最上面「📝 課前練習」，`▶ 下一題` 在它還有未練或要加強的句子時優先從那裡挑；按鈕旁的下拉選單可只看某個課程。課程標題上的 `🗑`（或對話框裡的清單）可刪掉整個課程與其練習紀錄；`⬇ 匯出加入的文章 JSON` 只匯出你加入的句子。資料檔中 `l` 標籤以 `課前練習` 開頭的課程（例如 `課前練習 2026/10/28 Job interview`）在顯示與挑題上比照處理——以 `📌` 群組固定在側欄最上方（在你自己加入的課程之下），依標籤中的 `YYYY/MM/DD` 新到舊排序，`▶ 下一題` 也會優先挑——但它們屬於資料檔，所以沒有刪除鈕，也不會被匯出。
- **進度追蹤**：每題練習次數、最高分、最近分數、歷史；狀態（未練／要加強／還不錯／已熟練／待複習）；依課程分組的側欄；儀表板與連續天數；智慧 `▶ 下一題`（1 題複習：2 題新題）；常錯音統計。
- 快捷鍵：`Space` 錄音／停止、`N` 下一題、`R` 聽。`💾 備份 / 還原進度` 可匯出／匯入進度 JSON。手機上題目清單會收進 `☰` 抽屜。

### 執行
```bash
python3 -m http.server 8000
# 用 Chrome 或 Edge 開 http://localhost:8000/
```
麥克風需要 `localhost` 或 HTTPS。程式使用 ES modules，必須透過 HTTP 開啟（不能直接雙擊 `index.html`）。

### 測試
```bash
node --test "test/*.test.js"    # 或 npm test（Node 20+，無需安裝套件）
```
測試只用合成資料，不會讀取私人的 `data/items.json`。

### 練習資料
啟動時讀取 `data/items.json`（已加入 .gitignore，不會上傳）。找不到時會出現「載入練習資料」畫面，可選一個 JSON 檔（存在瀏覽器的 IndexedDB），或按「試用範例資料」載入 `data/sample.json`；之後可在 `💾 備份 / 還原進度 → 📂 更換練習資料` 換檔。格式見上方表格（`e` 必填，其餘選填）。

### Azure 設定（選用，免費）
1. Azure 入口網站 → 建立資源 → **Speech（語音服務）** → 定價層選 **Free F0**（每月 5 小時）。
2. 複製 **金鑰 1** 與 **區域**（例如 `eastasia`）。
3. 在 App 開啟 **⚙️ 進階：Azure 發音評估（音素級分數）**，貼上金鑰與區域，勾選 **啟用** 並按 **儲存**；錄音鈕旁的標籤會顯示「Azure 評分中」（否則為「預設模式」）。

金鑰**只存在你自己瀏覽器的 localStorage**，只會送到 `*.stt.speech.microsoft.com`。請勿把金鑰提交到 git。

### 隱私
沒有後端伺服器。練習資料、進度、金鑰都只存在你的瀏覽器。只有在錄音時，音訊才會送到 Google（Chrome 語音辨識）或 Azure；朗讀文字會送到 Google 翻譯。

### 授權
MIT
