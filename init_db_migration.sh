#!/bin/bash

# 既存のDBに対してAlembicのバージョン管理を「最新」としてマークする（初回のみ使用）
# これを実行することで、既存のテーブルに対して CREATE TABLE しようとしてエラーになるのを防ぐ
# 誤って適用した場合，docker compose exec fastapi python -m alembic stamp <Revision ID> で特定のバージョンに戻せる
echo "Stamping Alembic HEAD..."
docker compose exec fastapi python -m alembic stamp head

if [ $? -eq 0 ]; then
    echo "✅ Database stamped as HEAD successfully!"
else
    echo "❌ Failed to stamp database."
    exit 1
fi
