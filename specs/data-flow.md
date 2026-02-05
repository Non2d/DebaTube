# データフロー・パイプライン仕様書

**概要**: 音声から議論グラフへの 6 ステップのパイプライン処理フロー

---

## 全体パイプライン図

```
┌─────────────────────────────────────────────────────────────────┐
│ Record Page (Next.js)                                           │
│ ├─ 音声録音（MediaRecorder API）                               │
│ ├─ localStorage に Blob 保存                                  │
│ └─ API 送信                                                   │
└────────────────────────┬──────────────────────────────────────┘
                         │ FormData
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1-A: 音声ファイルアップロード                               │
│ POST /audio/save                                                │
│ └─ ローカル: /app/audio-save/{round_name}/{index}_{speech}.webm
│    (+ メタデータ JSON)                                         │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1-B/1-C: 文字起こし（Whisper API）                          │
│ POST /audio-to-transcript-batch                                │
│ ├─ 外部 API: OpenAI Whisper API                                │
│ ├─ 出力形式: verbose JSON（単語レベルのタイムスタンプ）           │
│ └─ DB保存: words テーブル（～550,000 行）．1-Cはこの保存を担当     │
└────────────────────────┬──────────────────────────────────────┘
                         │ Transcription JSON
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1-D: 文の構成（ルールベース）                                │
│ function: group_words_into_sentences()                          │
│ ├─ ルール:                                                     │
│ │  • . ! ? で分割                                             │
│ │  • 日本語句点で分割                                         │
│ │  • 長い文（>70 語）は分割警告                               │
│ │  • 短い文（<2 語）は前の文とマージ                         │
│ └─ DB保存: sentences テーブル（～27,000 行）                 │
└────────────────────────┬──────────────────────────────────────┘
                         │ Sentence List
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: 話者分離（LLM）                                  │
│ POST /transcript-to-adu-batch                                   │
│ ├─ 外部 API: Gemini 2.5/3 Flash                              │
│ ├─ 入力: Sentence リスト                                      │
│ ├─ 出力形式:                                                  │
│ │  • speeches                             │
│ ├─ DB保存: adus テーブル（～8,000 行）                       │
│ └─ ファイル: unified_adus_{timestamp}.csv + .md              │
└────────────────────────┬──────────────────────────────────────┘
                         │ Speeches
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: ADU セグメント（LLM）                                  │
│ POST /transcript-to-adu-batch                                   │
│ ├─ 外部 API: Gemini 2.5/3 Flash                              │
│ ├─ 入力: Speeches リスト                                      │
│ ├─ 出力形式:                                                  │
│ │  • introduction                                             │
│ │  • definition                                              │
│ │  • point_of_main_argument                                  │
│ │  • point_of_comparison                                     │
│ │  • independent_rebuttal                                    │
│ │  • poi (Point of Information)                              │
│ ├─ DB保存: adus テーブル（～8,000 行）                       │
│ └─ ファイル: unified_adus_{timestamp}.csv + .md              │
└────────────────────────┬──────────────────────────────────────┘
                         │ ADU List + Metadata
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: 反論検出（LLM）                                         │
│ POST /identify-rebuttal-structure                               │
│ ├─ 入力: Markdown フォーマットの ADU リスト                    │
│ │  ```markdown                                                │
│ │  ## Proposition 1st                                        │
│ │  id:1, type:introduction, text:Thank you...              │
│ │  id:2, type:point_of_main_argument, text:...             │
│ │                                                            │
│ │  ## Opposition 1st                                        │
│ │  id:3, type:introduction, text:Thank you...              │
│ │  ...                                                       │
│ │  ```                                                       │
│ ├─ 外部 API: Gemini 2.5/3 Flash                              │
│ ├─ 出力: 反論ペア配列 [[src_id, tgt_id], ...]              │
│ ├─ DB保存: rebuttals テーブル（～5,000 行）                 │
│ └─ JSON: rebuttal_graph_{timestamp}.json                     │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Visualization (グラフ可視化)                                    │
│ ├─ ReactFlow キャンバス                                       │
│ ├─ Node: ADU（青=政府、赤=野党）                              │
│ ├─ Edge: 反論関係（矢印）                                     │
│ └─ インタラクション:                                          │
│    • ノードクリック → 対応する音声 ADU の start_time から再生 │
│    • ズーム/パン                                             │
│    • ノード ID 表示/非表示切り替え                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 詳細ステップフロー

### Step 0: 音声ファイルアップロード

```
[フロントエンド]
  ├─ 音声録音（MediaRecorder API）
  │   └─ WebM 形式（ブラウザネイティブ）
  │   └─ Blob として メモリに保持
  │
  └─ POST /audio/save
       ├─ FormData: {
       │   "round_name": "round-bp-2025",
       │   "speech_index": 0,
       │   "speech_name": "Proposition_1st",
       │   "file": <Blob>,
       │   "duration": 600.5
       │ }
       │
       └─→ [バックエンド]
           ├─ FormData パース
           ├─ ファイル保存:
           │   /app/audio-save/{round_name}/
           │   └─ 0_Proposition_1st_1.webm
           │   └─ 0_Proposition_1st_1.json (メタデータ)
           │
           └─ レスポンス: {
                 "status": "success",
                 "file_path": "...",
                 "metadata_path": "..."
               }
