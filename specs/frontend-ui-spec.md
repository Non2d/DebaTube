# フロントエンド UI 仕様書

**実装**: Next.js 14 + TypeScript + React 18
**スタイリング**: Tailwind CSS + shadcn/ui
**ホスト**: http://localhost:3000

---

## 全体ページ構成

```
[lang]/
├── /                      # ルート → /explore へリダイレクト
├── landing/               # ランディングページ
├── explore/               # グラフ閲覧ページ
├── dashboard/             # ダッシュボード（YouTube 処理）
│   ├── new/              # 新規ラウンド登録
│   └── register/[id]/    # ラウンド詳細編集
└── record/               # ★メイン - 音声録音・グラフ可視化
```

**言語対応**:
- `/en/...` (英語)
- `/ja/...` (日本語)

---

## Record ページ（メイン機能）

**ファイル**: `app/[lang]/record/page.tsx`

### ページ概要

Record ページは 3 つのタブで構成される。全ツールで試合 ID を共有。

```
┌─────────────────────────────────────────┐
│ DebateViz Record                        │
├─────────────────────────────────────────┤
│ Round Name: _________ | Format: [▼]    │
├─────────────────────────────────────────┤
│ [Dashboard] [Audio] [Visualization]    │
├─────────────────────────────────────────┤
│                                         │
│  (タブコンテンツ)                        │
│                                         │
└─────────────────────────────────────────┘
```

### 共通設定エリア

**Round Name 入力**
- 型: text input
- 保存先: localStorage (`debate_round_name`)
- 初期値: localStorage から復元
- バリデーション: 1-255 文字、英数・ハイフン・アンダースコアのみ
- **注意**: Home タブでのみ変更可能。Baseline/Ctrl タブではその試合 ID の情報を参照

**Debate Format 選択**
- 型: dropdown
- 選択肢: BP, NA, ASIAN, WSDC, HPDU
- 保存先: localStorage (`debate_format`)
- デフォルト: BP
- 用途: グラフ生成時に论题の議論順序を決定

---

## Tab 1: Dashboard（既存試合一覧）

**目的**: ローカルに保存された試合の一覧表示・管理

### UI レイアウト

```
┌─────────────────────────────────┐
│ My Rounds                       │
├─────────────────────────────────┤
│ [New Round]                     │
├─────────────────────────────────┤
│ Round Name      | Format | Action│
├─────────────────────────────────┤
│ round-bp-2025   | BP      | [Edit] [Delete] │
│ round-na-demo   | NA      | [Edit] [Delete] │
│ ...             |         |      |          │
└─────────────────────────────────┘
```

### 機能

1. **試合一覧**
   - localStorage に保存されたすべての試合を表示
   - 各行に試合 ID、形式、作成日を表示
   - Edit ボタン: 試合詳細ページへナビゲート
   - Delete ボタン: 試合を削除（確認ダイアログ）

2. **新規ラウンド作成**
   - 「New Round」ボタン → `/dashboard/new` へ遷移

3. **データソース**
   - localStorage キー: `debate_history` (JSON 配列)
   - スキーマ:
     ```typescript
     interface RoundHistory {
       id: string;
       name: string;
       format: DebateFormatType;
       createdAt: string;
       speechCount: number;
     }
     ```

---

## Tab 2: Audio（音声録音・グラフ生成）

**目的**: スピーチごとに音声を録音し、グラフ生成処理を実行

### UI レイアウト

```
┌──────────────────────────────────────────┐
│ Recording Setup                          │
├──────────────────────────────────────────┤
│ Current Speech: [0] Proposition_1st      │
│ Next: Opposition_1st, Opposition_2nd     │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────┐     │
│  │  [● START]  Duration: 00:34   │     │
│  │             Ready             │     │
│  └────────────────────────────────┘     │
│                                          │
│ [◀ Prev] [Next ▶] [✓ Complete]         │
├──────────────────────────────────────────┤
│                                          │
│ 📋 JSON Upload                           │
│ [Choose File...]                         │
│                                          │
│ [📊 Generate Graph]  (disabled/enabled) │
├──────────────────────────────────────────┤
│ Visualization Preview (inline):          │
│ [グラフプレビュー or "Ready when..."]    │
└──────────────────────────────────────────┘
```

