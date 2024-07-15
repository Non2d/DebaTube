# Debate Vizualization System

## 基礎論文
https://dl.nkmr-lab.org/papers/498

## デモ動画

[![DebateVizSystem_Youtube_Link](https://github.com/user-attachments/assets/06283ef3-4071-4a8b-96ef-449d2e996478)](https://youtu.be/ybbw3yxqi90)

## 概要

競技ディベートの録音を送信→自動で反論構造を可視化するWebアプリです。

## 使用方法

- 音声入力

## 動作環境

- **対応ブラウザ**: Chrome, Firefoxでの動作を確認しています。
- **注意事項**: お手元のブラウザで使用するためには、OpenAI API Keyを環境変数に設定していただく必要があります。

## 起動方法

- git clone

OpenAI API(gpt-4oモデル)を使用する場合(有料)
- backend/.env.exampleのファイル名を.envに変更し、OPENAI_API_KEYを追加してください。
- cd backend -> python main.py

Groq API(llama3-70b-8192モデル)を使用する場合(無料)
- https://console.groq.com/playground こちらからGroq API Keyを取得してください。
- backend/.env.exampleのファイル名を.envに変更し、GROQ_API_KEYを追加してください。
- cd backend -> python main-groq.py

- (VSCodeを使用している場合) index.htmlをLive Serverで開いて下さい

## 技術
- コンテナ:Docker
- フロントエンド:Next.js
- バックエンド:FastAPI, OpenAI API
- データベース:MySQL, phphMyAdmin
- 音声認識:Whisper API

## 是非試してください！
