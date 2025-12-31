#!/bin/bash

# バックアップ保存用ディレクトリの作成
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# タイムスタンプの取得 (YYYYMMDD_HHMMSS)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# バックアップ実行
# docker-compose.ymlによるとパスワードは空(MYSQL_ALLOW_EMPTY_PASSWORD: 'yes')なのでパスワード引数は不要か空でおｋ
# しかしmysqldumpコマンドでパスワードなしの場合は -p オプション自体を省略するか、空パスワードを指定する
echo "Backing up database 'debate' to $FILENAME ..."
docker compose exec -T db mysqldump -u root debate > "$FILENAME"

if [ $? -eq 0 ]; then
  echo "Backup successful: $FILENAME"
else
  echo "Backup failed!"
  # 失敗した場合は空ファイルを削除
  rm -f "$FILENAME"
  exit 1
fi
