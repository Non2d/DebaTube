# バックエンド API 仕様書

**実装**: FastAPI + Python
**ホスト**: http://localhost:8080
**認証**: なし（開発環境）

---

## 概要

11 個のルーターで構成される 27 個のエンドポイント。主な機能：
- 音声ファイル保存・取得
- 6 ステップのパイプライン処理（音声 → 文字起こし → ADU → グラフ）
- バックグラウンド処理（YouTube ダウンロード、外部 GPU サーバー連携）
- データベース CRUD

---

## 音声ファイル操作

### POST /audio/save
音声ファイルをアップロード・保存

**リクエスト**:
```
Content-Type: multipart/form-data

Parameters:
  - round_name (string, required): 試合 ID
  - speech_index (int, required): スピーチ番号（0 = Prop 1st, 1 = Opp 1st, ...）
  - speech_name (string, required): スピーチ名（"Proposition_1st", "Opposition_1st"）
  - file (binary, required): WebM または MP3 ファイル
  - duration (float, optional): 秒単位の duration
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "message": "Audio saved successfully",
  "file_path": "audio-save/round-bp-final-2025/0_Proposition_1st_1.webm",
  "metadata_path": "audio-save/round-bp-final-2025/0_Proposition_1st_1.json"
}
```

**保存先**:
```
/app/audio-save/{round_name}/
  ├── {index}_{speech_name}_{sequence}.webm
  ├── {index}_{speech_name}_{sequence}.json  # メタデータ
  └── {index}_{speech_name}_{sequence}.mp3   # 変換後
```

**メタデータ JSON**:
```json
{
  "round_name": "round-bp-final-2025",
  "speech_index": 0,
  "speech_name": "Proposition_1st",
  "duration": 600.5,
  "sequence": 1,
  "created_at": "2025-12-25T15:30:00Z"
}
```

---

### GET /audio/match/{match_name}
試合の全音声ファイルを取得

**パラメータ**:
```
match_name (string, required): 試合 ID
```

**レスポンス** (200 OK):
```json
[
  {
    "filename": "0_Proposition_1st_1.webm",
    "size": 1048576,
    "duration": 600.5,
    "speech_index": 0,
    "speech_name": "Proposition_1st"
  },
  {
    "filename": "0_Proposition_1st_1.mp3",
    "size": 524288,
    "duration": 600.5,
    "speech_index": 0,
    "speech_name": "Proposition_1st"
  },
  ...
]
```

---

### GET /audio/file/{match_name}/{filename}
個別音声ファイルを取得（ダウンロード）

**パラメータ**:
```
match_name (string, required): 試合 ID
filename (string, required): ファイル名
```

**レスポンス** (200 OK):
```
Content-Type: audio/webm または audio/mpeg
Content-Disposition: attachment; filename="0_Proposition_1st_1.webm"

[バイナリ音声データ]
```

---

## パイプライン処理

### POST /audio-to-transcript-batch
複数の音声ファイルを文字起こし（Whisper API）

**リクエスト**:
```
Content-Type: multipart/form-data

Parameters:
  - round_name (string, required): 試合 ID
  - files (binary[], required): 複数の音声ファイル
  - transcription_model (string, optional): "whisper-1" (default) または "whisper-large-v3"
  - language (string, optional): "ja", "en" (default: auto)
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "results": [
    {
      "speech_index": 0,
      "speech_name": "Proposition_1st",
      "text": "Thank you...",
      "words": [
        {
          "word": "Thank",
          "start": 0.0,
          "end": 0.5,
          "confidence": 0.95
        },
        ...
      ]
    },
    ...
  ]
}
```

**外部 API**: OpenAI Whisper API

---

### POST /transcript-to-adu-batch
文字起こしテキストを ADU（議論単位）に分割

**リクエスト**:
```json
{
  "round_name": "round-bp-final-2025",
  "debate_format": "british_parliamentary",
  "motion": "That AI should regulate itself",
  "transcription_data": [
    {
      "speech_index": 0,
      "speech_name": "Proposition_1st",
      "text": "Thank you...",
      "words": [...]
    },
    ...
  ],
  "adu_model": "gemini-2.5-flash"
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "results": {
    "unified_adus_csv": "unified_adus_bp_2025-12-25T15-30-00.csv",
    "unified_adus_md": "unified_adus_bp_2025-12-25T15-30-00.md",
    "adus": [
      {
        "adu_id": 1,
        "speech_index": 0,
        "speech_name": "Proposition_1st",
        "role": "introduction",
        "text": "Thank you to the opposition...",
        "start_time": 0.0,
        "end_time": 30.5
      },
      {
        "adu_id": 2,
        "speech_index": 0,
        "speech_name": "Proposition_1st",
        "role": "point_of_main_argument",
        "text": "Our first argument is...",
        "start_time": 30.5,
        "end_time": 90.0
      },
      ...
    ]
  }
}
```

