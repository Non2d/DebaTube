# Phase 0: 環境構築 - 詳細手順書

**目標**: Go/Flutter/PostgreSQL の開発環境を完成させ、空のプロジェクト構造を作成
**予定期間**: 1 週間（Week 1）
**検証方法**: 各ツール単体の動作確認

---

## 前提条件チェック

実装前に以下を確認してください：

- [ ] macOS / Windows / Linux いずれかのマシン
- [ ] インターネット接続（パッケージダウンロード）
- [ ] 管理者権限（Docker, Flutter インストール）
- [ ] Git インストール済み
- [ ] 4GB 以上の空きディスク容量
- [ ] Apple Developer Account（iOS テスト用）

**Windows 専用注意**:
- WSL 2 推奨（Docker Desktop 実行のため）
- Visual Studio Build Tools インストール

---

## 1. Go 開発環境セットアップ

### 1.1 Go インストール

**macOS**:
```bash
brew install go

# 確認
go version  # go version go1.21.x darwin/amd64
```

**Windows**:
1. [golang.org/dl](https://golang.org/dl) から Go 1.21+ をダウンロード
2. インストーラを実行
3. PowerShell で確認:
```powershell
go version
```

**Linux (Ubuntu)**:
```bash
sudo apt-get update
sudo apt-get install golang-go

go version
```

### 1.2 GOPATH 設定

```bash
# ~/.bashrc または ~/.zshrc に追加
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin

# 反映
source ~/.bashrc
```

**Windows**:
1. 環境変数で `GOPATH = C:\Users\YourName\go` を設定
2. PowerShell 再起動

### 1.3 IDE セットアップ（VSCode）

```bash
# 1. VSCode Go 拡張をインストール
#    VSCode → Extensions → "Go" (golang.go) をインストール

# 2. Go Tools をインストール
#    VSCode → Cmd+Shift+P → "Go: Install/Update Tools" → All
```

### 1.4 プロジェクト初期化

```bash
# 新規プロジェクト
mkdir -p ~/work/DebateVizGoAPI
cd ~/work/DebateVizGoAPI

# Go モジュール初期化
go mod init github.com/yourusername/DebateVizGoAPI

# ディレクトリ構造作成
mkdir -p cmd/server internal/{handler,service,repository,models,config,logger} tests

# main.go 作成
cat > cmd/server/main.go << 'EOF'
package main

import (
    "fmt"
)

func main() {
    fmt.Println("Hello, DebateViz Go API!")
}
EOF

# 実行確認
go run cmd/server/main.go
# 出力: Hello, DebateViz Go API!
```

---

## 2. Flutter 開発環境セットアップ

### 2.1 Flutter SDK インストール

**macOS**:
```bash
# Homebrew でインストール
brew install flutter

# または手動インストール
cd ~/
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:$HOME/flutter/bin"
```

**Windows**:
1. [flutter.dev/docs/get-started/install/windows](https://flutter.dev/docs/get-started/install/windows) にアクセス
2. Flutter SDK をダウンロード（.zip）
3. `C:\src\flutter` に展開
4. `flutter\bin` を PATH に追加（環境変数）
5. PowerShell 再起動

**Linux**:
```bash
sudo apt-get install git curl
cd ~/
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:$HOME/flutter/bin"
```

### 2.2 Flutter doctor で確認

```bash
flutter doctor

# 出力例:
# Doctor summary (to see all details run flutter doctor -v):
# [✓] Flutter (Channel stable, 3.13.x, ...)
# [✓] Android toolchain - develop for Android devices
# [✓] Xcode - develop for iOS and macOS
# [✓] VS Code (version 1.84)
# [✗] Android Studio (not installed)  ← オプション
```

**iOS 対応（Mac のみ）**:
```bash
# Xcode Command Line Tools インストール（まだなら）
xcode-select --install

# CocoaPods インストール
sudo gem install cocoapods

# 確認
flutter doctor --ios
```

**Android 対応（全プラットフォーム）**:
```bash
# Android Studio インストール推奨
# または Android SDK コマンドラインツール

# sdk root を設定
echo "export ANDROID_HOME=$HOME/Library/Android/sdk" >> ~/.bashrc
echo "export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin" >> ~/.bashrc
```

### 2.3 エミュレータセットアップ

**iOS (macOS)**:
```bash
# Xcode シミュレータが自動的に利用可能
flutter emulators
flutter emulators --launch apple_ios_simulator
```

**Android（全プラットフォーム）**:
```bash
# Android Studio から AVD Manager を開く
# または CLI で:
flutter emulators --launch Pixel_4_API_30
```

### 2.4 プロジェクト初期化

```bash
# 新規 Flutter プロジェクト
flutter create --org com.debateviz DebateVizFlutter
cd DebateVizFlutter

# プロジェクト構造
tree -L 2
# DebateVizFlutter/
# ├── lib/
# │   └── main.dart
# ├── test/
# ├── android/
# ├── ios/
# ├── pubspec.yaml
# └── README.md

# 実行確認
flutter run

# または IDE から
flutter pub get
# VSCode → Run → Run Without Debugging
```

---

## 3. PostgreSQL セットアップ

### 3.1 Docker のインストール

**macOS**:
```bash
brew install docker docker-compose

# または Docker Desktop インストール
# https://www.docker.com/products/docker-desktop
```

**Windows**:
1. [docker.com](https://www.docker.com/products/docker-desktop) から Docker Desktop をダウンロード
2. インストーラを実行（WSL 2 バックエンド推奨）
3. PowerShell で確認:
```powershell
docker --version
docker-compose --version
```

**Linux**:
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose

sudo usermod -aG docker $USER  # sudo なしで実行
newgrp docker
```

### 3.2 PostgreSQL Docker コンテナ起動

**docker-compose.yml 作成**:
```yaml
# ~/work/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: debateviz_postgres
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: ""
      POSTGRES_DB: debate
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U root"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**起動**:
```bash
docker-compose up -d

# 確認
docker ps
# CONTAINER ID   IMAGE                PORTS
# xxxxx          postgres:15-alpine   0.0.0.0:5432->5432/tcp
```

### 3.3 PostgreSQL に接続

**CLI ツール（psql）インストール**:
```bash
# macOS
brew install postgresql

# Windows （PostgreSQL バイナリから psql のみ抽出）
# またはいらん

# Linux
sudo apt-get install postgresql-client
```

**接続テスト**:
```bash
psql -h localhost -U root -d debate

# プロンプトが出れば OK
# postgres#

# 終了
\q
```

### 3.4 初期スキーマ作成（後で詳細化）

```bash
# ダミースキーマ作成（Phase 4 で本格実装）
psql -h localhost -U root -d debate << 'EOF'

CREATE TABLE rounds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

\dt  -- テーブル確認
EOF
```

---

## 4. GitHub リポジトリ分割

### 4.1 新規リポジトリ作成

**GitHub 上で**:
1. [github.com/new](https://github.com/new) にアクセス
2. `DebateVizGoAPI` リポジトリを作成
3. `DebateVizFlutter` リポジトリを作成

### 4.2 ローカルリポジトリ初期化

```bash
# Go プロジェクト
cd ~/work/DebateVizGoAPI
git init
git remote add origin https://github.com/yourusername/DebateVizGoAPI.git
git add .
git commit -m "Initial commit: Go project structure"
git push -u origin main

# Flutter プロジェクト
cd ~/work/DebateVizFlutter
git init
git remote add origin https://github.com/yourusername/DebateVizFlutter.git
git add .
git commit -m "Initial commit: Flutter project structure"
git push -u origin main
```

---

## 5. 開発環境統合

### 5.1 ワークスペース設定（VSCode）

**settings.json**:
```json
{
  "go.useLanguageServer": true,
  "go.lintOnSave": "package",
  "[go]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.organizeImports": true
    }
  },
  "dart.sdkPath": "/Users/yourusername/flutter/bin/cache/dart-sdk",
  "dart.flutterSdkPath": "/Users/yourusername/flutter",
  "[dart]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.dart": true
    }
  }
}
```

### 5.2 Git Hooks セットアップ

**`.pre-commit-config.yaml`** （Go）:
```yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v1.54.0
    hooks:
      - id: golangci-lint
```

**インストール**:
```bash
brew install pre-commit

cd ~/work/DebateVizGoAPI
pre-commit install
```

---

## 6. 依存パッケージ初期導入

### 6.1 Go パッケージ

```bash
cd ~/work/DebateVizGoAPI

# Fiber（HTTP フレームワーク）
go get -u github.com/gofiber/fiber/v3

# GORM（ORM）
go get -u gorm.io/gorm
go get -u gorm.io/driver/postgres

# PostgreSQL ドライバー
go get -u github.com/lib/pq

# ログ
go get -u github.com/sirupsen/logrus

# 設定
go get -u github.com/joho/godotenv

# 外部 API
go get -u github.com/openai/openai-go
go get -u github.com/google/generative-ai-go/genai

# go.mod に追加されたか確認
go mod tidy
cat go.mod
```

### 6.2 Flutter パッケージ

```bash
cd ~/work/DebateVizFlutter

# pubspec.yaml に追加
cat >> pubspec.yaml << 'EOF'

  # 音声関連
  record: ^4.4.3
  permission_handler: ^11.4.3
  just_audio: ^0.9.0

  # HTTP 通信
  dio: ^5.0.0

  # 状態管理
  provider: ^6.0.0
  getx: ^4.6.0

  # UI
  intl: ^0.19.0
  flutter_localizations:
    sdk: flutter

dev_dependencies:
  integration_test:
    sdk: flutter
  flutter_test:
    sdk: flutter
EOF

# 依存をダウンロード
flutter pub get

# 確認
cat pubspec.lock | head -20
```

---

## 7. 環境変数設定

### 7.1 Go 用 .env ファイル

**`~/work/DebateVizGoAPI/.env`**:
```
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=root
POSTGRES_PASSWORD=
POSTGRES_DATABASE=debate

# OpenAI API
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Gemini API
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ログレベル
LOG_LEVEL=debug

# サーバー設定
SERVER_PORT=8000
ENVIRONMENT=development
```

### 7.2 Flutter 用設定

**`lib/config/api_config.dart`**:
```dart
const class ApiConfig {
  static const String baseUrl = 'http://localhost:8000';
  static const Duration timeout = Duration(seconds: 30);
  static const bool debugLogging = true;
}
```

---

## 8. 初期テスト・ビルド

### 8.1 Go サーバー ビルド・実行

```bash
cd ~/work/DebateVizGoAPI

# main.go を更新（Fiber サーバー）
cat > cmd/server/main.go << 'EOF'
package main

import (
    "github.com/gofiber/fiber/v3"
    "log"
)

func main() {
    app := fiber.New()

    app.Get("/health", func(c fiber.Ctx) error {
        return c.JSON(fiber.Map{
            "status": "ok",
            "message": "DebateViz API is running",
        })
    })

    log.Fatal(app.Listen(":8000"))
}
EOF

# 実行
go run cmd/server/main.go

# 別ターミナルでテスト
curl http://localhost:8000/health
# {"status":"ok","message":"DebateViz API is running"}
```

### 8.2 Flutter アプリ ビルド・実行

```bash
cd ~/work/DebateVizFlutter

# 既存 main.dart で実行
flutter run -v

# iOS シミュレータ（macOS）
flutter run -d iPhone_15

# Android エミュレータ
flutter run -d Pixel_4_API_30
```

### 8.3 PostgreSQL テーブル確認

```bash
psql -h localhost -U root -d debate

\dt  -- テーブル一覧
\d rounds  -- rounds テーブルの詳細
\q  -- 終了
```

---

## 9. 検証チェックリスト

### 環境構築完了確認

- [ ] **Go**
  - [ ] `go version` で 1.21+ が表示される
  - [ ] `go run cmd/server/main.go` で HTTP サーバー起動可能
  - [ ] `curl http://localhost:8000/health` で JSON レスポンス

- [ ] **Flutter**
  - [ ] `flutter doctor` で問題なし（✓ のみ）
  - [ ] `flutter run` でエミュレータアプリ起動可能
  - [ ] Hot reload/hot restart が動作

- [ ] **PostgreSQL**
  - [ ] `docker ps` で postgres コンテナ running
  - [ ] `psql -h localhost -U root -d debate` で接続可能
  - [ ] `\dt` でテーブル確認可能

- [ ] **Git**
  - [ ] `DebateVizGoAPI` リポジトリに初期コミット
  - [ ] `DebateVizFlutter` リポジトリに初期コミット

- [ ] **IDE**
  - [ ] VSCode で Go ファイル編集で自動フォーマット
  - [ ] VSCode で Dart ファイル編集で自動フォーマット

---

## 10. トラブルシューティング

### Go

| 問題 | 解決策 |
|------|--------|
| `go: command not found` | PATH に `$GOPATH/bin` を追加 |
| `go mod` エラー | `go mod init` で モジュール初期化 |
| Fiber インポート失敗 | `go mod tidy` で依存を解決 |

### Flutter

| 問題 | 解決策 |
|------|--------|
| `flutter: command not found` | PATH に `flutter/bin` を追加 |
| `flutter doctor` エラー | 公式ドキュメント参照（ツール別）|
| iOS ビルド失敗 | `pod repo update` で CocoaPods 更新 |
| Android ビルド失敗 | `flutter clean` して再実行 |

### PostgreSQL

| 問題 | 解決策 |
|------|--------|
| `docker: command not found` | Docker Desktop インストール |
| コンテナ起動失敗 | `docker logs debateviz_postgres` でエラー確認 |
| psql 接続失敗 | ポート 5432 が既に使用されていないか確認 |

---

## 11. 次のステップ（Phase 1 へ）

Phase 0 が完了したら、以下は自動的に Phase 1 へ進みます：

```
Phase 0: 環境構築 ✓
    ↓
Phase 1: Flutter 音声録音 MVP
    ├─ recording_service.dart 実装
    ├─ 許可リクエスト UI
    ├─ 録音ボタン
    └─ 既存バックエンド連携
```

---

**作成日**: 2026-02-06
**検証者**: 環境構築完了時