```

**入出力ファイル**:
```
入力:
  - Blob (WebM audio)
  - duration: float

出力:
  - /app/audio-save/{round_name}/{index}_{speech}_{seq}.webm
  - /app/audio-save/{round_name}/{index}_{speech}_{seq}.json
```

---

### Step 1: 文字起こし（Whisper API）

```
[バックエンド FastAPI]
  ├─ 複数の音声ファイルを収集
  ├─ 並行処理（asyncio.gather）:
  │   for file in files:
  │     result = openai.Audio.transcriptions.create(
  │       file=file,
  │       model="whisper-1",
  │       response_format="verbose_json"
  │     )
  │
  └─→ [外部 API: Whisper]
       ├─ Speech Recognition
       ├─ 単語レベルのタイムスタンプ生成
       │
       └─ 返却: {
            "text": "Thank you to the opposition...",
            "words": [
              {
                "word": "Thank",
                "start": 0.0,
                "end": 0.5
              },
              {
                "word": "you",
                "start": 0.5,
                "end": 1.0
              },
              ...
            ]
          }

[バックエンド FastAPI]
  ├─ レスポンスを解析
  ├─ words テーブルに保存（一括挿入）
  │   INSERT INTO words (text, start_time, end_time, confidence, round_id)
  │   VALUES (...), (...), ...
  │
  └─ レスポンス: {
       "status": "success",
       "results": [
         {
           "speech_index": 0,
           "speech_name": "Proposition_1st",
           "text": "Thank you...",
           "words": [...]
         },
         ...
       ]
     }
```

**入出力**:
```
入力:
  - 音声ファイル (WebM)
  - モデル: whisper-1

外部 API:
  - OpenAI Whisper API

出力:
  - DB: words テーブル (~550,000 行)
  - JSON: 単語リスト
```

**コスト**: ~$0.001 per minute（OpenAI API）

---

### Step 2: 文の構成

```
[バックエンド FastAPI]
  ├─ words テーブルから単語を取得
  ├─ 関数: group_words_into_sentences()
  │
  └─→ アルゴリズム:
       ├─ 初期化: current_sentence = []
       ├─ ループ: for word in words
       │   ├─ word を current_sentence に追加
       │   ├─ if word.text.endswith(['.', '!', '?']):
       │   │   └─ current_sentence を文リストに追加
       │   │   └─ current_sentence = []
       │   │
       │   └─ ルール処理:
       │       ├─ 短い文（<2 語）: 前の文とマージ
       │       ├─ 長い文（>70 語）: 分割警告（スキップ）
       │       └─ 日本語: 句点で分割
       │
       └─ 結果: sentence_list = [
            {
              "text": "Thank you to the opposition.",
              "start": 0.0,
              "end": 30.5,
              "first_word_id": 1,
              "last_word_id": 10
            },
            ...
          ]

