# データベーススキーマ仕様書

**DBMS**: MySQL 8.0（現在）→ PostgreSQL 15（移行予定）
**ORM**: SQLAlchemy（Python）+ Alembic（マイグレーション）

---

## テーブル定義

### 1. rounds - 試合マスタテーブル

**目的**: 討論試合の基本情報を管理

```sql
CREATE TABLE `rounds` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `try_count` INT NOT NULL DEFAULT 1,
  `type` VARCHAR(50) NOT NULL DEFAULT 'record',
  `style` VARCHAR(50) NOT NULL,
  `motion` TEXT,
  `note` TEXT,
  `owner_id` VARCHAR(255) DEFAULT NULL,
  `video_id` VARCHAR(255) DEFAULT NULL,
  `raw_transcription` JSON DEFAULT NULL,
  `tags` VARCHAR(255) DEFAULT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_rounds_name_try_count` (`name`, `try_count`),
  KEY `ix_rounds_id` (`id`),
  KEY `ix_rounds_name` (`name`),
  KEY `video_id` (`video_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `id` | INT | 主キー | 68 |
| `name` | VARCHAR(255) | 試合 ID（ユーザー入力） | "round-bp-final-2025" |
| `created_at` | DATETIME | 作成日時 | 2025-12-25 15:30:00 |
| `try_count` | INT | 同名試合の試行番号 | 1, 2, 3... |
| `type` | VARCHAR(50) | "record" = 手動録音、"external_video" = YouTube | "record" |
| `style` | VARCHAR(50) | ディベート形式 | "british_parliamentary" |
| `motion` | TEXT | 論題 | "That AI should regulate itself" |
| `note` | TEXT | メモ | "Finals of BP tournament" |
| `owner_id` | VARCHAR(255) | ユーザーID（多言語対応用） | "user123" |
| `video_id` | VARCHAR(255) | YouTube ID（external_video の場合） | "dQw4w9WgXcQ" |
| `raw_transcription` | JSON | Whisper API の生結果 | `{"text": "...", "words": [...]}` |
| `tags` | VARCHAR(255) | タグ（カンマ区切り） | "final,2025,important" |

**制約**:
- **UNIQUE**: (name, try_count) の組み合わせは一意
  - 同じ試合名で複数回実行可能（try_count で区別）
  - 例: "my-round" (try_count=1), "my-round" (try_count=2)
- **外部キー**: video_id → external_videos.video_id（参照のみ、制約なし）

---

### 2. speeches - スピーチテーブル

**目的**: 各試合内のスピーチ（演説）情報を管理

```sql
CREATE TABLE `speeches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `round_id` INT NOT NULL,
  `position` VARCHAR(64) NOT NULL,
  `audio_path` VARCHAR(512) DEFAULT NULL,
  `duration` FLOAT DEFAULT NULL,
  `raw_transcription` JSON DEFAULT NULL,
  `first_sentence_id` INT DEFAULT NULL,
  `last_sentence_id` INT DEFAULT NULL,

  PRIMARY KEY (`id`),
  KEY `ix_speeches_id` (`id`),
  KEY `fk_speeches_round_id` (`round_id`),
  KEY `first_sentence_id` (`first_sentence_id`),
  KEY `last_sentence_id` (`last_sentence_id`),

  CONSTRAINT `speeches_ibfk_1` FOREIGN KEY (`round_id`)
    REFERENCES `rounds` (`id`) ON DELETE CASCADE,
  CONSTRAINT `speeches_ibfk_2` FOREIGN KEY (`first_sentence_id`)
    REFERENCES `sentences` (`id`),
  CONSTRAINT `speeches_ibfk_3` FOREIGN KEY (`last_sentence_id`)
    REFERENCES `sentences` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INT | 主キー |
| `round_id` | INT | rounds テーブルへの外部キー |
| `position` | VARCHAR(64) | スピーチ位置（例: "Proposition_1st", "Opposition_1st"） |
| `audio_path` | VARCHAR(512) | 音声ファイルパス（ローカルまたは URL） |
| `duration` | FLOAT | スピーチ長（秒） |
| `raw_transcription` | JSON | Whisper の単語レベルのタイムスタンプ付き結果 |
| `first_sentence_id` | INT | 最初の文の ID（sentences テーブル参照） |
| `last_sentence_id` | INT | 最後の文の ID（sentences テーブル参照） |

**制約**:
- **ON DELETE CASCADE**: 試合が削除されたら、関連スピーチも削除

---

### 3. words - 単語テーブル

**目的**: Whisper が出力する単語レベルのタイムスタンプを保存

```sql
CREATE TABLE `words` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `text` VARCHAR(255) NOT NULL,
  `start_time` FLOAT NOT NULL,
  `end_time` FLOAT NOT NULL,
  `confidence` FLOAT DEFAULT NULL,
  `round_id` INT NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ix_words_id` (`id`),
  KEY `ix_words_round_id` (`round_id`),

  CONSTRAINT `words_ibfk_2` FOREIGN KEY (`round_id`)
    REFERENCES `rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `id` | INT | 主キー | 550000+ |
| `text` | VARCHAR(255) | 単語テキスト | "Thank" |
| `start_time` | FLOAT | 開始時刻（秒） | 0.0 |
| `end_time` | FLOAT | 終了時刻（秒） | 0.5 |
| `confidence` | FLOAT | Whisper 信頼度（0.0-1.0） | 0.95 |
| `round_id` | INT | rounds テーブルへの外部キー | 68 |

**特徴**:
- round_id で直接紐付け（speech_id は使用しない）
- データ規模が大きい（550,000+ 行）
- インデックス: round_id（クエリ高速化）

---

### 4. sentences - 文テーブル

**目的**: ルールベースで分割された文を管理

```sql
CREATE TABLE `sentences` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `text` TEXT NOT NULL,
  `round_id` INT NOT NULL,
  `first_word_id` INT NOT NULL,
  `last_word_id` INT NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ix_sentences_id` (`id`),
  KEY `ix_sentences_round_id` (`round_id`),
  KEY `first_word_id` (`first_word_id`),
  KEY `last_word_id` (`last_word_id`),

  CONSTRAINT `sentences_ibfk_1` FOREIGN KEY (`first_word_id`)
    REFERENCES `words` (`id`),
  CONSTRAINT `sentences_ibfk_2` FOREIGN KEY (`last_word_id`)
    REFERENCES `words` (`id`),
  CONSTRAINT `sentences_ibfk_3` FOREIGN KEY (`round_id`)
    REFERENCES `rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | INT | 主キー |
| `text` | TEXT | 文テキスト（words.text の連結） |
| `round_id` | INT | rounds テーブルへの外部キー |
| `first_word_id` | INT | words テーブルの最初の単語 ID |
| `last_word_id` | INT | words テーブルの最後の単語 ID |

**分割ルール**:
- `.!?` で分割
- 日本語は句点で分割
- 長い文（>70 語）は分割警告
- 短い文（<2 語）は前の文とマージ

**データ規模**: ~27,000 行

---

### 5. adus - ADU（議論単位）テーブル

**目的**: LLM が抽出した議論単位を管理

```sql
CREATE TABLE `adus` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `speech_id` INT NOT NULL,
  `first_sentence_id` INT NOT NULL,
  `last_sentence_id` INT NOT NULL,
  `text` TEXT NOT NULL,
  `role` VARCHAR(64) NOT NULL,
  `start_time` FLOAT NOT NULL,
  `end_time` FLOAT NOT NULL,

  PRIMARY KEY (`id`),
  KEY `ix_adus_id` (`id`),
  KEY `ix_adus_speech_id` (`speech_id`),
  KEY `first_sentence_id` (`first_sentence_id`),
  KEY `last_sentence_id` (`last_sentence_id`),

  CONSTRAINT `adus_ibfk_1` FOREIGN KEY (`speech_id`)
    REFERENCES `speeches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `adus_ibfk_2` FOREIGN KEY (`first_sentence_id`)
    REFERENCES `sentences` (`id`),
  CONSTRAINT `adus_ibfk_3` FOREIGN KEY (`last_sentence_id`)
    REFERENCES `sentences` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `id` | INT | グローバル ADU ID（全スピーチで連番） | 1, 2, 3... |
| `speech_id` | INT | speeches テーブルへの外部キー | 200 |
| `first_sentence_id` | INT | sentences テーブルの最初の文 | 5 |
| `last_sentence_id` | INT | sentences テーブルの最後の文 | 12 |
| `text` | TEXT | ADU テキスト | "Thank you to the opposition..." |
| `role` | VARCHAR(64) | ADU の役割 | "introduction" |
| `start_time` | FLOAT | 開始時刻（非正規化） | 0.0 |
| `end_time` | FLOAT | 終了時刻（非正規化） | 30.5 |

**役割（role）の値**:
- `introduction` - イントロダクション
- `definition` - 定義
- `independent_rebuttal` - 独立した反論
- `point_of_main_argument` - メイン論点
- `point_of_comparison` - 比較論点
- `poi` - Point of Information（割り込み質問）

**非正規化**: start_time, end_time を保持
- 理由: グラフ表示やシーク機能で頻繁にアクセス
- 正規化ルール違反だが、パフォーマンス向上

**データ規模**: ~8,000 行

---

### 6. rebuttals - 反論関係テーブル

**目的**: ADU 間の反論関係（多対多）を管理

```sql
CREATE TABLE `rebuttals` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `src_adu_id` INT NOT NULL,
  `tgt_adu_id` INT NOT NULL,

  PRIMARY KEY (`id`),
  KEY `idx_rebuttals_src` (`src_adu_id`),
  KEY `idx_rebuttals_tgt` (`tgt_adu_id`),
  KEY `ix_rebuttals_id` (`id`),

  CONSTRAINT `rebuttals_ibfk_1` FOREIGN KEY (`src_adu_id`)
    REFERENCES `adus` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rebuttals_ibfk_2` FOREIGN KEY (`tgt_adu_id`)
    REFERENCES `adus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 | 例 |
|--------|-----|------|-----|
| `id` | INT | 主キー | 1 |
| `src_adu_id` | INT | 反論している側の ADU ID | 2 |
| `tgt_adu_id` | INT | 反論されている側の ADU ID | 4 |

**解釈**:
- `[2, 4]` = ADU 2 が ADU 4 に反論している
- グラフでは: 2 → 4 の矢印

**フィルタリングルール**（フロントエンド実装）:
- 同チーム内の反論は表示しない
- POI 関連の反論は表示しない
- 複数の反論がある場合、最新版のみ使用

**データ規模**: ~5,000 行

---

### 7. external_videos - 外部動画テーブル

**目的**: YouTube 等の外部動画メタデータを管理

```sql
CREATE TABLE `external_videos` (
  `video_id` VARCHAR(255) NOT NULL,
  `title` TEXT,
  `thumbnail_url` TEXT,
  `created_at` DATETIME DEFAULT NULL,
  `description` TEXT,
  `published_at` DATETIME DEFAULT NULL,
  `channel_id` VARCHAR(255) DEFAULT NULL,
  `channel_title` VARCHAR(255) DEFAULT NULL,
  `tags` JSON DEFAULT NULL,
  `category_id` VARCHAR(50) DEFAULT NULL,
  `yt_transcript` MEDIUMTEXT,

  PRIMARY KEY (`video_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**カラム説明**:

| カラム | 型 | 説明 |
|--------|-----|------|
| `video_id` | VARCHAR(255) | YouTube ID（主キー） |
| `title` | TEXT | 動画タイトル |
| `thumbnail_url` | TEXT | サムネイル URL |
| `created_at` | DATETIME | DB保存日時 |
| `description` | TEXT | 動画説明 |
| `published_at` | DATETIME | YouTube公開日時 |
| `channel_id` | VARCHAR(255) | チャネル ID |
| `channel_title` | VARCHAR(255) | チャネル名 |
| `tags` | JSON | タグ配列 |
| `category_id` | VARCHAR(50) | YouTube カテゴリ ID |
| `yt_transcript` | MEDIUMTEXT | YouTube 字幕（JSON） |

---

## リレーションシップ図

```
external_videos (video_id)
        ▲
        │ (0..1) <- (0..1) (video_id)
        │

rounds (id)
  │
  ├─→ (1) ─ (0..*) speeches (round_id)
  │                    │
  │                    └─→ adus (speech_id)
  │                            │
  │                            ├─→ (0..*) ← (0..*) adus (id)
  │                            │        （rebuttals via src/tgt_adu_id）
  │                            │
  │                            └─→ sentences (first/last_sentence_id)
  │                                    │
  │                                    └─→ words (first/last_word_id)
  │
  ├─→ words (round_id)
  │
  └─→ sentences (round_id)

rebuttals (id)
  ├─ src_adu_id → adus (id)
  └─ tgt_adu_id → adus (id)
```

## カスケード削除ルール

```
DELETE FROM rounds WHERE id = X
  ├─ CASCADE → speeches (round_id = X)
  │              └─ CASCADE → adus (speech_id)
  │                  └─ CASCADE → rebuttals (src/tgt_adu_id)
  ├─ CASCADE → words (round_id = X)
  └─ CASCADE → sentences (round_id = X)
```

**効果**:
- 試合を削除 → すべての関連データが自動削除
- オーファンレコードなし

---

## インデックス戦略

### 主要インデックス

| テーブル | インデックス | 用途 |
|---------|-------------|------|
| rounds | (name, try_count) | 試合検索 |
| speeches | round_id | 試合のスピーチ取得 |
| words | round_id | 試合の単語取得 |
| sentences | round_id, first/last_word_id | 文検索 |
| adus | speech_id, first/last_sentence_id | ADU検索 |
| rebuttals | src_adu_id, tgt_adu_id | グラフ生成 |

### クエリ最適化

```sql
-- 試合全体の ADU を取得
SELECT a.* FROM adus a
JOIN speeches s ON a.speech_id = s.id
WHERE s.round_id = 68;
-- インデックス: speeches.round_id, adus.speech_id

-- グラフを生成
SELECT src_adu_id, tgt_adu_id FROM rebuttals
WHERE EXISTS (
  SELECT 1 FROM adus WHERE id = src_adu_id AND speech_id IN (...)
);
-- インデックス: rebuttals.src_adu_id, adus.speech_id
```

---

## データ規模（実績）

| テーブル | 行数 | 注釈 |
|---------|------|------|
| rounds | 68 | 試合数 |
| speeches | ~340 | 平均 5 試合/スピーチ |
| words | ~550,000 | 単語レベルのデータ |
| sentences | ~27,000 | 文レベルのデータ |
| adus | ~8,000 | 議論単位 |
| rebuttals | ~5,000 | 反論関係 |
| external_videos | 少数 | 参考動画 |

---

## マイグレーション管理

**ツール**: Alembic（SQLAlchemy）

**ファイル構造**:
```
alembic/
├── env.py                    # 設定
├── alembic.ini              # マイグレーション設定
└── versions/
    ├── 001_initial.py       # 初期スキーマ
    ├── 002_add_tags.py      # tags カラム追加
    ├── 003_add_try_count.py # try_count 機能
    └── ...（15個のマイグレーション）
```

**最新バージョン**: `183a74939155` (2026-02-06)

**アップグレード**:
```bash
alembic upgrade head
```

**新マイグレーション作成**:
```bash
alembic revision --autogenerate -m "Add new column"
```

---

## PostgreSQL 移行時の変更

### 型の変更

| MySQL | PostgreSQL |
|--------|-----------|
| INT | INT または SERIAL |
| VARCHAR(255) | VARCHAR(255) |
| TEXT | TEXT |
| JSON | JSONB（推奨） |
| MEDIUMTEXT | TEXT |
| DATETIME | TIMESTAMP |
| DEFAULT CURRENT_TIMESTAMP | DEFAULT now() |

### GORM マイグレーション設定

```go
// MySQL → PostgreSQL への GORM マイグレーション

type Round struct {
    ID    uint
    Name  string `gorm:"uniqueIndex:idx_name_try_count"`
    TryCount int `gorm:"uniqueIndex:idx_name_try_count"`
    RawTranscription datatypes.JSONType  // JSONB に対応
}

// PostgreSQL では JSON → JSONB に自動変換
```

---

**最終更新**: 2026-02-06
