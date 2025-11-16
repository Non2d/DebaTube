実装された機能のまとめ

  1. 音声文字起こし
  - /audio-to-text - 単一ファイル
  - /audio-to-text-batch - 複数ファイル（非同期並列処理）

  2. ADU変換
  - /transcript-to-adu - Whisper JSONから直接ADU変換
    - Gemini 2.5 Proで処理
    - JSON + CSVで自動保存

  3. CSV変換ツール
  - /adu-json-to-csv - ログファイルから手動確認用CSV生成
    - Markdown形式対応
    - 複数フォーマット自動判定

  保存先：
  - 文字起こし: transcriptions/
  - ADU JSON: logs/
  - ADU CSV: transcriptions/adus/