[バックエンド]
  ├─ sentences テーブルに保存
  │   INSERT INTO sentences (text, round_id, first_word_id, last_word_id)
  │   VALUES (...), (...), ...
  │
  └─ レスポンス: { "status": "success", "sentences_count": 85 }
```

**入出力**:
```
入力:
  - words テーブル

処理:
  - ルールベース分割
  - バリデーション

出力:
  - DB: sentences テーブル (~27,000 行)
  - sentences JSON
```

---

### Step 3: ADU セグメント（LLM）

```
[バックエンド FastAPI]
  ├─ sentences テーブルから全文を取得
  ├─ スピーチごとに句読点付き文リストを組み立て
  ├─ Gemini LLM へ送信:
  │
  └─→ API: google.generativeai
       ├─ プロンプト例:
       │  ```
       │  You are an expert in debate analysis.
       │  Analyze each sentence and classify it as one of:
       │  - introduction
       │  - definition
       │  - point_of_main_argument
       │  - point_of_comparison
       │  - independent_rebuttal
       │  - poi
       │
       │  Input:
       │  [0] Thank you to the opposition.
       │  [1] Our first argument is X.
       │  [2] We believe Y because Z.
       │  ...
       │
       │  Output JSON:
       │  [
       │    {"sentence_idx": 0, "role": "introduction"},
       │    {"sentence_idx": 1, "role": "point_of_main_argument"},
       │    ...
       │  ]
       │  ```
       │
       └─→ Gemini 2.5 Flash
            ├─ テキスト理解
            ├─ JSON 出力生成
            │
            └─ 返却: {
                 "adus": [
                   {
                     "first_sentence_idx": 0,
                     "last_sentence_idx": 0,
                     "role": "introduction"
                   },
                   {
                     "first_sentence_idx": 1,
                     "last_sentence_idx": 2,
                     "role": "point_of_main_argument"
                   },
                   ...
                 ]
               }

[バックエンド]
  ├─ LLM 出力を解析
  ├─ 各 ADU の text を句読点から構成
  ├─ start_time, end_time を計算（sentences から）
  ├─ adus テーブルに保存（speech_id ごと）
  │   INSERT INTO adus (speech_id, first_sentence_id, last_sentence_id,
  │                      text, role, start_time, end_time)
  │   VALUES (...), (...), ...
  │
  ├─ CSV エクスポート:
  │   unified_adus_{debate_format}_{timestamp}.csv
  │   ├─ adu_id, speech_index, speech_name, role, text, start_time, end_time
  │   └─ 保存先: /app/transcriptions/results_{match_name}/
  │
  └─ Markdown 生成:
      unified_adus_{debate_format}_{timestamp}.md
      ├─ ## Proposition 1st
      │  id:1, type:introduction, text:Thank you...
      │  id:2, type:point_of_main_argument, text:...
      │
      └─ ## Opposition 1st
         id:3, type:introduction, text:...
         ...
```

**入出力**:
```
入力:
  - sentences テーブル
  - debate_format (形式判定用)

外部 API:
  - Gemini 2.5 Flash

出力:
  - DB: adus テーブル (~8,000 行)
  - ファイル: unified_adus_{timestamp}.csv
  - ファイル: unified_adus_{timestamp}.md
```

**コスト**: ~$0.01-0.1 per round（Gemini API）

---

### Step 4: Markdown フォーマット（Step 3 内で実行）

Markdown ファイルを Step 5（反論検出）の LLM プロンプト入力として使用。

```markdown
## Proposition 1st
id:1, type:introduction, text:Thank you to the opposition.
id:2, type:point_of_main_argument, text:Our first argument is X.
id:3, type:point_of_main_argument, text:We believe Y because Z.

