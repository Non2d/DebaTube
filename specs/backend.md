# Backend 仕様書

## nlp-service

### jobs テーブル

音声処理ジョブの状態を永続化するためのテーブルです。

カラム名          | データ型       | 制約                        | 説明
-----------------|---------------|-----------------------------|--------------------------------------------------------------------------
job_id           | VARCHAR(255)  | PRIMARY KEY                 | INDEX,ジョブID（例: speech_recognition_abc12345）
job_type         | ENUM          | NOT NULL                    | ジョブ種別（SPEECH_RECOGNITION, SPEAKER_DIARIZATION, SENTENCE_GENERATION）
audio_filename   | VARCHAR(255)  | NOT NULL, INDEX             | INDEX,音声ファイル名
file_path        | TEXT          | NULL                        | 音声ファイルの完全パス
round_id         | INT           | NULL, INDEX                 | INDEX,ラウンドID
status           | ENUM          | NOT NULL, DEFAULT 'PENDING' | ジョブ状態（PENDING, PROCESSING, COMPLETED, FAILED）
progress         | INT           | DEFAULT 0                   | 進捗率（0-100）
started_at       | DATETIME      | NULL                        | 最新トライの開始時刻（リトライ時に更新）
completed_at     | DATETIME      | NULL                        | 最新トライの完了時刻
created_at       | DATETIME      | NOT NULL                    | ジョブ作成時刻
updated_at       | DATETIME      | NOT NULL                    | 最終更新時刻
retry_count      | INT           | DEFAULT 0                   | リトライ回数
error_message    | TEXT          | NULL                        | エラーメッセージ
result_data      | JSON          | NULL                        | 処理結果データ

#### ジョブライフサイクル
1. **作成**: `status = 'PENDING'`, `created_at` 設定
2. **開始**: `status = 'PROCESSING'`, `started_at` 設定
3. **完了**: `status = 'COMPLETED'`, `completed_at` 設定, `result_data` 設定
4. **失敗**: `status = 'FAILED'`, `completed_at` 設定, `error_message` 設定
5. **リトライ**: `retry_count` インクリメント, `status = 'PENDING'` にリセット

### speech_recognition テーブル

Whisperモデルによる音声認識結果を格納するテーブルです。

カラム名         | データ型      | 制約           | 説明
-----------------|---------------|----------------|--------------------------------------------------
id               | INT           | PRIMARY KEY, AUTO_INCREMENT | レコードID
round_id         | INT           | NOT NULL       | ラウンドID
audio_filename   | TEXT          | NOT NULL       | 音声ファイル名
start            | FLOAT         | NULL           | 音声セグメントの開始時間（秒）
end              | FLOAT         | NULL           | 音声セグメントの終了時間（秒）
text             | TEXT          | NOT NULL       | 認識されたテキスト
created_at       | DATETIME      | NULL           | レコード作成日時

### speaker_diarization テーブル

Pyannoteモデルによる話者分離結果を格納するテーブルです。

カラム名         | データ型      | 制約           | 説明
-----------------|---------------|----------------|--------------------------------------------------
id               | INT           | PRIMARY KEY, AUTO_INCREMENT | レコードID
round_id         | INT           | NOT NULL       | ラウンドID
audio_filename   | VARCHAR(255)  | NOT NULL       | 音声ファイル名
start            | FLOAT         | NULL           | 話者セグメントの開始時間（秒）
end              | FLOAT         | NULL           | 話者セグメントの終了時間（秒）
speaker          | VARCHAR(50)   | NOT NULL       | 話者識別子（例: SPEAKER_00, SPEAKER_01）
created_at       | DATETIME      | NULL           | レコード作成日時

### sentences テーブル

音声認識と話者分離結果を統合した文レベルのデータを格納するテーブルです。

カラム名         | データ型      | 制約           | 説明
-----------------|---------------|----------------|--------------------------------------------------
id               | INT           | PRIMARY KEY, AUTO_INCREMENT | レコードID
round_id         | INT           | NOT NULL       | ラウンドID
audio_filename   | VARCHAR(255)  | NOT NULL       | 音声ファイル名
start            | FLOAT         | NULL           | 文の開始時間（秒）
end              | FLOAT         | NULL           | 文の終了時間（秒）
speaker          | VARCHAR(50)   | NOT NULL       | 話者識別子
text             | TEXT          | NOT NULL       | 文のテキスト内容
created_at       | DATETIME      | NULL           | レコード作成日時

## データベース設定

- **データベース**: MySQL
- **ポート**: 3307
- **データベース名**: nlp
- **文字セット**: utf8

## データフロー

1. **音声ファイル処理開始** - JobManagerがジョブを作成し`jobs`テーブルに記録
2. **音声認識処理** - Whisperモデルが音声を認識し`speech_recognition`テーブルに保存
3. **話者分離処理** - Pyannoteモデルが話者を識別し`speaker_diarization`テーブルに保存
4. **文生成処理** - 上記2つのデータを統合し`sentences`テーブルに保存