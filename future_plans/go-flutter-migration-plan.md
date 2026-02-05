# DebateVizSystem Go + Flutter 移行計画

## 概要

DebateVizSystemを、Go（バックエンド）+ Flutter（モバイルフロントエンド）+ PostgreSQL（データベース）へ段階的に移行する包括的な計画です。

**主な動機**：
- 💬 **Web の限界突破**：音声録音機能をモバイルネイティブで実装（MediaRecorder API の制限を回避）
- 🏗️ **統一基盤**：バックエンド・フロントエンド・DB を最新スタックで統一
- ⚡ **パフォーマンス**：Go の並行処理、Flutter のネイティブコンパイル
- 🔒 **スケーラビリティ**：PostgreSQL の堅牢性、JSONB の柔軟性

**総期間**：約5ヶ月（10フェーズ）
**チームサイズ**：1-2名（各フェーズ 1-2 週間）
**リスク**：低（既存システムと並行稼働、段階的移行）

---

## 移行戦略：なぜこの順番？

### 優先順位の理由

```
Phase 0: 環境構築 → Phase 1: Flutter録音MVP
         ↓
    既存FastAPIで動く ✓（独立実装可能）
         ↓
Phase 2-3: Go API層 ← 既存エンドポイント参考に実装
         ↓
Phase 4: PostgreSQL移行 ← DB層は独立タスク
         ↓
Phase 5-9: LLMパイプライン、グラフ可視化
         ↓
完全移行完了
```

### 「Small Steps」の工夫

| フェーズ | 実装期間 | 成果物 | 動作確認 |
|---------|--------|-------|---------|
| Phase 0 | 1週間 | 環境、リポジトリ | ツール動作確認 |
| Phase 1 | 1-2週間 | **Flutter録音機能** | 📱 アプリで直接テスト ✓ |
| Phase 2 | 1-2週間 | Go最小API | 既存WebアプリからAPI通信 |
| Phase 3 | 1週間 | 音声保存エンドポイント | WebアプリがGoで保存可能に |
| Phase 4 | 2週間 | PostgreSQL移行 | SQLで全データ確認可能 |
| Phase 5-6 | 3週間 | Go LLMパイプライン | 既存処理と比較検証 |
| Phase 7 | 1-2週間 | Flutter試合管理 | アプリでラウンド管理 |
| Phase 8 | 2週間 | Flutter グラフUI | Canvas描画テスト |
| Phase 9 | 1-2週間 | 統合テスト | 全エンドツーエンド |

**最初の成功体験**: Week 2-3 で Flutter で実際に音声録音できる ✓

---

## フェーズ詳細

### Phase 0: 環境構築（Week 1）

**目標**: Go/Flutter/PostgreSQL の開発環境を完成させ、空のプロジェクト構造を作成

**実装内容**:
- Go プロジェクト初期化（`go mod init`, パッケージ構造設計）
- Flutter プロジェクト初期化（iOS/Android 両対応）
- PostgreSQL Docker コンテナセットアップ
- GitHub リポジトリ分割（`DebateVizGoAPI`, `DebateVizFlutter`）
- 開発用 docker-compose.yml（PostgreSQL + 既存FastAPI）

**成果物**:
```
DebateVizGoAPI/
  ├── cmd/server/main.go
  ├── internal/
  │   ├── handler/
  │   ├── service/
  │   ├── repository/
  │   └── models/
  ├── go.mod
  └── Dockerfile

DebateVizFlutter/
  ├── lib/main.dart
  ├── pubspec.yaml
  └── ios/, android/
```

**検証方法**:
- `go run cmd/server/main.go` で Hello World サーバー起動
- `flutter run` で iOS/Android シミュレータで空画面表示

---

### Phase 1: Flutter 最小MVP - 音声録音機能（Week 2-3）

**目標**: スマートフォンで音声録音・保存できるアプリを完成させる

**実装内容**:
- `record` パッケージ導入（iOS/Android 音声許可含む）
- 録音UI: 開始/停止ボタン、duration 表示
- 音声ファイル保存（アプリローカルストレージ）
- 既存バックエンド `/audio/save` への送信（FormData）
- シンプルな試合名入力フォーム

