# DebateVizSystem 現在のアーキテクチャ詳細

## 概要

**実装言語**: Python (FastAPI), TypeScript/React (Next.js)
**データベース**: MySQL 8.0
**ホスト**: Docker Compose（ローカル開発）/ クラウド（本番環境想定）

---

## バックエンド構成（FastAPI）

### ディレクトリ構造

```
fastapi/main-service/app/
├── routers/                    # エンドポイント（11ファイル）
│   ├── audio2adu.py           # ★メイン（3,229行） - 完全なパイプライン
│   ├── round.py               # CRUD（試合/スピーチ/ADU/反論）
│   ├── audio_save.py          # ファイル保存・取得
│   ├── job_progress.py        # ステータス追跡
│   ├── external_video.py      # 外部動画管理
│   ├── audio_download.py      # YouTube 音声ダウンロード
│   ├── proxy.py               # 外部 GPU 処理 プロキシ
│   ├── sub_apis.py            # ユーティリティ エンドポイント
│   ├── utils.py               # 共通関数
│   └── logs.py                # ログ取得
├── models/
│   ├── round.py               # SQLAlchemy ORM モデル
│   └── external_video.py
├── services/
│   ├── transcription_service.py # 外部 GPU サーバー 連携
│   └── ...
├── cruds/                      # CRUD 関数群
│   └── round.py
├── db.py                       # DB 接続設定
├── config.py                   # 環境変数
└── alembic/                    # マイグレーション管理
    ├── env.py
    └── versions/               # 15 個のマイグレーション
```

### エンドポイント一覧（主要 27 個）

#### 1. 音声処理パイプライン

| エンドポイント | メソッド | 機能 | 依存 |
|---------------|---------|------|------|
| `/audio/save` | POST | 音声ファイル保存 | ローカルファイルシステム |
| `/audio/match/{match_name}` | GET | 試合の全音声ファイル取得 | ファイルシステム |
| `/audio/file/{match_name}/{filename}` | GET | 個別音声ファイル取得 | ファイルシステム |
| `/audio-to-transcript-batch` | POST | 音声 → 文字起こし（バッチ） | Whisper API (OpenAI) |
| `/transcript-to-adu-batch` | POST | 文字起こし → ADU セグメント | Gemini API |
| `/identify-rebuttal-structure` | POST | ADU → 反論グラフ | Gemini API |
| `/audio-to-debate-graph-batch` | POST | 統合エンドポイント（全処理） | Whisper + Gemini |

#### 2. バックグラウンド処理（YouTube/GPU サーバー連携）

| エンドポイント | メソッド | 機能 | 依存 |
|---------------|---------|------|------|
| `/download-audio/{round_id}` | POST | YouTube 動画をダウンロード | yt-dlp, 外部 GPU サーバー |
| `/start-background-transcription` | POST | バックグラウンド文字起こし開始 | 外部 GPU サーバー |
| `/transcription-status` | GET | ステータス確認 | 外部 GPU サーバー |
| `/transcription-result` | GET | 完了結果取得 & DB 保存 | 外部 GPU サーバー |
| `/job-progress/{round_id}` | GET | パイプライン全体の進捗 | DB |
| `/job-progress-background/{round_id}` | GET | バックグラウンド進捗 | 外部 GPU サーバー |

#### 3. データベース CRUD（試合/スピーチ/ADU/反論）

| エンドポイント | メソッド | 機能 |
|---------------|---------|------|
| `/round/{id}` | GET | 試合詳細 |
| `/round` | POST | 新規試合作成 |
| `/round/{id}` | PUT | 試合更新 |
| `/speech/{id}` | GET | スピーチ詳細 |
| `/adu/{id}` | GET | ADU 詳細 |
| `/rebuttal-graph/{match_name}` | GET | グラフ JSON 取得 |

#### 4. 手動ワークフロー

| エンドポイント | メソッド | 機能 |
|---------------|---------|------|
| `/manual/resume` | POST | パイプライン再開 |
| `/manual/submit-adu` | POST | ADU 手動編集・送信 |
| `/manual/submit-rebuttal` | POST | 反論手動編集・送信 |
| `/manual/rebuttal-prompt/{round_name}` | GET | 反論プロンプト表示 |

