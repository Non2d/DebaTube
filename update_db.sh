#!/bin/bash

echo "Starting safe migration process..."

# 0. Generate shared timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
echo "Using timestamp: $TIMESTAMP"

# 1. Generate migration file first (check for changes)
echo "Checking for changes..."
docker compose exec fastapi python -m alembic revision --autogenerate -m "update_$TIMESTAMP"

# 2. Check if a new migration file was created
# The file will be in fastapi/main-service/app/alembic/versions/update_${TIMESTAMP}_*.py
# We check via local file system.
GENERATED_FILE=$(find fastapi/main-service/app/alembic/versions -name "update_${TIMESTAMP}_*.py")

if [ -z "$GENERATED_FILE" ]; then
    echo "✅ No changes detected. Database is up to date. (No backup sql or update python file created)"
    exit 0
else
    echo "⚠️ Changes detected. Migration file created: $GENERATED_FILE"
fi

# 3. If changes detected, run backup
echo "Running backup..."
./backup_db.sh "$TIMESTAMP"

if [ $? -ne 0 ]; then
    echo "❌ Backup failed! Aborting migration."
    # Optional: Delete the generated migration file if backup fails?
    # rm "$GENERATED_FILE"
    exit 1
fi
echo "✅ Backup completed successfully."

# 4. Run Alembic migration (apply changes to DB)
echo "Running alembic upgrade head..."
docker compose exec fastapi python -m alembic upgrade head

if [ $? -eq 0 ]; then
    echo "✅ Update completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi
