#!/bin/bash

echo "Starting safe migration process..."

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
echo "Using timestamp: $TIMESTAMP"

# 0. Check for Pending Remote Migrations (Conflict Prevention)
echo "Checking for pending remote migrations..."
CURRENT_REV=$(docker compose exec fastapi python -m alembic current 2>/dev/null | grep -v "INFO" | tr -d ' \r\n' | cut -d'(' -f1)
HEAD_REV=$(docker compose exec fastapi python -m alembic heads 2>/dev/null | grep -v "INFO" | tr -d ' \r\n' | cut -d'(' -f1)

# Handle case where multiple heads might exist (simplified) or if output is messy
if [ "$CURRENT_REV" != "$HEAD_REV" ]; then
    echo "⚠️ Local DB ($CURRENT_REV) is not at head ($HEAD_REV). Remote migrations detected."
    
    # Backup before applying remote changes
    echo "Running backup before syncing..."
    ./backup_db.sh "${TIMESTAMP}_sync"
    
    if [ $? -ne 0 ]; then
        echo "❌ Backup failed! Aborting sync."
        exit 1
    fi
    echo "✅ Backup completed."

    echo "Syncing DB to head..."
    docker compose exec fastapi python -m alembic upgrade head
    if [ $? -ne 0 ]; then
        echo "❌ Sync failed! Please resolve conflicts manually."
        exit 1
    fi
    echo "✅ DB synced to latest version."
else
    echo "✅ Local DB is already at head. Proceeding to check for local changes."
fi

# 1. Generate migration file first (check for changes)
echo "Checking for changes..."
docker compose exec fastapi python -m alembic revision --autogenerate -m "update_$TIMESTAMP"

# 2. Check if a new migration file was created
# The file will be in fastapi/main-service/app/alembic/versions/update_${TIMESTAMP}_*.py
GENERATED_FILE=$(find fastapi/main-service/app/alembic/versions -name "update_${TIMESTAMP}_*.py")

if [ -z "$GENERATED_FILE" ]; then
    echo "✅ No migration file newly created. Models are in sync with the latest head."
    # Exit without backup or upgrade as requested
    exit 0
else
    echo "⚠️ Changes detected. Migration file newly created: $GENERATED_FILE"
fi

# 3. If changes detected, run backup FIRST
echo "Running backup..."
./backup_db.sh "$TIMESTAMP"

if [ $? -ne 0 ]; then
    echo "❌ Backup failed! Aborting migration to protect data."
    # Optional: We could remove the generated file here if backup fails
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
