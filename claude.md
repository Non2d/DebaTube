# DebateViz システム構成ドキュメント

## ディレクトリ構造

```
DebateVizSystem/
├── fastapi/main-service/app/
│   ├── audio-save/              # 音声ファイルが保存される場所
│   │   └── {match_name}/        # 試合ID ごとのディレクトリ
│   │
│   ├── transcriptions/          # 文字起こしと処理結果
│   │   ├── adus/                # ADU, グラフデータ（旧形式）
│   │   │   ├── {数字}_{speech_name}_*.csv    # 個別スピーチの ADU
│   │   │   ├── unified_adus_*.csv            # 統合 ADU
│   │   │   ├── unified_adus_*.md             # Markdown 形式
│   │   │   └── rebuttal_graph_*.json         # 反論グラフ（最新）
│   │   │
│   │   ├── results_{match_name}/  # 新形式の結果フォルダ
│   │   │   ├── batch_transcription_*.json
│   │   │   ├── unified_adus_*.csv
│   │   │   ├── unified_adus_*.md
│   │   │   └── rebuttal_graph_*.json
│   │   │
│   │   ├── batch_transcription_*.json
│   │   └── test/
│   │
│   ├── logs/                    # ログファイル
│   │
│   └── routers/
│       ├── audio2adu.py         # API エンドポイント
│       ├── audio_save.py        # 音声保存関連
│       └── ...
│
└── next/app/record/page.tsx     # フロントエンド
```

## 重要な API エンドポイント

### 音声処理
- `POST /audio/save` - 音声ファイル保存
- `GET /audio/match/{match_name}` - 試合の全音声ファイル取得（.webm と .mp3 対応）
- `GET /audio/file/{match_name}/{filename}` - 個別ファイル取得

### グラフ生成
- `POST /audio-to-transcript-batch` - 音声 → 文字起こし
- `POST /transcript-to-adu-batch` - 文字起こし → ADU
- `POST /identify-rebuttal-structure` - ADU → 反論グラフ
- **`POST /audio-to-debate-graph-batch`** - 統合エンドポイント（全処理一気）
  - 結果は `transcriptions/results_{match_name}/` に保存

### グラフ取得
- **`GET /rebuttal-graph/{match_name}`** - 試合のグラフ JSON 取得
  - 検索順序：
    1. `transcriptions/results_{match_name}/rebuttal_graph_*.json`（新形式）
    2. `transcriptions/adus/rebuttal_graph_*.json`（旧形式・最新）

## ファイル名フォーマット

### 音声ファイル（audio-save）
```
{match_name}/
├── {speech_index}_{speech_name}_{sequence}.webm
├── {speech_index}_{speech_name}_{sequence}.mp3
├── {speech_index}_{speech_name}_{sequence}.json  # メタデータ
└── Opposition_1st-2025-11-16.mp3  # 直接追加時の形式
```

### ADU/グラフファイル（transcriptions）
```
unified_adus_{debate_format}_{timestamp}.csv
unified_adus_{debate_format}_{timestamp}.md
rebuttal_graph_{timestamp}.json
batch_transcription_{timestamp}.json
```

## フロントエンド - Record ページのタブ

### Home タブ
- 音声録音機能
- グラフ生成ボタン（全ファイル揃った時のみ有効）
- JSON ファイルアップロード
- グラフ可視化
- **試合ID の変更可能**

### Feedback (Baseline) タブ
- 音声カードのみ表示
- 録音機能なし
- グラフなし
- Home で指定された試合IDを参照

### Feedback (Ctrl) タブ
- 音声カード表示
- グラフ可視化
- 録音機能なし
- Home で指定された試合IDから自動でグラフをロード
  - API: `GET /rebuttal-graph/{match_name}`

## MP3 ファイル対応

- Whisper API レベル：MP3 対応済み
- フロントエンド録音：WebM のみ（ブラウザ制限）
- 直接アップロード：MP3 対応（ファイル名形式は統一推奨）
- Duration 取得：MP3 の場合はクライアント側で自動検出（Audio 要素使用）

## グラフデータ構造

```json
{
  "speeches": {
    "speech_key": [
      {
        "id": 1,
        "type": "introduction|definition|independent_rebuttal|point_of_main_argument|point_of_comparison|poi",
        "text": "...",
        "start": 0.0
      }
    ]
  },
  "rebuttals": [
    [rebutting_id, rebutted_id],
    ...
  ]
}
```

## グラフのノードクリック機能

**Feedback (Ctrl) タブ限定**：
- グラフのノードをクリック → 対応するスピーチの音声が start_time から再生
- 実装：
  - `RebuttalGraph.tsx`: `onNodeClick` コールバック
  - `record/page.tsx`: `handleGraphNodeClick` ハンドラー

**フロー**:
1. ノードクリック → nodeId と startTime を取得
2. nodeId からスピーチキーを逆引き（speeches オブジェクトから）
3. スピーチキーから speech_index を検索
4. speechRecordings[speech_index] から音声 Blob を取得
5. Audio 要素で currentTime = startTime に設定して再生

## よくある落とし穴

1. **グラフ JSON の場所**
   - 検索順序：
     1. `audio-save/{match_name}/rebuttal_graph_*.json` ←主要
     2. `transcriptions/results_{match_name}/`
     3. `transcriptions/adus/` ←旧形式

2. **音声ファイルの場所**
   - API 保存：`audio-save/{match_name}/`
   - メタデータ JSON も一緒に保存される

3. **試合IDの管理**
   - Home タブでのみ変更可能
   - Baseline/Ctrl タブではその試合IDの情報を参照

4. **ノードID と speechKey の対応**
   - ノードID は sequence_id（グローバルID）
   - speeches オブジェクトで逆引きして speech_key を取得
   - speech_key を DEBATE_SPEECHES で検索して speech_index を得る

## 統合音声再生機能（Feedback タブ）

### 新機能：UnifiedAudioPlayer
- Feedback (Baseline) と Feedback (Ctrl) タブで，すべてのスピーチの音声を順序通りに統合・再生
- 単一のシークバーで全スピーチを管理
- 複数の音声ファイルがある場合は自動的に繋ぎ合わせて連続再生

### グラフノードクリック時の時刻計算
- **Ctrl タブ限定**：グラフのノードをクリック → 統合シークバーが自動ジャンプ
- 計算ロジック：
  1. ノードの speechIndex とローカル start_time を特定
  2. 該当スピーチより前のスピーチの duration を累積
  3. 累積値 + ローカル start_time = グローバル時刻
  - 例：Prop1 duration=300秒, Opp1 node start=20秒 → global=320秒

### 実装ファイル
- `app/record/utils/speechTimeline.ts` - タイムライン管理ユーティリティ
- `app/record/components/UnifiedAudioPlayer.tsx` - 統合再生コンポーネント
  - なんでか1bf2dbdで計画立てたのに消えてるけど，/Users/electra/.claude/plans/fuzzy-rolling-micali.mdに新たに作り直した実装方針があるらしい
- `app/record/page.tsx` - Baseline/Ctrl タブでの統合

### 注意事項
- **Docker ビルドのエラー：** `npm run build` を実行するとDocker側でCSS が消えて生HTML になる問題が報告されている。TypeScript のチェックは行わず，直接動作確認すること
