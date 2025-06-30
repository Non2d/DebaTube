# Next.js Application Specifications

## Page Structure

### 1. ルートページ (`/`, `/explore`)
- **機能**: ディベートの反論構造の可視化をもとに動画探索できる
- **補足**: 他者のディベート試合から参考になるものを探すことが目的

### 2. ランディングページ (`/landing`)
- **機能**: システムの概要説明

### 3. ダッシュボード(`/dashboard`)
- **機能**:
  - ディベート動画のURLまたは直接録音したデータから，wav形式の音声ファイルをサーバーのストレージに保存
  - 音声ファイルのパスをデータベースに保存
  - 音声ファイルの存在が検証され次第，バックグラウンドで文字起こし・文整形・ADU判定，話者分離・スピーチ判定，反論判定を順次行う．

## Main Frontend Modules

### State Management
- **Jotai**: 状態管理の変数．`components/store/userAtom.ts`にある．

### UI Components
- **Shadcn/ui**: `components/ui/`にある．
  - 現時点で`button.tsx`や`tabs.tsx`を導入済み．

## Services

現在，FastAPIによるマイクロサービスを二つ開発している．

### main-service
- 反論の可視化グラフやダッシュボードの情報など，UIの表示に必要なデータ処理を扱うサービス
- VPS上で常時稼働している．
- 将来的にGoへの移行を検討している．

### nlp-service
- 文字起こしや反論判定など，負荷が重い処理や有償の外部APIを活用した自然言語処理を中心に扱うサービス．
- データ登録・編集にのみ用いられるため，常時稼働しているわけではない
