# DebateVizSystem 技術選定の詳細評価

## 概要

Go + Flutter + PostgreSQL 移行時の技術選定根拠と代替案の比較

---

## Go バックエンド

### HTTP フレームワーク比較

| 評価項目 | Fiber | Gin | Echo | stdlib |
|---------|-------|-----|------|--------|
| **パフォーマンス** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **FastAPI 相似度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **ドキュメント** | ✅ 英語 | ✅ 英語/中文 | ✅ 英語 | ✅ 英語 |
| **学習曲線** | 低 | 低 | 低 | 中 |
| **デバッグ性** | 中 | 中 | 中 | 高 |
| **本番環境例** | 中程度 | 多数 | 多数 | 非常に多数 |

#### 詳細比較

##### 1. Fiber（推奨）

**メリット**:
- ✅ Express.js/FastAPI に最も近い API デザイン
- ✅ ビルトイン CORS、ロギング、エラーハンドリング
- ✅ ミドルウェアチェーンが直感的
- ✅ ルートグループ化が簡単
- ✅ 非常に高速（Express.js より 5-10 倍）
- ✅ マルチレンジリクエスト対応（ファイルダウンロードに有利）

**デメリット**:
- ❌ Express.js のラッパー的（薄い）
- ❌ 本番環境の事例が Gin/Echo より少ない
- ❌ コミュニティサイズが小さい

**FastAPI からの移行性**:
```python
# FastAPI
@app.post("/audio/save")
async def save_audio(file: UploadFile):
    pass

# Fiber (Go)
app.Post("/audio/save", func(c *fiber.Ctx) error {
    file, _ := c.FormFile("file")
    return nil
})
```
**非常に似ている** ✓

**推奨理由**:
FastAPI に最も近い API 設計により、既存の Python コードを Go に直訳できる。学習曲線も短い。

---

##### 2. Gin

**メリット**:
- ✅ 非常に多くの本番環境実績
- ✅ コミュニティが活発（Slack, GitHub Issues）
- ✅ 小規模から大規模まで対応
- ✅ パフォーマンスが良好

**デメリット**:
- ❌ API デザインが Fiber より冗長
- ❌ ビルトイン機能が少ない（外部ミドルウェア必要）
- ❌ FastAPI との相似度が低い

**使い分け**:
- **大規模プロジェクト**: Gin
- **小規模・快速**: Fiber

---

##### 3. Echo

**メリット**:
- ✅ バランスの取れた設計
- ✅ 豊富なドキュメント
- ✅ パフォーマンスが良好

**デメリット**:
- ❌ Fiber/Gin と比較して特色がない
- ❌ 中途半端（Fiber より遅い、Gin より古い）

**使い分け**:
- 既に Echo コードベース → 継続使用
- 新規プロジェクト → Fiber/Gin 推奨

---

**最終決定: Fiber ✓**

---

### ORM/データベースアクセス層

#### 比較表

| 評価項目 | GORM | sqlx | sql 標準 | ent |
|---------|------|------|---------|-----|
| **SQLAlchemy 相似度** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ |
| **リレーション対応** | ✅ | ✗ | ✗ | ✅ |
| **マイグレーション** | ✅ GORM Migrate | ❌ | ❌ | ✅ |
| **クエリビルダ** | ✅ 豊富 | 手書き | 手書き | ✅ |
| **パフォーマンス** | 中 | 高 | 高 | 中 |
| **学習曲線** | 中 | 低 | 低 | 中 |
| **N+1 問題対応** | ✅ Preload | 手動 | 手動 | ✅ |

#### 詳細選択

##### 1. GORM（推奨）

**メリット**:
- ✅ SQLAlchemy の Go 版
- ✅ リレーション自動管理
- ✅ フック機能（BeforeSave, AfterCreate など）
- ✅ マイグレーション機能ビルトイン
- ✅ Query Builder が豊富
- ✅ Scopes でコード再利用可能

