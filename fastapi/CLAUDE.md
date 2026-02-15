グラフ作成ボタンの挙動

０．音声ファイルをaudio-save/{round_id}に作成する．webm形式．また，同名のjsonファイルにおもにdurationを保存することを目的としてデータを登録する．
１．音声をwhisperで文字起こしして，app/transcriptions/results_{round_id}/batch_transcription_{timestamp}.jsonをつくる．
- 文字起こしはスピーチ事に行われていることから，以下のような形式となる．
{
    "Proposition_1st": {
    "date_transcribed": "2025-12-05_174239",
    "duration": 316.79998779296875,
    "language": "english",
    "text": "text",
    "segments": null,
    "usage": {
      "seconds": 317.0,
      "type": "duration"
    },
    "words": [
      {
        "end": 1.8200000524520874,
        "start": 1.0199999809265137,
        "word": "First"
      },
      {
        "end": 1.8200000524520874,
        "start": 1.0199999809265137,
        "word": "Second"
      },...
    ],
    "task": "transcribe"
  },
  "Opposition_1st": {
    "date_transcribed": "2025-12-05_175243",
    "duration": 543.1199951171875,
    "language": "english",
    ...
  }
}
２．この文字起こしデータからルールベースの文分割を行い，各文にindexを付与する．さらにその文単位のタイムスタンプ付き文字起こしデータをLLMに渡してADU（議論的談話ユニット）単位にグルーピングし，その結果をまずapp/transcriptions/results_{round_id}/adus/にスピーチごとにわけてcsvとして保存する．つまり，ADUは文1~文3, 文4~文7...のような，文をトピックごとにまとめなおしたデータである．
３．２．でスピーチごとに保存したADUのcsvをまとめてひとつのcsvにしたものを，app/transcriptions/results_{round_id}に保存する．
- このcsvの構造は，position(Prop_1stなど),id(全スピーチで共通で連番となっているaduの番号),start_sentence_index,end_sentence_index,text,role,start_time,end_timeとなっている
４．このcsvから，LLMの反論判定のプロンプト用に以下のようなmd形式でADUを平文に直したものを出力する
- ## Proposition_1st
- id:1, I think that ~~~ 
- id:2, Therefore, ~~~
- ## Opposition_1st
- id:3, I deny ~~~
５．４．で作成したmdを入力して，LLMに反論判定を行わせる．結果は[[反論1の反論元のADUのid, 反論1の反論先のADUのid], [反論2の反論元のADUのid, 反論2の反論先のADUのid], ...]といった形式である．
６．３．のADU情報と５．の反論情報を統合して，以下の構造の反論グラフjsonデータを作成する．なお，ここからわかるようにタイムスタンプは下一桁でまとめなおしている．
{
  "speeches": {
    "Proposition_1st": [
      {
        "id": 1,
        "type": "introduction",
        "text": "First, some setup, ...",
        "start": 1.0
      },
      {
        "id": 2,
        "type": "definition",
        "text": "So what is environmental disaster?...",
        "start": 5.8
      },
      ...
    ],
    "Opposition_1st": [
        {}
    ]
  },
  "rebuttals": [
    [
      22,
      16
    ],
    [
      28,
      16
    ],
    ...
  ]
}