#### 5. ユーティリティ

| エンドポイント | メソッド | 機能 |
|---------------|---------|------|
| `/auto/diarization/{round_id}` | POST | 話者識別（自動） |
| `/auto/adus/{round_id}` | POST | ADU 自動抽出 |
| `/auto/rebuttals/{round_id}` | POST | 反論自動検出 |

---

### パイプラインの流れ（6ステップ）

```
Step 0: 音声ファイルアップロード
  └─ POST /audio/save
  └─ ローカル: /app/audio-save/{match_name}/{index}_{speech}_{seq}.{ext}
  └─ メタデータ: JSON sidecar

Step 1: 文字起こし（Whisper API）
  └─ POST /audio-to-transcript-batch
  └─ 入力: 音声ファイルパス（複数可）
  └─ 出力: words テーブル（単語レベルのタイムスタンプ）
  └─ 外部API: OpenAI Whisper API（verbose JSON）

Step 2: 文を構成（ルールベース）
  └─ util: group_words_into_sentences()
  └─ ルール: . ! ? による分割、接続詞の処理、短文マージ
  └─ 出力: sentences テーブル

Step 3: ADU セグメント（LLM）
  └─ POST /transcript-to-adu-batch
  └─ 入力: sentence テーブル（全スピーチ統合）
  └─ LLM: Gemini 2.5/3 Flash
  └─ 役割: introduction, definition, independent_rebuttal, point_of_main_argument, point_of_comparison, poi
  └─ 出力: adus テーブル（CSV にもエクスポート）

Step 4: 統合 CSV（マージ）
  └─ util: merge_adu_csvs()
  └─ 入力: 各スピーチの ADU CSV
  └─ 出力: unified_adus_{timestamp}.csv

Step 5: Markdown フォーマット
  └─ LLM プロンプト作成用
  └─ 出力: unified_adus_{timestamp}.md

Step 6: 反論検出（LLM）
  └─ POST /identify-rebuttal-structure
  └─ 入力: Markdown ADU リスト
  └─ LLM: Gemini
  └─ 出力: rebuttals テーブル + rebuttal_graph_{timestamp}.json
```

### 統合エンドポイント

**`POST /audio-to-debate-graph-batch`** （全 6 ステップを一括）

**リクエストボディ**:
```json
{
  "round_name": "BP-2025-final",
  "debate_format": "british_parliamentary",
  "motion": "That AI should regulate itself",
  "files": [
    { "speech_index": 0, "speech_name": "Proposition_1st", "file": <binary> },
    { "speech_index": 1, "speech_name": "Opposition_1st", "file": <binary> }
  ],
  "call_llm_all_at_once": false,
  "adu_model": "gemini-2.5-flash",
  "rebuttal_model": "gemini-2.5-flash"
}
```

**レスポンス**:
```json
{
  "status": "success",
  "results": {
    "transcriptions": [...],
    "adus": [...],
    "rebuttal_graph": { "speeches": {...}, "rebuttals": [...] }
  }
}
```

### 外部 GPU サーバー連携

**目的**: Whisper の GPU 高速化

**プロトコル**: HTTP/JSON（`httpx.AsyncClient`）

**ステータスマッピング**:
```
外部API ← → バックエンド
404       NOT_IN_QUEUE    （登録なし）
PENDING   IN_QUEUE        （待機中）
PROCESSING PROCESSING     （処理中）
COMPLETED DONE            （完了）
```

**シーケンス**:
```
1. POST /download-audio/{round_id}
   → 外部 GPU サーバーへ動画 URL 送信
   → 返却: job_id

2. GET /job-progress-background/{round_id}
   → ステータスポーリング（DONE まで）

3. GET /transcription-result?round_id={id}
   → 結果取得 & DB 保存
```

---

## 依存関係（requirements.txt）

### フレームワーク・コア
```
fastapi>=0.95.0       # Web フレームワーク
uvicorn>=0.20.0       # ASGI サーバー
python-multipart      # ファイルアップロード
```