**デメリット**:
- ❌ パフォーマンスオーバーヘッド（5-10%）
- ❌ デバッグ時に生 SQL が見づらい
- ❌ 複雑なクエリは手書き SQL が必要な場合がある

**SQLAlchemy からの移行性**:
```python
# SQLAlchemy
class Round(Base):
    speeches = relationship("Speech", cascade="delete")

# GORM
type Round struct {
    Speeches []Speech `gorm:"foreignKey:RoundID;constraint:OnDelete:CASCADE"`
}
```
**ほぼ一致** ✓

**推奨使用パターン**:
- CRUD 操作: GORM で十分
- 複雑クエリ: Raw SQL + GORM 併用
- バルク処理: sqlx に切り替え

---

##### 2. sqlx（代替案）

**メリット**:
- ✅ 非常に高速（GORM より 2-3 倍）
- ✅ SQL をそのまま書ける（デバッグ容易）
- ✅ シンプルで予測可能

**デメリット**:
- ❌ SQLAlchemy との相似度が低い
- ❌ リレーション自動管理がない
- ❌ マイグレーション機能がない（別ツール必要）
- ❌ N+1 問題を手動で対応

**推奨シーン**:
- 既存 sqlx コードベース
- パフォーマンス最優先
- シンプルなスキーマ

---

##### 3. ent（Entity Framework 相当）

**メリット**:
- ✅ TypeScript Entity Framework に相当
- ✅ コード生成による安全性
- ✅ グラフベースのリレーション管理

**デメリット**:
- ❌ 学習曲線が急
- ❌ セットアップが複雑
- ❌ Go らしくない（DSL）

**推奨シーン**:
- 非常に複雑なスキーマ
- エンタープライズシステム

---

**最終決定: GORM + sqlx ハイブリッド ✓**

- **基本**: GORM（CRUD、リレーション）
- **複雑クエリ/バルク**: sqlx または Raw SQL

---

### 非同期パターン（asyncio → goroutine）

#### Python FastAPI
```python
async def audio_to_graph_batch(...):
    # 複数ファイルを並行処理
    tasks = [
        transcribe_async(file)
        for file in files
    ]
    results = await asyncio.gather(*tasks)  # 全ファイルの結果を待つ
```

#### Go Fiber 相当

**オプション A: goroutine + sync.WaitGroup**
```go
func AudioToGraphBatch(c *fiber.Ctx) error {
    var wg sync.WaitGroup
    results := make(chan *TranscribeResult)

    for _, file := range files {
        wg.Add(1)
        go func(file UploadFile) {
            defer wg.Done()
            result := Transcribe(file)
            results <- result
        }(file)
    }

    // ゴルーチン終了を待つ
    go func() {
        wg.Wait()
        close(results)
    }()

    // 結果を集める
    var allResults []*TranscribeResult
    for result := range results {
        allResults = append(allResults, result)
    }

    return c.JSON(allResults)
}
```

**オプション B: errgroup.Group（推奨）**
```go
import "golang.org/x/sync/errgroup"

func AudioToGraphBatch(c *fiber.Ctx) error {
    eg := new(errgroup.Group)
    results := make([]*TranscribeResult, len(files))

    for i, file := range files {
        i, file := i, file  // ループ変数キャプチャ
        eg.Go(func() error {
            result, err := Transcribe(file)
            if err != nil {
                return err
            }
            results[i] = result
            return nil
        })
    }

    // 全ゴルーチン終了 + エラー集約待つ
    if err := eg.Wait(); err != nil {
        return c.Status(fiber.StatusInternalServerError).JSON(err)
    }

    return c.JSON(results)
}
```

**推奨: errgroup.Group ✓**

- エラーハンドリングが簡潔
- ゴルーチンリーク防止
- タイムアウト対応（context）

---

### 外部 API 連携

#### Whisper API（音声認識）

**公式 SDK**: `github.com/openai/openai-go`

```go
import "github.com/openai/openai-go"

client := openai.NewClient()
response, err := client.Audio.Transcriptions.New(ctx, openai.AudioTranscriptionNewParams{
    File:   openai.F(os.File),
    Model:  openai.F("whisper-1"),
    Prompt: openai.F("..."),
})
```