## Opposition 1st
id:4, type:introduction, text:Thank you to the proposition.
id:5, type:point_of_main_argument, text:We reject argument X because A.
id:6, type:point_of_main_argument, text:Our counter is B which shows C.

## Proposition 2nd
id:7, type:independent_rebuttal, text:The opposition's argument A fails...
...
```

---

### Step 5: 反論検出（LLM）

```
[バックエンド FastAPI]
  ├─ unified_adus_{timestamp}.md を作成済み
  ├─ Gemini LLM へ送信:
  │
  └─→ API: google.generativeai
       ├─ プロンプト例:
       │  ```
       │  Analyze the debate transcript and identify rebuttals.
       │  For each rebuttal relationship, return [src_adu_id, tgt_adu_id]
       │
       │  Input:
       │  ## Proposition 1st
       │  id:1, type:introduction, text:Thank you...
       │  id:2, type:point_of_main_argument, text:...
       │
       │  ## Opposition 1st
       │  id:4, type:introduction, text:...
       │  id:5, type:point_of_main_argument, text:...
       │  ...
       │
       │  Output JSON:
       │  {
       │    "rebuttals": [
       │      [2, 5],  # Prop 1st ADU 2 rebuts Opp 1st ADU 5
       │      [5, 2],  # Opp 1st ADU 5 rebuts Prop 1st ADU 2
       │      [4, 1],  # Opp 1st intro rebuts Prop 1st intro
       │      ...
       │    ]
       │  }
       │  ```
       │
       └─→ Gemini 2.5 Flash
            ├─ 反論関係の抽出
            ├─ JSON 配列生成
            │
            └─ 返却: {
                 "rebuttals": [[2, 5], [5, 2], ...]
               }

[バックエンド]
  ├─ LLM 出力を解析
  ├─ フィルタリング（フロントエンド実装と同期）:
  │   ├─ 同チーム内反論: 削除
  │   ├─ POI 反論: 削除（オプション）
  │   └─ 重複反論: 最新版のみ保持
  │
  ├─ rebuttals テーブルに保存:
  │   INSERT INTO rebuttals (src_adu_id, tgt_adu_id)
  │   VALUES (...), (...), ...
  │
  ├─ JSON グラフ生成:
  │   rebuttal_graph_{timestamp}.json
  │   ├─ 構造:
  │   │  {
  │   │    "speeches": {
  │   │      "proposition_1st": [
  │   │        { "id": 1, "type": "introduction", "text": "...", "start": 0.0, "end": 30.5 },
  │   │        { "id": 2, "type": "point_of_main_argument", "text": "...", "start": 30.5, "end": 90.0 },
  │   │        ...
  │   │      ],
  │   │      "opposition_1st": [
  │   │        { "id": 4, "type": "introduction", "text": "...", ... },
  │   │        ...
  │   │      ],
  │   │      ...
  │   │    },
  │   │    "rebuttals": [
  │   │      [2, 5],
  │   │      [5, 2],
  │   │      ...
  │   │    ]
  │   │  }
  │   │
  │   └─ 保存先: /app/transcriptions/results_{match_name}/
  │
  └─ レスポンス: {
       "status": "success",
       "results": {
         "rebuttals": [...],
         "graph_json": "rebuttal_graph_2025-12-25T15-30-00.json"
       }
     }
```

**入出力**:
```
入力:
  - Markdown フォーマットの ADU リスト

外部 API:
  - Gemini 2.5 Flash

出力:
  - DB: rebuttals テーブル (~5,000 行)
  - JSON: rebuttal_graph_{timestamp}.json
