#!/bin/bash

# Load MySQL root password from .env
MYSQL_PWD=$(grep MYSQL_ROOT_PASSWORD mysql/.env | cut -d '=' -f2)

# Check if tables already exist
TABLE_COUNT=$(docker compose exec -T -e MYSQL_PWD="$MYSQL_PWD" db mysql -u root debate -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='debate' AND table_name != 'alembic_version';")
TABLE_COUNT=$(echo "$TABLE_COUNT" | tr -d ' \r\n')

if [ "$TABLE_COUNT" != "0" ]; then
    echo "Tables already exist ($TABLE_COUNT tables). Skipping init. Use update_db.sh instead."
    exit 0
fi

echo "No tables found. Initializing DB..."

SQL_FILE="sql/first_release_20260215_135628.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "SQL file not found: $SQL_FILE"
    exit 1
fi

echo "Loading $SQL_FILE ..."
docker compose exec -T -e MYSQL_PWD="$MYSQL_PWD" db mysql -u root debate < "$SQL_FILE"

if [ $? -ne 0 ]; then
    echo "Failed to load SQL file!"
    exit 1
fi

echo "Stamping alembic version..."
docker compose exec fastapi python -m alembic stamp head

if [ $? -ne 0 ]; then
    echo "Failed to stamp alembic version!"
    exit 1
fi

echo "DB initialization complete."