**推奨理由**:
- ✅ 公式サポート
- ✅ 最新機能対応
- ✅ エラーハンドリング統一

---

#### Gemini API（LLM）

**公式 SDK**: `google.golang.org/genai`（旧 `generativeai-go`）

```go
import "github.com/google/generative-ai-go/genai"

client, _ := genai.NewClient(ctx, option.WithAPIKey(os.Getenv("GEMINI_API_KEY")))
resp, _ := client.GenerateContent(ctx, genai.Text("..."))
```

**代替案**: HTTP API 直接使用（SDK がない場合）

```go
import "encoding/json"

var req = map[string]interface{}{
    "contents": []map[string]interface{}{
        {"parts": []map[string]string{{"text": "..."}}},
    },
}
resp, _ := http.Post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", "application/json", ...)
```

**推奨: 公式 SDK ✓**

---

#### YouTube ダウンロード（yt-dlp）

**Go バインディング**: `github.com/kkdai/youtube`（軽量）

```go
import "github.com/kkdai/youtube/v2"

client := youtube.Client{}
video, _ := client.GetVideo(ctx, "VIDEO_ID")
stream, _ := client.GetStream(video, &video.Formats[0])
```

**代替案**: exec で `yt-dlp` コマンド呼び出し

```go
import "os/exec"

cmd := exec.CommandContext(ctx, "yt-dlp", "-f", "251", "-o", "%(title)s.webm", url)
cmd.Run()
```

**推奨: exec + `yt-dlp` CLI ✓**

理由：
- ✅ 既に検証済み（FastAPI でも使用中）
- ✅ CLI の全機能を活用可能
- ✅ Go バインディングより安定

---

### PostgreSQL への移行ツール

#### オプション 1: pgloader（推奨）

```bash
LOAD DATABASE
    FROM mysql://user:password@localhost/debate
    INTO postgresql://user:password@localhost/debate
    WITH include drop, create indexes;
```

**メリット**:
- ✅ 単一コマンド実行
- ✅ データ型自動変換
- ✅ インデックス再生成

**デメリット**:
- ❌ 別ツールインストール必要
- ❌ Windows 環境でセットアップが複雑

---

#### オプション 2: Go スクリプト（自作）

```go
// go run migrate.go
// MySQL → PostgreSQL への手動スクリプト

func MigrateData() {
    // MySQL から読み込み
    rows, _ := mysqlDB.Query("SELECT * FROM rounds")
    defer rows.Close()

    // PostgreSQL に書き込み
    for rows.Next() {
        var round Round
        rows.Scan(&round.ID, &round.Name, ...)
        postgresDB.Create(&round)
    }
}
```

**メリット**:
- ✅ Go コードで制御可能
- ✅ 変換ロジックをカスタマイズ可能
- ✅ デバッグが容易

**デメリット**:
- ❌ 手書きコード量多い
- ❌ テストが必要

---

#### オプション 3: mysqldump + psql

```bash
# MySQL をダンプ
mysqldump --compatible=postgresql debate > dump.sql

# PostgreSQL にリストア
psql debate < dump.sql
```

**メリット**:
- ✅ 最も単純
- ✅ 外部ツール最小限

**デメリット**:
- ❌ 手動で SQL 修正が必要（型変換等）
- ❌ エラー時の対応が複雑

---

**最終決定: pgloader ✓**（Windows 環境では Go スクリプト検討）

---

## Flutter フロントエンド

### 音声録音パッケージ比較

| パッケージ | 質問度 | iOS | Android | 機能 | 推奨 |
|-----------|--------|-----|---------|------|------|
| `record` | ⭐⭐⭐⭐⭐ | ✅ | ✅ | WAV, MP3, AAC | **✓** |
| `flutter_sound` | ⭐⭐ | ✅ | ✅ | 多機能（重い） | ❌ |
| `audio_streamer` | ⭐ | ✅ | △ | 機能少（古い） | ❌ |