### データベース
```
sqlalchemy>=2.0       # ORM（async 対応）
aiomysql              # MySQL async ドライバー
pymysql               # MySQL sync ドライバー（Alembic）
mysql-connector-python
alembic               # マイグレーション管理
```

### 外部 API
```
openai>=0.27.0        # Whisper API（音声認識）
google-genai          # Gemini API（LLM）
groq                  # Groq Whisper（代替転写）
httpx                 # Async HTTP クライアント
```

### メディア処理
```
yt-dlp                # YouTube ダウンロード
youtube-transcript-api # YouTube 字幕取得
librosa               # 音声解析（オプション）
```

### ユーティリティ
```
python-dotenv         # 環境変数読み込み
pytz                  # タイムゾーン処理
cryptography          # セキュリティ
```

---

## ファイル保存構造

### 音声ファイル（`/app/audio-save/`）
```
audio-save/
├── round-bp-final-2025/
│   ├── 0_Proposition_1st_1.webm
│   ├── 0_Proposition_1st_1.json     # メタデータ
│   ├── 0_Proposition_1st_1.mp3      # 変換後
│   ├── 1_Opposition_1st_1.webm
│   └── ...
└── round-na-demo/
    ├── 0_Prop_1st_1.webm
    └── ...
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

### ADU/グラフファイル（`/app/transcriptions/`）

#### 新形式（推奨）
```
transcriptions/
└── results_round-bp-final-2025/
    ├── batch_transcription_2025-12-25T15-30-00.json
    ├── unified_adus_bp_2025-12-25T15-30-00.csv
    ├── unified_adus_bp_2025-12-25T15-30-00.md
    └── rebuttal_graph_2025-12-25T15-30-00.json
```

#### 旧形式（互換性維持）
```
transcriptions/
├── adus/
│   ├── 0_Proposition_1st_*.csv
│   ├── unified_adus_*.csv
│   ├── rebuttal_graph_*.json
│   └── ...
└── sub-transcripts/  # デバッグ用
```

### グラフ JSON フォーマット

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
        "text": "First argument...",
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
      { "id": 3, "type": "introduction", ... },
      { "id": 4, "type": "point_of_main_argument", ... },
      { "id": 9, "type": "poi", ... }
    ]
  },
  "rebuttals": [
    [2, 4],   # ADU 2 (prop main arg) rebuts ADU 4 (opp main arg)
    [4, 2],   # ADU 4 rebuts ADU 2
    [3, 1]    # ADU 3 (opp intro) rebuts ADU 1 (prop intro)
  ]
}
```

---

## データベススキーマ

### テーブル設計

#### `rounds` - 試合マスタ
```sql
CREATE TABLE `rounds` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `try_count` INT DEFAULT 1,                 -- 同名試合の試行番号
  `type` VARCHAR(50) NOT NULL DEFAULT 'record',  -- 'record' or 'external_video'
  `style` VARCHAR(50) NOT NULL,              -- 'british_parliamentary', 'NA', etc
  `motion` TEXT,                             -- 論題
  `note` TEXT,                               -- メモ
  `owner_id` VARCHAR(255),                   -- ユーザーID（多言語サポート用）
  `video_id` VARCHAR(255),                   -- YouTube ID（external_video の場合）
  `raw_transcription` JSON,                  -- Whisper の生結果
  `tags` VARCHAR(255),                       -- タグ（カンマ区切り）
  UNIQUE KEY `idx_rounds_name_try_count` (`name`, `try_count`),
  KEY `ix_rounds_name` (`name`),
  FOREIGN KEY (`video_id`) REFERENCES `external_videos` (`video_id`)
);
```

#### `speeches` - スピーチ（個別演説）
```sql
CREATE TABLE `speeches` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `round_id` INT NOT NULL,
  `position` VARCHAR(64) NOT NULL,       -- "Proposition_1st", "Opposition_1st", etc
  `audio_path` VARCHAR(512),             -- 音声ファイルパス
  `duration` FLOAT,                      -- 秒単位
  `raw_transcription` JSON,              -- Whisper 結果（単語レベル）
  `first_sentence_id` INT,               -- 最初の文
  `last_sentence_id` INT,                -- 最後の文
  FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`first_sentence_id`) REFERENCES `sentences` (`id`),
  FOREIGN KEY (`last_sentence_id`) REFERENCES `sentences` (`id`)
);
```

