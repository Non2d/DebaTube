# Term Definition
## Speech Recognition
- 概要：音声ファイルから抽出された文字起こしデータで，話者情報が含まれないもののリスト．文字起こしは単語単位で含まれる．
- 構造：[{start, end, word}]

## Speaker Diarization
- 概要：音声ファイルから抽出された話者データで，文字起こしデータが含まれないもののリスト．
- 構造：[{start, end, speaker}]

## Word Transcript
- 概要：Speech RecognitionとSpeaker Diarizationを組み合わせたデータのリスト
- 構造：[{speaker, start, end, word}]

## Sentence Transcript
- 概要：Word Transcriptionを文ごとにグルーピングしたもの．最初の単語のstartをstart，最後の単語のendをendとする．
- 構造：[{speaker, start, end, sentence}]

#