**外部 API**: Gemini 2.5/3 Flash（Google）

**ADU 役割**:
- `introduction`
- `definition`
- `independent_rebuttal`
- `point_of_main_argument`
- `point_of_comparison`
- `poi` (Point of Information)

---

### POST /identify-rebuttal-structure
ADU 間の反論関係を検出

**リクエスト**:
```json
{
  "round_name": "round-bp-final-2025",
  "debate_format": "british_parliamentary",
  "motion": "That AI should regulate itself",
  "unified_adus_md": "## Proposition 1st\nid:1, type:introduction, text:...",
  "rebuttal_model": "gemini-2.5-flash"
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "results": {
    "rebuttals": [
      [2, 4],   # ADU 2 (Prop main) rebuts ADU 4 (Opp main)
      [4, 2],
      [3, 1],
      ...
    ],
    "graph_json": "rebuttal_graph_2025-12-25T15-30-00.json"
  }
}
```

**外部 API**: Gemini 2.5/3 Flash

---

### POST /audio-to-debate-graph-batch
統合エンドポイント（Step 0-6 を一括処理）

**リクエスト**:
```
Content-Type: multipart/form-data

Parameters:
  - round_name (string, required): 試合 ID
  - debate_format (string, required): "british_parliamentary", "NA", "ASIAN", "WSDC", "HPDU"
  - motion (string, optional): 論題
  - files (binary[], required): 複数の音声ファイル
  - call_llm_all_at_once (boolean, optional): false = 順番に, true = 並行実行
  - use_latest_transcription (boolean, optional): 既存の文字起こしを利用
  - adu_model (string, optional): "gemini-2.5-flash" (default)
  - rebuttal_model (string, optional): "gemini-2.5-flash" (default)
  - transcription_model (string, optional): "whisper-1" (default)
  - manual_mode (boolean, optional): true = 中間結果を保存（手動編集対応）
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "message": "All processing completed successfully",
  "results": {
    "transcription_file": "transcriptions/results_round-bp-final-2025/batch_transcription_2025-12-25T15-30-00.json",
    "unified_adus_csv": "transcriptions/results_round-bp-final-2025/unified_adus_bp_2025-12-25T15-30-00.csv",
    "unified_adus_md": "transcriptions/results_round-bp-final-2025/unified_adus_bp_2025-12-25T15-30-00.md",
    "rebuttal_graph": "transcriptions/results_round-bp-final-2025/rebuttal_graph_2025-12-25T15-30-00.json",
    "processing_time": 45.23
  }
}
```

**レスポンスの rebuttal_graph フォーマット**:
```json
{
  "speeches": {
    "proposition_1st": [
      {
        "id": 1,
        "type": "introduction",
        "text": "Thank you...",
        "start": 0.0,
        "end": 30.5
      },
      {
        "id": 2,
        "type": "point_of_main_argument",
        "text": "Our first argument...",
        "start": 30.5,
        "end": 90.0
      },
      {
        "id": 8,
        "type": "poi",
        "text": "Quick clarification...",
        "start": 45.0
      }
    ],
    "opposition_1st": [
      {
        "id": 3,
        "type": "introduction",
        "text": "Thank you to the proposition...",
        "start": 0.0,
        "end": 40.0
      },
      ...
    ]
  },
  "rebuttals": [
    [2, 4],    # ADU 2 rebuts ADU 4
    [4, 2],    # ADU 4 rebuts ADU 2
    [3, 1]     # ADU 3 rebuts ADU 1
  ]
}
```

---

### GET /rebuttal-graph/{match_name}
保存されたグラフ JSON を取得

**パラメータ**:
```
match_name (string, required): 試合 ID
try_count (int, optional): 試行番号（default: 最新）
```

**レスポンス** (200 OK):
```json
{
  "speeches": {...},
  "rebuttals": [...]
}
```