**技術選택**:
- 📦 `record: ^4.4.3` - 音声キャプチャ（iOS/Android）
- 📦 `permission_handler: ^11.4.3` - マイク許可
- 📦 `http: ^1.1.0` - HTTP 通信（FormData）
- 📦 `intl: ^0.19.0` - 多言語対応（en/ja）

**成果物**:
```
DebateVizFlutter/
  ├── lib/
  │   ├── screens/home_screen.dart （録音UI）
  │   ├── services/recording_service.dart
  │   ├── services/api_service.dart （FastAPI連携）
  │   └── models/audio_model.dart
  └── pubspec.yaml
```

**検証方法**:
- ✅ iOS/Android シミュレータで「開始」→「停止」
- ✅ `~/Library/` または `/sdcard/` に .wav ファイルが保存されている
- ✅ 既存 Web アプリの `/audio/match/{match_name}` に新しい録音が表示される

**リスク**: iOS で provisioning profile が必要→事前に Apple Developer 登録

---

### Phase 2: Go 最小 API サーバー構築（Week 4-5）

**目標**: FastAPI の `/audio/save` と `/audio/match` エンドポイントを Go で再実装

**実装内容**:
- Fiber フレームワーク初期化
- 環境設定（config）、ロギング（logrus）
- `/audio/save` エンドポイント（FormData 受け取り、ファイル保存）
- `/audio/match/{match_name}` エンドポイント（ファイル一覧取得）
- CORS 設定（既存 Web アプリと Flutter から叩けるように）

**技術選択**:
- 🔥 `Fiber` - FastAPI 相当の高性能フレームワーク
- 📦 `logrus` - ログ（JSON フォーマット）
- 📦 `godotenv` - .env 読み込み
- 📁 ファイルシステム：OS の `os` パッケージ

**成果物**:
```
DebateVizGoAPI/
  ├── cmd/server/main.go
  ├── internal/
  │   ├── handler/audio.go （エンドポイント）
  │   ├── service/audio_service.go
  │   ├── config/config.go
  │   └── logger/logger.go
  ├── go.mod
  └── docker-compose.yml
```

**検証方法**:
- `curl -X POST http://localhost:8000/audio/save -F "file=@test.wav"`
- `curl http://localhost:8000/audio/match/test-round`
- Postman で FormData リクエスト送信

**リスク**: Go の io/multipart パッケージの扱い→既存コード（FastAPI）を参考に

---

### Phase 3: Go データベース層（Week 6）

**目標**: MySQL で動作している Round/Speech/ADU データの基本的な CRUD を Go で実装

**実装内容**:
- GORM + MySQL ドライバー（aiomysql でなく mysql ドライバー）
- モデル定義（Round, Speech, ADU, Rebuttal）
- Repository パターン（CRUD 関数）
- `/round/{id}` GET, `/round/new` POST エンドポイント
- SQLAlchemy との機能比較テスト

**技術選択**:
- 🗄️ `GORM` - Go ORM（SQLAlchemy 相当）
- 📦 `github.com/go-sql-driver/mysql` - MySQL ドライバー

**成果物**:
```
DebateVizGoAPI/
  ├── internal/
  │   ├── models/
  │   │   ├── round.go
  │   │   ├── speech.go
  │   │   └── adu.go
  │   ├── repository/round_repository.go
  │   ├── db/db.go （接続）
  │   └── handler/round.go
  └── tests/round_test.go
```

**検証方法**:
- `go test ./...` で CRUD テスト合格
- Postman で `/round/123` レスポンスが FastAPI と同じ

---

### Phase 4: PostgreSQL 移行（Week 7-8）

**目標**: MySQL データベースを PostgreSQL に移行し、Go のすべてのエンドポイントで動作確認

**実装内容**:

#### Step 4a: スキーマ準備（2日）
```sql
-- PostgreSQL スキーマ作成（MySQL スキーマを変換）
CREATE TABLE rounds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  try_count INT NOT NULL DEFAULT 1,
  type VARCHAR(50) NOT NULL DEFAULT 'record',
  style VARCHAR(50) NOT NULL,
  motion TEXT,
  tags VARCHAR(255),
  raw_transcription JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, try_count)
);
-- ... speeches, words, sentences, adus, rebuttals ...
```

#### Step 4b: データ移行（2日）
```bash
# MySQL → CSV エクスポート
mysqldump --csv debate > rounds.csv

# CSV → PostgreSQL インポート
psql -d debate -c "COPY rounds FROM 'rounds.csv' CSV"
```