### コンポーネント詳細

#### 1. 現在スピーチ表示

```typescript
// Display
`Current Speech: [${currentSpeechIndex}] ${DEBATE_SPEECHES[debateFormat][currentSpeechIndex]}`

// デフォルトスピーチ数（フォーマット別）
BP: 8 (Prop 1st/2nd/3rd, Opp 1st/2nd/3rd, Reply x2)
NA: 6 (Aff 1st/2nd, Neg 1st/2nd, Aff Reply, Neg Reply)
ASIAN: 8 (同 BP)
WSDC: 8 (同 BP)
HPDU: 8 (同 BP)
```

#### 2. 録音コントロール

**状態遷移**:
```
[START] (初期状態)
   ↓
[STOP] (録音中)
   ↓
[再生] [削除] [確定] (停止後)
```

**UI**:
- 開始ボタン: 🔴 START （赤色、大きい）
- 停止ボタン: ⏹ STOP （同じ位置に置き換わる）
- Duration 表示: リアルタイム更新（0:00 → 10:34）
- ステータス表示:
  - 初期: "Ready"
  - 録音中: "Recording..." (アニメーション)
  - 停止後: "Saved" ✓

**実装**:
- API: `useRecordings()` カスタムフック
- ファイル: `hooks/useRecordings.ts`
- MediaRecorder API 使用
- WebM 形式で記録
- localStorage に Blob 保存

#### 3. スピーチナビゲーション

```
[◀ Prev] | Speech 0/7 | [Next ▶]
```

- Prev ボタン: currentSpeechIndex を -1（最小 0）
- Next ボタン: currentSpeechIndex を +1（最大 7）
- Complete ボタン: 全スピーチ完了フラグを設定

#### 4. JSON ファイルアップロード

**目的**: 既存の ADU/反論 JSON をインポート

**UI**:
- ファイル入力: `<input type="file" accept=".json">`
- アップロードボタン: "📋 Upload JSON"
- エラー表示: バリデーションエラーをトースト表示

**処理フロー**:
1. ファイル選択
2. JSON パース
3. スキーマ検証
4. state に格納
5. グラフ再描画

#### 5. グラフ生成ボタン

**有効条件**:
- すべてのスピーチで音声が記録されている
- 試合 ID が入力されている
- 最低 2 スピーチ以上

**UI**:
- 無効時: グレーアウト + ツールチップ「すべてのスピーチを録音してください」
- 有効時: 青色、クリック可能
- クリック後: Loading スピナー表示 → API 呼び出し

**API 呼び出し**:
```typescript
POST /audio-to-debate-graph-batch
FormData: {
  round_name,
  debate_format,
  motion: (オプション),
  files: [Blob, Blob, ...],
  adu_model: localStorage('llmModel'),
  rebuttal_model: localStorage('llmModel'),
  call_llm_all_at_once: false
}
```

**成功時**: グラフデータを state に格納 → Visualization タブ自動切り替え

#### 6. グラフプレビュー（inline）

**表示内容**:
- 処理中: "処理中... (Step 3/6)"
- 準備中: "グラフをアップロードするか、音声ファイルで生成してください"
- 完成: 簡易グラフ表示（オプション）

---

## Tab 3: Visualization（グラフ表示・再生）

**目的**: 反論グラフを可視化し、ノードをクリックして音声再生

### UI レイアウト

```
┌──────────────────────────────────────────┐
│ Graph: round-bp-2025                    │
├──────────────────────────────────────────┤
│ [📊 Refresh] [IDs: OFF ▼] [🔊 Baseline] │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Prop1   Opp1   Prop2   Opp2      │   │
│  │   ●─────────●                    │   │
│  │   │╲       ╱│                    │   │
│  │   │ ╲     ╱ │                    │   │
│  │   ●  ×─×  ●                      │   │
│  │  Prop Reply                      │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
├──────────────────────────────────────────┤
│ Audio Player (統合)                     │
│ [◀] [▶] ├─────●──────────┤ 10:34 / 30:00 │
│                                          │
│ Prop1 ├─────●──────────────┤ (300秒中)  │
│ Opp1  ├─────────●──────────┤ (300秒中)  │
│ Prop2 ├────────────●───────┤ (300秒中)  │
└──────────────────────────────────────────┘
```

