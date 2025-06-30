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

## Main Component Categories

### shared
- **Header.tsx**: 全ページ共通のヘッダーコンポーネント．`components/shared/Header.tsx`にある．

## State Management
- **Jotai**: 状態管理の変数．`components/store/userAtom.ts`にある．

## UI Components
- **Shadcn/ui**: `components/ui/`にある．
  - 現時点で`button.tsx`や`tabs.tsx`を導入済み．