#### Step 4c: Go コード更新（2日）
- GORM DSN を PostgreSQL に変更
- JSON 型を JSONB に（Postgres 最適化）
- すべてのテスト再実行

**技術選択**:
- 📦 `github.com/lib/pq` - PostgreSQL ドライバー
- 🛠️ `pgloader` または カスタム Go スクリプト - データ移行

**成果物**:
```
docker-compose.yml （PostgreSQL 14-alpine）
Go エンドポイント全部 PostgreSQL で動作確認
MySQL バックアップ（念のため保持）
```

**検証方法**:
- `psql -d debate -c "SELECT COUNT(*) FROM rounds"` で行数確認
- `go test ./...` ですべてのテスト合格
- 既存 Web アプリ（FastAPI）の接続先を PostgreSQL に変更して動作確認

**リスク**:
- データ型変換エラー（MEDIUMTEXT → TEXT など）→ テスト環境で事前確認
- JSON/JSONB の互換性→ Go の `json.Marshal/Unmarshal` で対応

---

### Phase 5: Go LLM パイプライン - 文字起こし（Week 9-10）

**目標**: Whisper API を Go から呼び出し、FastAPI の `/audio-to-transcript-batch` を再実装

**実装内容**:
- `openai-go` SDK（Whisper API）
- `/audio/transcribe/{match_name}` エンドポイント
- 複数ファイル並行処理（goroutine 使用）
- 結果を sentences テーブルに保存

**技術選択**:
- 📦 `github.com/openai/openai-go` - Whisper API
- 🔄 goroutine + `sync.WaitGroup` または `errgroup.Group` - 並行処理

**成果物**:
```
DebateVizGoAPI/
  ├── internal/
  │   ├── handler/transcribe.go
  │   ├── service/whisper_service.go
  │   └── repository/sentence_repository.go
  └── config/openai.go （API KEY）
```

**検証方法**:
- `curl -X POST http://localhost:8000/audio/transcribe/test-round`
- PostgreSQL の `sentences` テーブルに行が挿入される
- 既存 Web アプリの文字起こし結果と比較

---

### Phase 6: Go LLM パイプライン - ADU/反論検出（Week 11-12）

**目標**: Gemini API を Go から呼び出し、LLM ベースの ADU 分割・反論検出を実装

**実装内容**:
- `google.golang.org/genai` (Gemini API)
- `/audio/analyze/{match_name}` エンドポイント（ADU + 反論一括）
- プロンプト エンジニアリング（FastAPI コード参照）
- 結果の JSON グラフ生成

**技術選択**:
- 📦 `google.golang.org/genai` - Gemini 2.5 Flash
- 📝 Prompt ファイル化（`internal/prompts/adu_prompt.txt` など）

**成果物**:
```
DebateVizGoAPI/
  ├── internal/
  │   ├── handler/analyze.go
  │   ├── service/gemini_service.go
  │   ├── repository/adu_repository.go
  │   ├── prompts/
  │   │   ├── adu_prompt.txt
  │   │   └── rebuttal_prompt.txt
  │   └── models/graph.go
  └── tests/gemini_test.go
```

**検証方法**:
- `curl -X POST http://localhost:8000/audio/analyze/test-round` で JSON グラフ返却
- 既存 Web アプリ（FastAPI）と同じ JSON フォーマット

---

### Phase 7: Flutter - 試合管理・音声再生（Week 13-14）

**目標**: Flutter アプリで試合の CRUD と複数スピーチの音声再生を実装

**実装内容**:
- Go API (`/round/*`) から試合一覧・詳細取得
- ローカル試合リスト UI（ListView）
- 音声再生機能（`just_audio` パッケージ）
- 統合タイムライン管理（複数スピーチの連続再生）

**技術選択**:
- 📦 `just_audio: ^0.9.0` - 音声再生
- 📦 `getx: ^4.6.0` または `provider: ^6.0.0` - 状態管理
- 📦 `dio: ^5.0.0` - HTTP（Retrofit）

**成果物**:
```
DebateVizFlutter/
  ├── lib/
  │   ├── screens/
  │   │   ├── round_list_screen.dart
  │   │   └── round_detail_screen.dart
  │   ├── widgets/
  │   │   └── audio_player_widget.dart
  │   ├── services/
  │   │   ├── api_service.dart （更新）
  │   │   └── audio_service.dart （再生）
  │   └── models/round_model.dart
  └── tests/audio_player_test.dart
```