```

---

## 統合エンドポイント

### POST /audio-to-debate-graph-batch

Step 0-5 をまとめて実行する統合エンドポイント。

```
[フロントエンド]
  └─ POST /audio-to-debate-graph-batch
      ├─ FormData: {
      │   "round_name": "round-bp-2025",
      │   "debate_format": "british_parliamentary",
      │   "motion": "That AI should regulate itself",
      │   "files": [Blob, Blob, Blob, ...],  # 複数スピーチ
      │   "adu_model": "gemini-2.5-flash",
      │   "rebuttal_model": "gemini-2.5-flash",
      │   "call_llm_all_at_once": false  # 順番実行
      │ }
      │
      └─→ [バックエンド]
           ├─ Step 0: ファイル保存
           │   └─ /app/audio-save/{round_name}/
           │
           ├─ Step 1: Whisper API
           │   └─ DB: words テーブル
           │
           ├─ Step 2: 文の構成
           │   └─ DB: sentences テーブル
           │
           ├─ Step 3: ADU セグメント
           │   └─ DB: adus テーブル
           │   └─ ファイル: unified_adus_{timestamp}.csv, .md
           │
           ├─ Step 5: 反論検出
           │   └─ DB: rebuttals テーブル
           │   └─ ファイル: rebuttal_graph_{timestamp}.json
           │
           └─ レスポンス: {
                "status": "success",
                "results": {
                  "transcription_file": "...",
                  "unified_adus_csv": "...",
                  "unified_adus_md": "...",
                  "rebuttal_graph": "...",
                  "processing_time": 45.23
                }
              }

[フロントエンド]
  ├─ レスポンス受け取り
  ├─ グラフ JSON をロード
  └─ Visualization タブへ自動切り替え
```

---

## グラフデータの取得フロー

### GET /rebuttal-graph/{match_name}

フロントエンドでグラフ JSON を取得。

```
[フロントエンド]
  └─ GET /rebuttal-graph/round-bp-2025?try_count=1

[バックエンド]
  ├─ ファイル検索順序:
  │   1. /app/transcriptions/results_round-bp-2025/rebuttal_graph_*.json (新形式)
  │   2. /app/transcriptions/adus/rebuttal_graph_*.json (旧形式・最新)
  │
  └─ レスポンス: {
       "speeches": {...},
       "rebuttals": [...]
     }

[フロントエンド]
  ├─ GraphData 型に変換
  ├─ ReactFlow キャンバス描画
  │   ├─ speeches から ノードを生成
  │   ├─ rebuttals から エッジを生成
  │   └─ レイアウト計算
  │
  └─ 表示完了
```

---

## グラフノードクリック時の音声再生フロー

### Visualization タブ（Ctrl）

```
[ユーザー]
  └─ グラフ上のノード (ADU id=5) をクリック

[RebuttalGraph.tsx]
  ├─ onNodeClick コールバック発火
  ├─ ノード情報取得:
  │   ├─ nodeId: 5
  │   └─ speeches オブジェクトから ADU データを取得
  │       {
  │         "id": 5,
  │         "type": "point_of_main_argument",
  │         "text": "Our counter is B...",
  │         "start": 40.0  # ローカル時刻（Opp1 内）
  │       }
  │
  └─ handleGraphNodeClickUnified() 呼び出し

[record/page.tsx]
  ├─ ADU の start_time をローカル時刻として受け取り
  ├─ ADU から speech_index を逆引き（speeches オブジェクトから）
  │   └─ ADU id 5 → Opposition_1st (index=1)
  │
  ├─ globalToLocalTime() 計算:
  │   グローバル時刻 = Σ(前スピーチ duration) + ローカル時刻
  │   例: 300秒（Prop1） + 40秒（Opp1 内） = 340秒
  │
  ├─ UnifiedAudioPlayer のシークバーを 340秒にセット
  │   await player.seek(Duration(milliseconds: 340000))
  │
  └─ 再生開始
      await player.play()

[ユーザー]
  └─ Opp1 の 40秒地点から音声が再生される
```

**タイムライン例**:

```
スピーチセグメント:
┌─────────────────────────────────┐
│ Prop1 (0-300秒)                 │
│  ├─ ADU 1 (0-30秒)              │
│  ├─ ADU 2 (30-90秒)             │
│  └─ ADU 3 (90-300秒)            │
└─────────────────────────────────┘
  グローバル: 0-300秒