#### 詳細: record パッケージ

**GitHub**: `llfbandit/record`

**バージョン**: `^4.4.3`（2025 年 2 月現在）

**セットアップ**:

```yaml
# pubspec.yaml
dependencies:
  record: ^4.4.3
  permission_handler: ^11.4.3  # マイク許可管理
```

```kotlin
// android/app/src/main/AndroidManifest.xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

```swift
// ios/Runner/Info.plist
<key>NSMicrophoneUsageDescription</key>
<string>このアプリはマイクを使用して音声を録音します</string>
```

**使用例**:
```dart
final record = AudioRecorder();

// 録音開始
await record.start(
  path: _recordingPath,
  encoder: AudioEncoder.wav,
);

// 録音停止
final path = await record.stop();

// 音声ファイルを送信
final file = File(path!);
await api.uploadAudio(file: file);
```

**推奨理由**:
- ✅ シンプル API（MediaRecorder 相当）
- ✅ iOS/Android 両対応
- ✅ WAV/MP3/AAC 対応
- ✅ アクティブメンテナンス

---

### 音声再生パッケージ比較

| パッケージ | 質問度 | 機能 | 推奨 |
|-----------|--------|------|------|
| `just_audio` | ⭐⭐⭐⭐⭐ | 高機能、軽量 | **✓** |
| `audioplayers` | ⭐⭐⭐ | 複雑 | ❌ |
| `audio_players` | ⭐⭐ | 古い | ❌ |

#### 詳細: just_audio パッケージ

**GitHub**: `ryanheise/just_audio`

**バージョン**: `^0.9.0`

**機能**:
- ✅ 複数形式対応（MP3, WAV, AAC, OGG）
- ✅ ストリーミング対応
- ✅ 速度変更
- ✅ ボリューム制御
- ✅ シーク機能

**使用例**:
```dart
final player = AudioPlayer();

// 音声ファイル読み込み
await player.setFilePath(_audioPath);

// 再生開始
await player.play();

// シーク
await player.seek(Duration(seconds: 40));

// 停止
await player.stop();
```

**統合タイムライン実装**:
```dart
// 複数スピーチの Blob を管理
class UnifiedAudioPlayer {
  final _player = AudioPlayer();
  final List<Uint8List> _blobs;  // Blob 配列
  final List<Duration> _durations;  // 各 Blob の duration

  // グローバル時刻 → ローカル Blob + 時刻へ変換
  Future<void> seekToGlobalTime(Duration globalTime) async {
    int segmentIndex = 0;
    Duration accumulated = Duration.zero;

    for (int i = 0; i < _durations.length; i++) {
      if (accumulated + _durations[i] > globalTime) {
        segmentIndex = i;
        break;
      }
      accumulated += _durations[i];
    }

    final localTime = globalTime - accumulated;

    // Blob を切り替え
    await _loadBlob(_blobs[segmentIndex]);
    // シーク
    await _player.seek(localTime);
  }
}
```

**推奨理由**:
- ✅ 最も安定（アクティブメンテナンス）
- ✅ 機能が豊富
- ✅ コミュニティが大きい
- ✅ パフォーマンス良好

---

### グラフ可視化パッケージ比較

| オプション | 複雑度 | パフォーマンス | 推奨 | 備考 |
|----------|-------|------------|-----|------|
| **A: CustomPaint + 手書き** | 高 | ⭐⭐⭐⭐⭐ | **✓** | 細かい制御可能 |
| **B: graphview** | 中 | ⭐⭐⭐ | △ | シンプル |
| **C: Skia Canvas** | 中 | ⭐⭐⭐⭐⭐ | △ | native 橋 複雑 |

#### オプション A: CustomPaint（推奨）

```dart
import 'dart:ui' as ui;

class GraphPainter extends CustomPainter {
  final List<GraphNode> nodes;
  final List<GraphEdge> edges;