**検証方法**:
- ✅ Flutter アプリで試合一覧表示
- ✅ 試合をタップして詳細表示
- ✅ 「再生」ボタンで複数スピーチが連続再生される

---

### Phase 8: Flutter - グラフ可視化 UI（Week 15-16）

**目標**: 反論グラフをモバイル画面で描画・インタラクティブに操作可能に

**実装内容**:
- グラフデータ解析（JSON から node/edge 抽出）
- Canvas/CustomPaint で可視化
- ノードレイアウトアルゴリズム（フェーズ実装より単純化）
- タップ・ドラッグ対応（ズーム・パン）
- ノードクリック → 音声再生（タイムシーク）

**技術選択**:
- 🎨 `CustomPaint` + `Canvas` - 手書き描画
- または 📦 `graphview: ^0.7.0` - グラフライブラリ（評価後選択）
- 📦 `gesture_detector` - タップ/ドラッグ検出（stdlib）

**成果物**:
```
DebateVizFlutter/
  ├── lib/
  │   ├── widgets/
  │   │   ├── graph_painter.dart
  │   │   └── graph_widget.dart
  │   ├── models/
  │   │   └── graph_model.dart
  │   └── services/graph_service.dart （レイアウト計算）
  └── tests/graph_widget_test.dart
```

**検証方法**:
- ✅ グラフが画面中央に描画される
- ✅ ノードをタップ → 該当スピーチが再生される
- ✅ ドラッグでパン可能

**リスク**:
- ReactFlow の複雑なレイアウト → Flutter では単純化（重要度順にレイアウト）
- パフォーマンス → 大規模グラフは段階的レンダリング

---

### Phase 9: 統合テスト・完全移行（Week 17）

**目標**: 全機能が Go + Flutter + PostgreSQL で動作し、FastAPI/MySQL は廃止可能な状態

**実装内容**:
- エンドツーエンドテスト（Flutter → Go → PostgreSQL → Flutter）
- デグラデーション試験（FastAPI との機能比較）
- パフォーマンステスト（並行処理、大規模グラフ）
- Docker イメージ最適化（マルチステージビルド）
- 本番環境ドキュメント作成

**検証方法**:
- ✅ Flutter アプリで新規試合作成
- ✅ 複数スピーチ録音
- ✅ Go サーバーで文字起こし・ADU・グラフ生成
- ✅ グラフが Flutter で表示・再生可能
- ✅ PostgreSQL に全データが保存されている

---

## 技術選定の詳細

### Go フレームワーク比較

| 項目 | Fiber | Gin | Echo |
|------|-------|-----|------|
| パフォーマンス | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| FastAPI 相似度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| ドキュメント | ✅ 充実 | ✅ 充実 | ✅ 充実 |
| 学習曲線 | 低 | 低 | 中 |
| **推奨** | **✓** | - | - |

**Fiber 選定理由**:
- Express.js（JavaScript）/FastAPI（Python）に最も近いシンタックス
- ミドルウェアチェーン、グループルーティング等が直感的
- ビルトイン機能が豊富（ロギング、エラーハンドリング等）

### ORM 比較

| 項目 | GORM | sqlx | 標準 sql |
|------|------|------|---------|
| 学習曲線 | 中 | 低 | 高 |
| SQLAlchemy 相似度 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ |
| リレーション対応 | ✅ | ✗ | ✗ |
| マイグレーション | GORM migrate | - | - |
| **推奨** | **✓** | - | - |

**GORM 選定理由**:
- SQLAlchemy の ORM 相当の機能（リレーション、フック等）
- マイグレーション機能ビルトイン
- PostgreSQL/MySQL の両対応

### Flutter パッケージ選択

#### 録音
```yaml
record: ^4.4.3        # 最も安定、iOS/Android 両対応
flutter_sound: 対比    # 重い、不要な機能多い ✗
audio_streamer: 対比   # 古い ✗
```

#### 音声再生
```yaml
just_audio: ^0.9.0    # 軽量、高機能、推奨 ✓
audioplayers: 対比     # 複雑 ✗
audio_players: 対比    # メンテ止まってる ✗
```

