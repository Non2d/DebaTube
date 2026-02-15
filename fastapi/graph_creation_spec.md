# グラフ作成ボタン 処理フロー仕様書

## 概要

音声ファイルから議論構造（ADU: Argumentative Discourse Unit）を抽出し、反論関係をグラフ化するまでの処理フローを定義する。

---

## 処理フロー

### Step 0: 音声ファイルの保存

| 項目 | 内容 |
|------|------|
| 保存先 | `audio-save/{round_id}/` |
| 音声形式 | WebM |
| メタデータ | 同名の JSON ファイル（主に `duration` を記録） |

---

### Step 1: 音声の文字起こし（Whisper）

| 項目 | 内容 |
|------|------|
| 出力先 | `app/transcriptions/results_{round_id}/batch_transcription_{timestamp}.json` |
| 処理単位 | スピーチごと |

#### 出力フォーマット

```json
{
  "Proposition_1st": {
    "date_transcribed": "2025-12-05_174239",
    "duration": 316.8,
    "language": "english",
    "text": "Full transcribed text...",
    "segments": null,
    "usage": {
      "seconds": 317.0,
      "type": "duration"
    },
    "words": [
      { "word": "First",  "start": 1.02, "end": 1.82 },
      { "word": "Second", "start": 1.82, "end": 2.50 }
    ],
    "task": "transcribe"
  },
  "Opposition_1st": {
    "date_transcribed": "2025-12-05_175243",
    "duration": 543.12,
    "language": "english"
  }
}
```

---

### Step 2: 文分割 → ADU グルーピング

#### 処理内容

1. **文分割**: ルールベースで文字起こしテキストを文単位に分割し、各文に `index` を付与
2. **ADU 生成**: タイムスタンプ付き文データを LLM に渡し、トピック単位（ADU）にグルーピング

#### ADU とは

複数の文をトピックごとにまとめたもの。

```
ADU 1: 文1 〜 文3（導入部分）
ADU 2: 文4 〜 文7（定義説明）
ADU 3: 文8 〜 文12（主張1）
```

#### 出力先

`app/transcriptions/results_{round_id}/adus/` にスピーチごとの CSV を保存

---

### Step 3: ADU データの統合

| 項目 | 内容 |
|------|------|
| 出力先 | `app/transcriptions/results_{round_id}/` |
| 形式 | 全スピーチを統合した単一の CSV |

#### CSV カラム構造

| カラム名 | 説明 |
|----------|------|
| `position` | スピーチ識別子（例: `Prop_1st`） |
| `id` | ADU の通し番号（全スピーチ共通で連番） |
| `start_sentence_index` | 開始文のインデックス |
| `end_sentence_index` | 終了文のインデックス |
| `text` | ADU のテキスト内容 |
| `role` | ADU の役割（introduction, claim など） |
| `start_time` | 開始タイムスタンプ |
| `end_time` | 終了タイムスタンプ |

---

### Step 4: LLM 用プロンプト生成（Markdown 形式）

CSV データを LLM の反論判定に適した Markdown 形式に変換する。

#### 出力フォーマット

```markdown
## Proposition_1st
id:1, I think that ~~~
id:2, Therefore, ~~~

## Opposition_1st
id:3, I deny ~~~
id:4, Furthermore, ~~~
```

---

### Step 5: 反論判定（LLM）

Step 4 で生成した Markdown を LLM に入力し、反論関係を判定する。

#### 出力フォーマット

```json
[
  [反論元ADUのid, 反論先ADUのid],
  [反論元ADUのid, 反論先ADUのid],
  ...
]
```

#### 例

```json
[[22, 16], [28, 16], [35, 22]]
```

- ADU 22 は ADU 16 に対する反論
- ADU 28 は ADU 16 に対する反論
- ADU 35 は ADU 22 に対する反論

---

### Step 6: 反論グラフ JSON の生成

Step 3 の ADU 情報と Step 5 の反論情報を統合し、最終的なグラフデータを生成する。

> **注意**: タイムスタンプは小数第1位に丸められる

#### 出力フォーマット

```json
{
  "speeches": {
    "Proposition_1st": [
      {
        "id": 1,
        "type": "introduction",
        "text": "First, some setup, ...",
        "start": 1.0
      },
      {
        "id": 2,
        "type": "definition",
        "text": "So what is environmental disaster?...",
        "start": 5.8
      }
    ],
    "Opposition_1st": [
      {
        "id": 10,
        "type": "rebuttal",
        "text": "We disagree with...",
        "start": 320.5
      }
    ]
  },
  "rebuttals": [
    [22, 16],
    [28, 16],
    [35, 22]
  ]
}
```

---

## ディレクトリ構造

```
audio-save/
└── {round_id}/
    ├── Proposition_1st.webm
    ├── Proposition_1st.json
    ├── Opposition_1st.webm
    └── Opposition_1st.json

app/transcriptions/
└── results_{round_id}/
    ├── batch_transcription_{timestamp}.json   # Step 1
    ├── adus/                                   # Step 2
    │   ├── Proposition_1st.csv
    │   └── Opposition_1st.csv
    ├── merged_adus.csv                         # Step 3
    ├── adus_prompt.md                          # Step 4
    └── rebuttal_graph.json                     # Step 6
```


## データベース構造
┌─────────────────────────────────────────────────────────────────┐
│  rounds                                                         │
│  - id (PK)                                                      │
│  - created_at                                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ 1:N
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  speeches                                                       │
│  - id (PK)                                                      │
│  - round_id (FK)                                                │
│  - position (Proposition_1st, Opposition_1st, ...)              │
│  - audio_path                                                   │
│  - duration                                                     │
│  - raw_transcription (JSON) ← Whisperの生出力をそのまま格納     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ 1:N
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  adus                                                           │
│  - id (PK) ← 全スピーチ通しの連番                                │
│  - speech_id (FK)                                               │
│  - start_sentence_index                                         │
│  - end_sentence_index                                           │
│  - text                                                         │
│  - role (introduction, definition, claim, ...)                  │
│  - start_time                                                   │
│  - end_time                                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ N:N (自己参照)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  rebuttals                                                      │
│  - id (PK)                                                      │
│  - src_adu_id (FK → adus.id) ← 反論している側（source）          │
│  - tgt_adu_id (FK → adus.id) ← 反論されている側（target）        │
└─────────────────────────────────────────────────────────────────┘

---

## 処理フロー図

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 0: 音声保存                                                    │
│  WebM + メタデータJSON                                               │
└─────────────────────┬───────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: Whisper 文字起こし                                          │
│  → batch_transcription_{timestamp}.json                             │
└─────────────────────┬───────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: 文分割 + ADU グルーピング（LLM）                             │
│  → adus/{speech}.csv                                                │
└─────────────────────┬───────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: ADU 統合                                                    │
│  → merged_adus.csv                                                  │
└─────────────────────┬───────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: Markdown 生成                                               │
│  → adus_prompt.md                                                   │
└─────────────────────┬───────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: 反論判定（LLM）                                             │
│  → [[from, to], ...]                                                │
└─────────────────────┬───────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 6: 反論グラフ JSON 生成                                        │
│  → rebuttal_graph.json                                              │
└─────────────────────────────────────────────────────────────────────┘
```