#### `words` - 単語（Whisper タイムスタンプ）
```sql
CREATE TABLE `words` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `text` VARCHAR(255) NOT NULL,
  `start_time` FLOAT NOT NULL,
  `end_time` FLOAT NOT NULL,
  `confidence` FLOAT,                    -- Whisper 信頼度
  `round_id` INT NOT NULL,
  FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE
);
```

#### `sentences` - 文（ルールベース分割）
```sql
CREATE TABLE `sentences` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `text` TEXT NOT NULL,
  `round_id` INT NOT NULL,
  `first_word_id` INT NOT NULL,         -- 最初の単語
  `last_word_id` INT NOT NULL,          -- 最後の単語
  FOREIGN KEY (`round_id`) REFERENCES `rounds` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`first_word_id`) REFERENCES `words` (`id`),
  FOREIGN KEY (`last_word_id`) REFERENCES `words` (`id`)
);
```

#### `adus` - 議論単位（LLM セグメント）
```sql
CREATE TABLE `adus` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `speech_id` INT NOT NULL,
  `first_sentence_id` INT NOT NULL,
  `last_sentence_id` INT NOT NULL,
  `text` TEXT NOT NULL,
  `role` VARCHAR(64) NOT NULL,           -- 'introduction', 'definition', 'point_of_main_argument', etc
  `start_time` FLOAT NOT NULL,           -- 非正規化（パフォーマンス）
  `end_time` FLOAT NOT NULL,
  FOREIGN KEY (`speech_id`) REFERENCES `speeches` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`first_sentence_id`) REFERENCES `sentences` (`id`),
  FOREIGN KEY (`last_sentence_id`) REFERENCES `sentences` (`id`)
);
```

#### `rebuttals` - 反論関係（多対多）
```sql
CREATE TABLE `rebuttals` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `src_adu_id` INT NOT NULL,            -- 反論している側
  `tgt_adu_id` INT NOT NULL,            -- 反論されている側
  FOREIGN KEY (`src_adu_id`) REFERENCES `adus` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`tgt_adu_id`) REFERENCES `adus` (`id`) ON DELETE CASCADE
);
```

#### `external_videos` - YouTube メタデータ
```sql
CREATE TABLE `external_videos` (
  `video_id` VARCHAR(255) PRIMARY KEY,
  `title` TEXT,
  `thumbnail_url` TEXT,
  `created_at` DATETIME,
  `description` TEXT,
  `published_at` DATETIME,
  `channel_id` VARCHAR(255),
  `channel_title` VARCHAR(255),
  `tags` JSON,                           -- タグ配列
  `category_id` VARCHAR(50),
  `yt_transcript` MEDIUMTEXT             -- YouTube 字幕（JSON）
);
```

### リレーションシップ図

```
rounds
  ├─ speeches
  │   ├─ adus
  │   │   └─ rebuttals (N:N)
  │   ├─ sentences
  │   │   └─ words
  │   └─ raw_transcription (JSON)
  │
  ├─ words
  ├─ sentences
  ├─ adus
  ├─ rebuttals
  │
  ├─ video_id → external_videos
  └─ raw_transcription (JSON)

external_videos
  └─ yt_transcript (JSON)
```

### カスケード削除ルール

```
DELETE FROM rounds WHERE id = X
  ↓ CASCADE
  ├─ DELETE FROM speeches WHERE round_id = X
  │    ↓ CASCADE
  │    └─ DELETE FROM adus WHERE speech_id = ... （через speeches）
  │         ↓ CASCADE
  │         └─ DELETE FROM rebuttals WHERE src/tgt_adu_id = ...
  ├─ DELETE FROM words WHERE round_id = X
  ├─ DELETE FROM sentences WHERE round_id = X
  └─ DELETE FROM adus WHERE speech_id IN (... speeches) （外部キー制約）
```