### コンポーネント詳細

#### 1. グラフキャンバス

**実装**: ReactFlow (`@xyflow/react`)

**ノード**:
- 青ノード（政府側）: Proposition, Govt, etc.
- 赤ノード（野党側）: Opposition, Opp, etc.
- グレーノード（背景）: POI, etc.
- サイズ: 60x60 px（カスタムノード）

**エッジ**:
- 政府側反論: 青線
- 野党側反論: 赤線
- 線幅: 2 px
- スムーズカーブ

**機能**:
- ズーム/パン: マウスホイール、ドラッグ
- ノードクリック: 対応する ADU の時刻から音声再生
- ノード ID 表示/非表示: トグルボタン

#### 2. ノード ID 表示切り替え

**UI**: ドロップダウン
```
IDs: [OFF ▼]  or  IDs: [ON ▼]
```

**機能**:
- OFF: ノードに番号表示なし
- ON: ノードに ADU ID を表示
- デフォルト: localStorage (`graph_show_node_ids`) から復元

#### 3. Refresh ボタン

**機能**:
- 最新のグラフ JSON を API から取得
- グラフを再描画

**API**:
```typescript
GET /rebuttal-graph/{match_name}?try_count={tryCount}
```

#### 4. 統合音声プレーヤー

**コンポーネント**: `UnifiedAudioPlayer.tsx`

**機能**:
- 全スピーチの音声を単一の time slider で制御
- グラフノードクリック → シークバー自動ジャンプ + 再生開始

**UI**:
```
[◀ 前へ] [▶ 再生] ├─────●──────────┤ 10:34 / 30:00

スピーチセグメント表示:
Prop1 ├─────●──────────────┤ (0:00-5:00 / 300秒)
Opp1  ├──────────●──────────┤ (5:00-10:00 / 300秒)
```

**時刻計算**:
```
ローカル時刻 (ADU の start_time) → グローバル時刻
グローバル時刻 = Σ(前スピーチ duration) + ローカル時刻

例: Opp1 ADU, start=40秒
    グローバル時刻 = (Prop1 duration 300秒) + 40秒 = 340秒
```

**実装**:
- ファイル: `components/UnifiedAudioPlayer.tsx`
- ユーティリティ: `utils/speechTimeline.ts`
  - `buildSpeechSegments()` - セグメント構築
  - `localToGlobalTime()` - ローカル → グローバル変換
  - `globalToLocalTime()` - グローバル → ローカル変換

---

## Other Pages

### Explore ページ（`/explore`）

**目的**: すべての試合グラフを閲覧

**UI**:
- 試合一覧（グリッド表示）
- 各試合カード：名前、形式、生成日、プレビュー
- クリック: グラフ詳細ページへ

### Dashboard ページ（`/dashboard`）

**目的**: YouTube 動画から試合データを生成

**主要機能**:
- 動画 URL 入力
- バックグラウンド処理ステータス表示
- 処理進捗（ダウンロード → 文字起こし → ADU → グラフ）

**ステータス値**:
```typescript
type BackgroundStepStatus =
  | 'not_in_queue'   // 未実行
  | 'in_queue'       // キューに登録（待機中）
  | 'processing'     // 処理中
  | 'done'           // 完了
```

### Landing ページ（`/landing`）

**目的**: アプリ紹介、ユーザーガイド

---

## 状態管理

### useState（Page Component）

```typescript
// Record ページ
const [roundName, setRoundName] = useState('');
const [debateFormat, setDebateFormat] = useState<DebateFormatType>('BP');
const [currentSpeechIndex, setCurrentSpeechIndex] = useState(0);
const [speechRecordings, setSpeechRecordings] = useState<SpeechRecordings>({});
  // { 0: Blob, 1: Blob, ... }
const [autoLoadedGraphData, setAutoLoadedGraphData] = useState<GraphData | null>(null);
const [tryCount, setTryCount] = useState<number | null>(null);
const [activeTab, setActiveTab] = useState<'dashboard' | 'audio' | 'visualization'>('audio');
```