  @override
  void paint(Canvas canvas, Size size) {
    // エッジ描画
    for (var edge in edges) {
      canvas.drawLine(
        Offset(edge.from.x, edge.from.y),
        Offset(edge.to.x, edge.to.y),
        Paint()..color = Colors.grey
      );
    }

    // ノード描画
    for (var node in nodes) {
      canvas.drawCircle(
        Offset(node.x, node.y),
        20,
        Paint()..color = node.color
      );

      // テキスト描画
      final textPainter = TextPainter(
        text: TextSpan(text: node.label),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(canvas, Offset(node.x - 10, node.y - 10));
    }
  }

  @override
  bool shouldRepaint(GraphPainter oldDelegate) => true;
}
```

**メリット**:
- ✅ 完全な制御
- ✅ パフォーマンス最高
- ✅ Flutter ネイティブ
- ✅ ReactFlow の複雑なレイアウト → 簡略化可能

**デメリット**:
- ❌ コード量多い（500 行以上）
- ❌ レイアウトアルゴリズム自作
- ❌ ドラッグ/ズーム自作

**推奨シーン**:
- 正確な制御が必要
- 大規模グラフ（1000+ ノード）

---

#### オプション B: graphview パッケージ

```dart
import 'package:graphview/graphview.dart';

class GraphviewWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    var graph = Graph()..isTree = false;

    // ノード作成
    var n1 = Node.Id(1);
    var n2 = Node.Id(2);
    graph.addEdge(n1, n2);

    return InteractiveViewer(
      child: GraphView(
        graph: graph,
        algorithm: BuchheimWalkerAlgorithm(),  // レイアウト
        paint: Paint()..color = Colors.grey,
      ),
    );
  }
}
```

**メリット**:
- ✅ セットアップが簡単
- ✅ レイアウト自動計算
- ✅ ドラッグ/ズーム ビルトイン

**デメリット**:
- ❌ カスタマイズが限定的
- ❌ 大規模グラフで遅い
- ❌ ReactFlow 相当の機能がない

**推奨シーン**:
- プロトタイプ/MVP
- 小規模グラフ（<100 ノード）

---

**推奨: Phase 8 で A（CustomPaint）と B（graphview）を実装比較 ✓**

最初は B でプロトタイプ、パフォーマンス問題があれば A に切り替え。

---

### HTTP 通信パッケージ比較

| パッケージ | 推奨度 | 機能 |
|----------|--------|------|
| `dio` | ⭐⭐⭐⭐⭐ | Axios/Retrofit 相当 |
| `http` | ⭐⭐⭐⭐ | シンプル |
| `chopper` | ⭐⭐ | 複雑 |

#### dio パッケージ（推奨）

```yaml
# pubspec.yaml
dependencies:
  dio: ^5.0.0
```

```dart
class ApiService {
  final Dio _dio = Dio();

  ApiService() {
    _dio.options.baseUrl = 'http://localhost:8080';
  }

  // 音声アップロード
  Future<void> uploadAudio({
    required String roundName,
    required int speechIndex,
    required String speechName,
    required File file,
  }) async {
    FormData formData = FormData.fromMap({
      'round_name': roundName,
      'speech_index': speechIndex,
      'speech_name': speechName,
      'file': await MultipartFile.fromFile(
        file.path,
        filename: file.path.split('/').last,
      ),
    });

    await _dio.post('/audio/save', data: formData);
  }

  // グラフ取得
  Future<GraphData> getGraph(String matchName) async {
    final response = await _dio.get('/rebuttal-graph/$matchName');
    return GraphData.fromJson(response.data);
  }
}
```

**推奨理由**:
- ✅ Axios（JavaScript）と同じ使い心地
- ✅ Retrofit（Android）相当
- ✅ インターセプタ対応
- ✅ FormData 簡単

---

### 状態管理パッケージ

| パッケージ | 複雑度 | 推奨 | 用途 |
|----------|-------|-----|------|
| `provider` | 低 | ✓ | グローバル状態 |
| `getx` | 中 | ✓ | ルーティング + 状態 |
| `riverpod` | 中 | △ | 関数型アプローチ |
| `bloc` | 高 | ❌ | 大規模（ぎた） |

#### 推奨: GetX または Provider（2 つ併用）

**GetX** - UI ロジック
```dart
class RecordController extends GetxController {
  var currentSpeechIndex = 0.obs;
  var speechRecordings = {}.obs;