### データ規模（2025-12-29 時点）

| テーブル | 行数 |
|---------|-----|
| words | ~550,000 |
| sentences | ~27,000 |
| adus | ~8,000 |
| rounds | 68 |
| speeches | ~340 |
| rebuttals | ~5,000 |

---

## フロントエンド構成（Next.js）

### ページ構成

```
next/app/[lang]/
├── page.tsx                    # ルート（Explore へリダイレクト）
├── landing/page.tsx            # ランディング
├── explore/page.tsx            # グラフ閲覧ページ
├── dashboard/page.tsx          # 動画処理ダッシュボード
├── dashboard/new/page.tsx      # 新規ラウンド登録
├── dashboard/register/[id]/page.tsx # ラウンド編集
└── record/page.tsx             # ★メイン - 音声録音・グラフ生成
```

### Record ページの詳細構成

**ファイル**: `next/app/[lang]/record/page.tsx`

#### タブ構成

```
Record ページ
├─ Dashboard タブ
│   └─ 既存試合一覧（ローカルストレージから）
│
├─ Audio タブ （音声録音・グラフ生成）
│   ├─ 試合ID 入力フォーム
│   ├─ ディベート形式選択
│   ├─ 現在スピーチ表示
│   ├─ 録音ボタン（開始/停止）
│   ├─ グラフ生成ボタン（全音声揃った時のみ有効）
│   ├─ JSON ファイルアップロード
│   └─ グラフプレビュー（可視化）
│
└─ Visualization タブ （グラフ表示）
    ├─ ReactFlow キャンバス
    │   ├─ ノード表示（カスタムノード）
    │   ├─ エッジ表示（反論線）
    │   └─ ズーム/パン対応
    ├─ グラフノードクリック → 音声再生（統合タイムライン）
    └─ ノード ID 表示/非表示切り替え
```

### 音声録音実装（MediaRecorder API）

**ファイル**: `next/app/[lang]/record/hooks/useRecordings.ts`

```typescript
// MediaRecorder 初期化
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);

// チャンク収集
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) {
    chunks.push(e.data);
  }
};

// 停止時処理
mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  // localStorage 保存 & バックエンド送信
  await fetch('http://localhost:8080/audio/save', {
    method: 'POST',
    body: formData
  });
};
```

### グラフ可視化（ReactFlow）

**ファイル**: `next/app/[lang]/record/components/RebuttalGraph.tsx`

**特徴**:
- 複雑なロジック（300 行超）
- ローカル ID → グローバル ID 変換
- 討論形式による順序ソート（正規表現）
- POI（Point of Information）の特殊処理
- 同チーム反論フィルタリング

**カスタムノード**:
```typescript
govNode （政府側）    → 青色
oppNode （野党側）    → 赤色
backgroundNode（背景） → グレー
```

### 統合音声プレーヤー（UnifiedAudioPlayer）

**ファイル**: `next/app/[lang]/record/components/UnifiedAudioPlayer.tsx`

**機能**:
- 複数スピーチ音声を単一タイムラインで管理
- グラフノードクリック → 該当時刻から再生
- タイムライン計算：ローカル時刻 → グローバル時刻

**タイムライン管理ユーティリティ**:
- `next/app/[lang]/record/utils/speechTimeline.ts`
- `buildSpeechSegments()` - セグメント構築
- `localToGlobalTime()` - ローカル → グローバル変換
- `globalToLocalTime()` - グローバル → ローカル変換

**例**:
```
Prop1_1st: duration 300秒
  ├─ ADU 1: 0-30秒
  ├─ ADU 2: 30-90秒
  └─ POI: 45秒

Opp1_1st: duration 300秒
  ├─ ADU 3: 0-40秒
  ├─ ADU 4: 40-120秒
  └─ POI: 60秒

グローバルタイムライン: 0-600秒
- 0-300秒: Prop1_1st
- 300-600秒: Opp1_1st

グラフノード「ADU 4, start=40秒」をクリック
→ グローバル時刻 = 300 + 40 = 340秒
→ UnifiedAudioPlayer のシークバーが 340秒へジャンプ
```