**検索順序**:
1. `transcriptions/results_{match_name}/rebuttal_graph_*.json`（新形式）
2. `transcriptions/adus/rebuttal_graph_*.json`（旧形式・最新）

---

## バックグラウンド処理（YouTube/GPU サーバー）

### POST /download-audio/{round_id}
YouTube 動画をダウンロード＆分割（外部 GPU サーバーに送信）

**パラメータ**:
```
round_id (int, required): ラウンド ID
```

**リクエストボディ**:
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "output_format": "wav" (optional)
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "job_id": "job_12345",
  "message": "Download started on GPU server"
}
```

---

### POST /start-background-transcription
バックグラウンド文字起こし開始

**前提**: `/download-audio/{round_id}` が完了していること

**リクエストボディ**:
```json
{
  "round_id": 4,
  "url": "https://www.youtube.com/watch?v=...",
  "num_chunks": 8,
  "max_workers": 4,
  "is_forced": false
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "round_id": 4,
  "message": "Background transcription started"
}
```

---

### GET /transcription-status
バックグラウンド文字起こしのステータス確認

**パラメータ**:
```
round_id (int, required): ラウンド ID
```

**レスポンス** (200 OK):
```json
{
  "round_id": 4,
  "status": "IN_QUEUE",
  "progress": {
    "completed": 3,
    "total": 8,
    "percentage": 37.5
  },
  "estimated_time_remaining": 120  # 秒
}
```

**ステータス値**:
- `NOT_IN_QUEUE` - 登録されていない
- `IN_QUEUE` - 待機中
- `PROCESSING` - 処理中
- `DONE` - 完了
- `ERROR` - エラー

---

### GET /transcription-result
完了した文字起こし結果を取得・DB 保存

**パラメータ**:
```
round_id (int, required): ラウンド ID
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "round_id": 4,
  "transcription": {
    "text": "Full transcript...",
    "words": [...],
    "duration": 1800.5
  },
  "db_save_status": "success"
}
```

---

### GET /job-progress/{round_id}
パイプライン全体の進捗確認

**パラメータ**:
```
round_id (int, required): ラウンド ID
```

**レスポンス** (200 OK):
```json
{
  "round_id": 4,
  "step_1": "PROCESSING",
  "step_1a": "DONE",         # Download
  "step_1b": "PROCESSING",   # Transcription
  "step_1c": "NOT_IN_QUEUE",  # ADU
  "step_1d": "NOT_IN_QUEUE",  # Rebuttal
  "step_2": "NOT_IN_QUEUE",
  "step_3": "NOT_IN_QUEUE",
  "step_4": "NOT_IN_QUEUE"
}
```

---

### DELETE /delete-background-transcription
バックグラウンド処理データを削除

**リクエストボディ**:
```json
{
  "video_ids": ["id1", "id2", "id3"]
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "deleted_count": 3
}
```

---

## データベース CRUD

### GET /round/{id}
試合詳細取得

**レスポンス** (200 OK):
```json
{
  "id": 68,
  "name": "round-bp-final-2025",
  "created_at": "2025-12-25T15:30:00Z",
  "try_count": 1,
  "type": "record",
  "style": "british_parliamentary",
  "motion": "That AI should regulate itself",
  "note": "Finals of BP tournament",
  "owner_id": "user123",
  "video_id": null,
  "tags": "final,2025,important",
  "speeches": [
    {
      "id": 200,
      "position": "Proposition_1st",
      "audio_path": "audio-save/round-bp-final-2025/0_Proposition_1st_1.webm",
      "duration": 600.5,
      "first_sentence_id": 1,
      "last_sentence_id": 85
    },
    ...
  ],
  "adus_count": 42,
  "rebuttals_count": 23
}
```

---

### POST /round
新規試合作成

**リクエストボディ**:
```json
{
  "name": "round-bp-final-2025",
  "style": "british_parliamentary",
  "motion": "That AI should regulate itself",
  "note": "Finals",
  "owner_id": "user123",
  "type": "record"
}
```

**レスポンス** (201 Created):
```json
{
  "id": 69,
  "name": "round-bp-final-2025",
  "created_at": "2025-12-25T15:30:00Z",
  "try_count": 1,
  "type": "record",
  ...
}
```

---

### PUT /round/{id}
試合更新

**リクエストボディ**:
```json
{
  "motion": "Updated motion",
  "note": "Updated note",
  "tags": "updated,tag"
}
```

**レスポンス** (200 OK):
```json
{
  "id": 68,
  "name": "round-bp-final-2025",
  ...
}
```

---

### GET /speech/{id}
スピーチ詳細取得

**レスポンス** (200 OK):
```json
{
  "id": 200,
  "round_id": 68,
  "position": "Proposition_1st",
  "audio_path": "audio-save/round-bp-final-2025/0_Proposition_1st_1.webm",
  "duration": 600.5,
  "first_sentence_id": 1,
  "last_sentence_id": 85
}
```

---

### GET /adu/{id}
ADU 詳細取得

**レスポンス** (200 OK):
```json
{
  "id": 5,
  "speech_id": 200,
  "role": "point_of_main_argument",
  "text": "Our first argument is...",
  "start_time": 30.5,
  "end_time": 90.0,
  "first_sentence_id": 5,
  "last_sentence_id": 12
}
```

---

## 手動ワークフロー

### POST /manual/resume
パイプライン再開（中間から続行）

**リクエストボディ**:
```json
{
  "round_name": "round-bp-final-2025",
  "resume_from_step": 3,
  "debate_format": "british_parliamentary"
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "message": "Pipeline resumed from step 3"
}
```

---

### POST /manual/submit-adu
ADU を手動編集・提出

**リクエストボディ**:
```json
{
  "round_name": "round-bp-final-2025",
  "speech_index": 0,
  "adus": [
    {
      "sentence_start": 0,
      "sentence_end": 5,
      "role": "introduction",
      "text": "Thank you..."
    },
    {
      "sentence_start": 5,
      "sentence_end": 20,
      "role": "point_of_main_argument",
      "text": "Our first argument is..."
    }
  ]
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "message": "ADUs submitted successfully",
  "saved_adu_count": 2
}
```

---

### POST /manual/submit-rebuttal
反論を手動編集・提出

**リクエストボディ**:
```json
{
  "round_name": "round-bp-final-2025",
  "rebuttals": [
    [2, 4],
    [4, 2],
    [3, 1]
  ]
}
```

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "message": "Rebuttals submitted successfully",
  "saved_rebuttal_count": 3
}
```