### localStorage（永続化）

```typescript
// ユーザー設定
localStorage.debate_format = 'BP'
localStorage.debate_round_name = 'my-round-2025'
localStorage.record_active_tab = 'audio'
localStorage.graph_show_node_ids = 'false'

// ダッシュボード
localStorage.llmModel = 'gemini-2.5-flash'
localStorage.transcriptionModel = 'whisper-1'
localStorage.dashboardExecuteMode = 'auto'
```

### Context（グローバル）

```typescript
// 多言語対応
LanguageContext → useTranslation()
  t('record.current_speech')  // "Current Speech"
  t('record.record_button')   // "Start Recording"

// テーマ（ダークモード）
ThemeProvider → useTheme()
  theme: 'light' | 'dark'
  setTheme()
```

---

## カスタムフック

### useRecordings

**ファイル**: `hooks/useRecordings.ts`

**機能**:
- 音声録音（MediaRecorder API）
- localStorage への保存・読み込み
- duration 計測

**返り値**:
```typescript
{
  isRecording: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  getRecordings: (speechIndex: number) => Blob | undefined;
  deleteRecording: (speechIndex: number) => void;
}
```

### useDebateGraph

**ファイル**: `hooks/useDebateGraph.ts`

**機能**:
- グラフデータの管理
- API からのロード

### useGraphGeneration

**ファイル**: `hooks/useGraphGeneration.ts`

**機能**:
- グラフ生成 API 呼び出し
- 進捗表示

### useGraphNodeNavigation

**ファイル**: `hooks/useGraphNodeNavigation.ts`

**機能**:
- グラフノードクリック → 音声再生
- タイムシーク計算

---

## API 通信

### 音声系

```typescript
// 音声保存
POST /audio/save
  FormData: { round_name, speech_index, speech_name, file, duration }

// 試合の全音声取得
GET /audio/match/{match_name}
  Response: [{ filename, size, duration, ... }]

// グラフ取得
GET /rebuttal-graph/{match_name}?try_count={n}
  Response: { speeches: {...}, rebuttals: [...] }
```

### グラフ生成

```typescript
// 統合パイプライン
POST /audio-to-debate-graph-batch
  FormData: {
    round_name,
    debate_format,
    motion,
    files: [Blob, ...],
    adu_model,
    rebuttal_model,
    call_llm_all_at_once
  }
  Response: {
    status,
    results: {
      transcription_file,
      unified_adus_csv,
      rebuttal_graph,
      processing_time
    }
  }
```

### バックグラウンド処理

```typescript
// ダウンロード開始
POST /download-audio/{round_id}
  Body: { url, output_format }

// ステータス確認
GET /job-progress-background/{round_id}
  Response: { step_1a, step_1b, ... }

// 結果取得
GET /transcription-result?round_id={id}
  Response: { transcription, ... }
```

---

## エラーハンドリング

### トースト通知

```typescript
import { useToast } from 'react-hot-toast';

// 成功
toast.success('グラフが生成されました');

// エラー
toast.error('ファイルのアップロードに失敗しました');

// ローディング
const loading = toast.loading('処理中...');
toast.dismiss(loading);
```

### ネットワークエラー対応

```typescript
try {
  const response = await fetch(...);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  toast.error(`エラー: ${error.message}`);
  console.error(error);
}
```

---

## キーボードショートカット（将来実装）

| ショートカット | 機能 |
|---------------|------|
| Space | 再生/一時停止 |
| ← → | シーク（±5秒） |
| Ctrl+N | 新規ラウンド |
| Ctrl+S | グラフ保存 |

---

## レスポンシブデザイン

### ブレークポイント（Tailwind）

```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### モバイル対応（将来）

- タッチジェスチャー（ズーム、パン）
- 縦方向レイアウト最適化
- グラフの簡略表示

---

**最終更新**: 2026-02-06
