# Pronunciation Coach · 英文發音教練

A single-page, no-build web app for practicing English pronunciation sentence by sentence: listen, record, and get word- and phoneme-level feedback with Traditional Chinese coaching tips.

[English](#english) · [繁體中文](#繁體中文)

---

## English

### Features
- **Listen** (`🔊 聽`): Google Translate TTS (normal / `慢速` 0.7×) with fallback to browser voices; voice drop-down next to it.
- **Record & score (default)**: Web Speech API recognition (Chrome/Edge), word-level alignment with colored diff, number/unit/abbreviation normalization, score + tips. After each take, `▶ 播放我的錄音` replays your whole recording and `↺ 重錄` records it again without leaving the item.
- **Azure Pronunciation Assessment (optional)**: accuracy / fluency / completeness / prosody, per-phoneme IPA comparison. In the word cards, click a phoneme in the `標準` row to hear an example word then the word, or in the `你的` row to hear only your own slice of audio, with plain-language Chinese hints and letter↔sound mapping.
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
`app.js` (entry) + `js/`: `data.js` (load/validate items), `normalize.js` + `align.js` (text normalizer, alignment, tips), `phonemes.js` (IPA hints, Azure word → phoneme rows), `azure.js` (mic capture, WAV, REST call), `tts.js`, `playback.js` (segment playback), `progress.js` (localStorage progress, smart pick), `ui.js` (DOM).

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