┌─────────────────────────────────┐
│ Opp1 (300-600秒)                │
│  ├─ ADU 4 (0-40秒)  ← ローカル   │
│  ├─ ADU 5 (40-100秒) ← クリック  │
│  └─ ADU 6 (100-300秒)           │
└─────────────────────────────────┘
  グローバル: 300-600秒

クリック時の計算:
  ADU 5 ローカル start = 40秒
  グローバル start = 300 + 40 = 340秒

シークバー位置:
  ├─────●───────────┤ (340秒地点へジャンプ)
```

---

## 並行処理パターン

### asyncio.gather（Python FastAPI）

複数の音声ファイルを並行処理。

```python
async def audio_to_transcript_batch(files: List[UploadFile]):
    tasks = []
    for file in files:
        task = transcribe_with_whisper(file)
        tasks.append(task)

    # すべてのファイルの処理を並行実行
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return results
```

**メリット**: I/O 待機時間を活用、処理時間短縮

### errgroup.Group（Go）

Go への移行後の並行処理パターン。

```go
eg := new(errgroup.Group)
results := make([]*TranscribeResult, len(files))

for i, file := range files {
    i, file := i, file
    eg.Go(func() error {
        result, err := TranscribeWithWhisper(ctx, file)
        if err != nil {
            return err
        }
        results[i] = result
        return nil
    })
}

if err := eg.Wait(); err != nil {
    return err
}
```

---

## エラーハンドリング

### Whisper API エラー

```
エラーケース:
  ├─ 音声ファイル破損
  │   └─ リトライ: max_retries = 3
  │
  ├─ API レート制限（429 Too Many Requests）
  │   └─ Exponential backoff: 1秒 → 2秒 → 4秒
  │
  ├─ API 過負荷（503 Service Unavailable）
  │   └─ リトライ: max_retries = 3
  │
  └─ タイムアウト（>10分）
      └─ キャンセル: 以降のステップはスキップ
```

### Gemini API エラー

```
エラーケース:
  ├─ API キー無効
  │   └─ エラー: "Invalid API key"
  │   └─ ユーザーへ: 管理者に連絡
  │
  ├─ コンテンツフィルタリング
  │   └─ 警告: "Content flagged by safety filter"
  │   └─ 手動編集で対応
  │
  └─ LLM 出力パース失敗
      └─ リトライ: 最大 3 回
      └─ 失敗時: 手動編集モード
```

---

## ファイル保存構造

### ディレクトリツリー

```
/app/
├── audio-save/                    # 元の音声ファイル
│   └── round-bp-final-2025/
│       ├── 0_Proposition_1st_1.webm
│       ├── 0_Proposition_1st_1.json
│       ├── 1_Opposition_1st_1.webm
│       ├── 1_Opposition_1st_1.json
│       └── ...
│
├── transcriptions/                # 処理結果（新形式推奨）
│   ├── results_round-bp-final-2025/
│   │   ├── batch_transcription_2025-12-25T15-30-00.json
│   │   ├── unified_adus_bp_2025-12-25T15-30-00.csv
│   │   ├── unified_adus_bp_2025-12-25T15-30-00.md
│   │   └── rebuttal_graph_2025-12-25T15-30-00.json
│   │
│   ├── adus/                      # 処理結果（旧形式・互換性）
│   │   ├── 0_Proposition_1st_*.csv
│   │   ├── unified_adus_*.csv
│   │   ├── unified_adus_*.md
│   │   ├── rebuttal_graph_*.json
│   │   └── ...
│   │
│   └── sub-transcripts/           # デバッグ用（中間結果）
│       └── ...
│
├── tmp-audio-save/                # YouTube ダウンロード用
│   └── {video_id}/
│       └── full_audio.m4a
│
├── gemini-logs/                   # LLM プロンプト・レスポンス
│   └── round_68_logs.json
│
└── logs/                          # アプリケーションログ
    └── app.log
```

---

**最終更新**: 2026-02-06