---

### GET /manual/rebuttal-prompt/{round_name}
反論プロンプトを表示（LLM に送られたプロンプト）

**パラメータ**:
```
round_name (string, required): 試合 ID
try_count (int, optional): 試行番号
```

**レスポンス** (200 OK):
```json
{
  "prompt": "## Proposition 1st\nid:1, type:introduction, text:Thank you...\n\n## Opposition 1st\nid:3, type:introduction, text:Thank you to the proposition...\n\nPlease identify rebuttals...",
  "model_used": "gemini-2.5-flash"
}
```

---

## 自動処理エンドポイント

### POST /auto/diarization/{round_id}
話者識別（スピーカー判定）を自動実行

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "diarization_result": {
    "segments": [
      {
        "start": 0.0,
        "end": 30.0,
        "speaker": "speaker_0",
        "confidence": 0.95
      },
      ...
    ]
  }
}
```

---

### POST /auto/adus/{round_id}
ADU 自動抽出を実行

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "adus_created": 42
}
```

---

### POST /auto/rebuttals/{round_id}
反論自動検出を実行

**レスポンス** (200 OK):
```json
{
  "status": "success",
  "rebuttals_detected": 23
}
```

---

## ユーティリティ

### GET /external_videos
外部動画一覧取得

**レスポンス** (200 OK):
```json
[
  {
    "video_id": "dQw4w9WgXcQ",
    "title": "Sample Debate Video",
    "thumbnail_url": "https://...",
    "channel_title": "Debate Channel",
    "published_at": "2025-12-20T10:00:00Z"
  },
  ...
]
```

---

### GET /logs
ログファイルを取得

**レスポンス** (200 OK):
```
text/plain

[2025-12-25 15:30:00] INFO: Started processing round-bp-final-2025
[2025-12-25 15:30:05] DEBUG: Uploaded audio file...
[2025-12-25 15:31:00] INFO: Transcription completed
...
```

---

## エラーレスポンス

### 400 Bad Request
```json
{
  "status": "error",
  "error_code": "INVALID_REQUEST",
  "message": "Missing required parameter: round_name"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "error_code": "NOT_FOUND",
  "message": "Round with ID 999 not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "error_code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "details": "..."
}
```

---

**最終更新**: 2026-02-06