### API 通信パターン

#### 音声系
```typescript
POST /audio/save
  body: FormData { round_name, speech_index, speech_name, file, duration }
  response: { status: 'success' }

GET /audio/match/{match_name}
  response: [{ filename, size, duration }, ...]

GET /rebuttal-graph/{match_name}?try_count={n}
  response: { speeches: {...}, rebuttals: [...] }
```

#### グラフ生成
```typescript
POST /audio-to-debate-graph-batch
  body: FormData { round_name, debate_format, files[], ... }
  response: { status: 'success', results: { ... } }
```

#### バックグラウンド処理
```typescript
POST /download-audio/{round_id}
GET /job-progress-background/{round_id}
GET /transcription-result?round_id={n}
```

### 状態管理

#### useState ベース（Record ページ）
```typescript
const [roundName, setRoundName] = useState('');
const [debateFormat, setDebateFormat] = useState('BP');
const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
const [speechRecordings, setSpeechRecordings] = useState({});
const [autoLoadedGraphData, setAutoLoadedGraphData] = useState(null);
```

#### localStorage 使用
```typescript
'debate_format'
'debate_round_name'
'record_active_tab'
'graph_show_node_ids'
'llmModel'
'transcriptionModel'
'dashboardExecuteMode'
```

#### Context 使用
```typescript
LanguageContext      // 多言語対応（en/ja）
ThemeProvider        // ダークモード（next-themes）
```

### カスタムフック

```
next/app/[lang]/record/hooks/
├── useRecordings.ts           # 音声録音・読み込み
├── useDebateGraph.ts          # グラフデータ管理
├── useGraphGeneration.ts      # グラフ生成・手動ワークフロー
└── useGraphNodeNavigation.ts  # グラフノードクリック処理
```

### UI 依存

#### Tailwind CSS
```typescript
// グローバルスタイル定義
next/tailwind.config.ts
next/app/globals.css

// CSS 変数ベースのテーマシステム
--primary, --secondary, --accent
--light-bg, --dark-bg
```

#### shadcn/ui コンポーネント（Radix UI ベース）
```
Button, Tabs, Dialog, Label, Textarea, Input
```

#### その他
```typescript
@xyflow/react         // グラフ可視化
lucide-react          // アイコン
react-hot-toast       // 通知
next-themes           // ダークモード
jotai                 // グローバル状態管理
```

---

## 複雑度分析

### Simple Components ✅
| 項目 | 説明 | 移行難易度 |
|------|------|---------|
| 音声ファイル保存 | HTTP フォーム送信、ファイル I/O | 低 |
| DB CRUD | ORM パターン（SQLAlchemy → GORM） | 低 |
| ログ・設定 | 環境変数、ログレベル管理 | 低 |

### Moderate Components ⚠️
| 項目 | 説明 | 移行難易度 |
|------|------|---------|
| バックグラウンド処理 | ステータス追跡、ポーリング | 中 |
| 外部サービス連携 | HTTP クライアント、レスポンス変換 | 中 |
| ユーティリティ関数 | 文分割、CSV マージ | 中 |

### Complex Components 🔴
| 項目 | 説明 | 移行難易度 |
|------|------|---------|
| LLM 統合 | プロンプト、レスポンス解析、ロギング | 高 |
| パイプライン調整 | 6 ステップの連携、トランザクション管理 | 高 |
| グラフ可視化 | ReactFlow のレイアウト、ID 変換ロジック | 高 |
| 統合音声再生 | 複数 Blob 切り替え、タイムライン計算 | 高 |

---

## 開発環境

### Docker Compose
```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ""
      MYSQL_DATABASE: debate
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  fastapi:
    build: ./fastapi/main-service
    environment:
      MYSQL_HOST: db
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    ports:
      - "8080:8000"
    depends_on:
      - db

  next:
    build: ./next
    ports:
      - "3000:3000"
    depends_on:
      - fastapi
```

---

**最終更新**: 2026-02-06
