#!/bin/bash

echo "Starting safe migration process..."

# 1. Run backup
./backup_db.sh

if [ $? -ne 0 ]; then
    echo "❌ Backup failed! Aborting migration."
    exit 1
fi

echo "✅ Backup completed successfully."

# 2. Run Alembic migration
echo "Running alembic upgrade head..."
docker compose exec fastapi alembic upgrade head

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi
