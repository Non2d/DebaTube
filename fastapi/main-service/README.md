# FastAPI Main Service - Debate Analysis System

## 処理フロー（音声ファイル → 反論構造グラフ）

### 1. 音声ファイルのアップロードと文字起こし
**エンドポイント:** `POST /audio-to-transcript-batch` (audio2adu.py)

- **入力:** 複数の音声ファイル
  - ファイル名形式: `{speech_key}-{date}.webm` (例: `Proposition_1st-2025-11-16_140426.webm`)
- **処理:** OpenAI Whisper APIで非同期並列文字起こし
- **出力:** 各スピーチのトランスクリプトJSON
  ```json
  {
    "Proposition_1st": {
      "text": "...",
      "words": [{"word": "Our", "start": 0.0, "end": 0.2}, ...],
      "duration": 443.99,
      "language": "english",
      "date_transcribed": "2025-11-16_140426"
    },
    "Opposition_1st": {...}
  }
  ```
- **保存先:** `transcriptions/{speech_key}_{timestamp}.json`

### 2. ADU（Argument Discourse Unit）変換
**エンドポイント:** `POST /transcript-to-adu-batch` (audio2adu.py)

- **入力:** トランスクリプトJSON（ステップ1の出力）
- **パラメータ:** `debate_format` ("NA", "ASIAN", "BP")
- **処理:** Gemini 2.5 Proで各スピーチを並列処理してADUに分割
  - ADU役割: introduction, definition, independent_rebuttal, point_of_main_argument, point_of_comparison, poi
- **出力:**
  - 個別ADU CSVファイル: `adus/{speech_key}_{timestamp}.csv`
  - 統合CSVファイル: `adus/unified_adus_{format}_{timestamp}.csv`
  - 統合Markdownファイル: `adus/unified_adus_{format}_{timestamp}.md`
- **ログ保存先:** `logs/adu_conversion_{speech_key}_{timestamp}.json`

### 3. 反論構造の識別
**エンドポイント:** `POST /identify-rebuttal-structure` (audio2adu.py)

- **入力:** 統合CSVファイルのパス (例: `app/transcriptions/adus/unified_adus_NA_20251116_091737_9.csv`)
- **処理:** Gemini 2.5 Proで反論関係を分析
- **出力:** 反論構造グラフJSON
  ```json
  {
    "speeches": {
      "Proposition_1st": [
        {"id": 1, "type": "introduction", "text": "...", "start": 5.1},
        ...
      ],
      "Opposition_1st": [...]
    },
    "rebuttals": [[14, 4], [19, 12], ...]
  }
  ```
- **保存先:** `adus/rebuttal_graph_{timestamp}.json`

---

## ユーティリティAPI（sub_apis.py）

### 単一スピーチのADU変換
**エンドポイント:** `POST /transcript-to-adu`
- 単一のスピーチをADUに変換（デバッグ用）

### CSV/Markdown変換
- `POST /adu-jsonlog-to-csv` - ADU JSONログからCSV生成
- `POST /merge-aducsvs-to-unifiedcsv` - 既存のADU CSVファイルを統合
- `POST /unified-csv-to-md` - 統合CSVをMarkdownに変換

### その他
- `POST /group-sentences` - 単語レベルのタイムスタンプを文レベルに変換

---

## ディレクトリ構造

```
app/
├── transcriptions/           # 文字起こし結果
│   ├── {speech_key}_{timestamp}.json
│   └── adus/                # ADUデータ
│       ├── {speech_key}_{timestamp}.csv          # 個別ADU
│       ├── unified_adus_{format}_{timestamp}.csv # 統合ADU
│       ├── unified_adus_{format}_{timestamp}.md  # 統合Markdown
│       └── rebuttal_graph_{timestamp}.json       # 反論構造グラフ
└── logs/                    # 処理ログ
    └── adu_conversion_{speech_key}_{timestamp}.json
```

---

## 使用例

```bash
# 1. 音声ファイルをアップロード
curl -X POST "http://localhost:8000/audio-to-transcript-batch" \
  -F "files=@Proposition_1st-2025-11-16.webm" \
  -F "files=@Opposition_1st-2025-11-16.webm"

# 2. トランスクリプトをADUに変換
curl -X POST "http://localhost:8000/transcript-to-adu-batch?debate_format=NA" \
  -H "Content-Type: application/json" \
  -d @transcripts.json

# 3. 反論構造を識別
curl -X POST "http://localhost:8000/identify-rebuttal-structure" \
  -H "Content-Type: application/json" \
  -d '{"unified_csv_path": "app/transcriptions/adus/unified_adus_NA_20251116_091737_9.csv"}'
```