#### グラフ描画（検討中）
```
Option A: CustomPaint + 手書き
  → 複雑だが細かい制御可能、最小バンドル

Option B: graphview
  → ビルトイン機能、簡単だが拡張性限定

Option C: Canvas プラグイン（native）
  → 高速だが、iOS/Android ブリッジ複雑

推奨: Phase 8 の実装時に A と B で実装比較
```

#### HTTP 通信
```yaml
dio: ^5.0.0           # Retrofit 相当、推奨 ✓
http: ^1.1.0          # 標準的、シンプル
chopper: 複雑化 ✗
```

---

## リスクと対策

### 技術的リスク

| リスク | 影響度 | 対策 |
|-------|-------|------|
| **Go LLM ライブラリ未成熟** | 中 | Gemini/OpenAI の HTTP API を直接使用（フォールバック） |
| **Flutter グラフ描画複雑** | 高 | Phase 8 で 2 パターン実装テスト、シンプル版で妥協 |
| **PostgreSQL マイグレーション失敗** | 中 | MySQL バックアップ保持、テスト環境で事前検証 |
| **iOS Provisioning Profile** | 中 | Phase 1 前に Apple Developer 登録完了 |
| **ネットワーク遅延** | 低 | キャッシング、リトライロジック（Phase 5+） |

### スケジュールリスク

| 項目 | 対策 |
|------|------|
| 各フェーズが予定超過 | 次フェーズに移動OK、後で戻る柔軟性 |
| LLM API コスト膨張 | テスト用の smaller モデル使用（Gemini Flash 優先） |
| 依存パッケージの更新破損 | `go.sum`, `pubspec.lock` でバージョン固定 |
| チーム変更 | ドキュメント充実（コード例、テスト） |

---

## マイルストーン

### Quick Wins（早期成功）
- **Week 2-3**: ✅ Flutter で音声録音できた
  - 最初の成功体験
  - モバイル化の実感

- **Week 5**: ✅ Go API で FastAPI と同じレスポンス
  - バックエンド移行の実感

- **Week 8**: ✅ PostgreSQL すべてのテスト合格
  - DB 移行のやり遂げ感

### 中期目標（Phase 5-7）
- **Week 12**: ✅ Go で LLM パイプライン完成
  - 複雑処理の実装確認

- **Week 14**: ✅ Flutter で試合管理・再生
  - モバイルアプリ機能実感

### 最終ゴール
- **Week 17**: ✅ グラフ可視化完成
- **Week 17**: ✅ 完全移行可能な状態
  - FastAPI 廃止判断

---

## 並行稼働の利点

```
既存システム（FastAPI + Next.js + MySQL）
  ↓ 継続稼働（本番環境）
  │
  ├─ 新システム（Go + Flutter + PostgreSQL）
  │    ├─ Phase 0-1: Flutter 開発（Web 影響なし）
  │    ├─ Phase 2-4: Go API + DB 移行（テスト環境）
  │    ├─ Phase 5-8: 全機能移行（段階的切り替え）
  │    └─ Phase 9: 完全置き換え ✓
  │
  └─ ロールバック可能（いつでも FastAPI に戻せる）
```

**メリット**:
- 既存ユーザーへの影響ゼロ
- 新システムで問題発見 → 対策してから本番切り替え
- 段階的移行で安全
- 並行運用で信頼性検証可能

---

## 実装開始前のチェックリスト

- [ ] Apple Developer アカウント有効（iOS テスト用）
- [ ] Android NDK インストール（Android Studio）
- [ ] Docker インストール（PostgreSQL テスト）
- [ ] OpenAI/Gemini API キー取得
- [ ] GitHub リポジトリ分割（DebateVizGoAPI, DebateVizFlutter）
- [ ] Slack/Discord チャネル作成（進捗共有）
- [ ] タイムブロック予定（週単位で計画）

---

## 参考資料

- **Go**: Fiber ドキュメント、GORM ドキュメント
- **Flutter**: `record` パッケージ、`just_audio` パッケージ
- **PostgreSQL**: 公式ドキュメント、pgloader ドキュメント
- **既存コード**: `fastapi/main-service/app/routers/audio2adu.py` (FastAPI LLM パイプライン参照)

---

**計画作成日**: 2026-02-06
**ステータス**: 🔵 計画承認待ち → 🟢 Phase 0 開始