  void updateSpeechIndex(int index) {
    currentSpeechIndex.value = index;
  }
}

class RecordScreen extends StatelessWidget {
  final controller = Get.put(RecordController());

  @override
  Widget build(BuildContext context) {
    return Obx(() => Text('Speech: ${controller.currentSpeechIndex}'));
  }
}
```

**Provider** - API データ
```dart
final roundProvider = FutureProvider<List<Round>>((ref) async {
  final api = ref.watch(apiServiceProvider);
  return api.getRounds();
});

class RoundListScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roundsAsync = ref.watch(roundProvider);

    return roundsAsync.when(
      data: (rounds) => ListView(...),
      loading: () => CircularProgressIndicator(),
      error: (err, stack) => Text('Error: $err'),
    );
  }
}
```

---

### 多言語対応

```yaml
# pubspec.yaml
dependencies:
  intl: ^0.19.0
  flutter_localizations:
    sdk: flutter
```

```dart
// lib/l10n/app_en.arb
{
  "record_button": "Start Recording",
  "stop_button": "Stop Recording"
}

// lib/l10n/app_ja.arb
{
  "record_button": "録音開始",
  "stop_button": "録音停止"
}
```

```dart
// 使用
Text(AppLocalizations.of(context)!.record_button)
```

**次のステップで既存 en.ts, ja.ts を ARB ファイルに変換**

---

## PostgreSQL 設定

### Schema 設定（MySQL → PostgreSQL）

#### JSON/JSONB 型

```sql
-- MySQL
raw_transcription JSON

-- PostgreSQL（推奨: JSONB）
raw_transcription JSONB

-- JSONB インデックス
CREATE INDEX idx_rounds_raw_transcription
ON rounds USING GIN (raw_transcription);
```

#### AUTO_INCREMENT → SERIAL/BIGSERIAL

```sql
-- MySQL
id INT AUTO_INCREMENT PRIMARY KEY

-- PostgreSQL
id SERIAL PRIMARY KEY
-- または
id BIGSERIAL PRIMARY KEY （大規模）
```

#### MEDIUMTEXT → TEXT

```sql
-- MySQL
yt_transcript MEDIUMTEXT

-- PostgreSQL
yt_transcript TEXT  （無制限）
```

### 接続設定（Go）

```go
// db.go
func InitDB() (*gorm.DB, error) {
    dsn := fmt.Sprintf(
        "host=%s user=%s password=%s dbname=%s port=5432",
        os.Getenv("POSTGRES_HOST"),
        os.Getenv("POSTGRES_USER"),
        os.Getenv("POSTGRES_PASSWORD"),
        os.Getenv("POSTGRES_DATABASE"),
    )

    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    return db, err
}
```

### マイグレーション設定

```go
// GORM Migrate
func AutoMigrate() error {
    return db.AutoMigrate(
        &Round{},
        &Speech{},
        &ADU{},
        &Rebuttal{},
        &Sentence{},
        &Word{},
    )
}
```

---

## DevOps 推奨構成

### Docker イメージ

#### Go API

```dockerfile
# Dockerfile
FROM golang:1.21 as builder
WORKDIR /app
COPY . .
RUN go build -o server ./cmd/server/main.go

FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/server /app/
EXPOSE 8000
CMD ["/app/server"]
```

#### Flutter Web（オプション）

```dockerfile
FROM cirrusci/flutter as builder
WORKDIR /app
COPY . .
RUN flutter pub get
RUN flutter build web

FROM nginx:alpine
COPY --from=builder /app/build/web /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: ""
      POSTGRES_DB: debate
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  go-api:
    build: ./go-api
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_USER: root
      POSTGRES_PASSWORD: ""
      POSTGRES_DATABASE: debate
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

---

**最終更新**: 2026-02-06
