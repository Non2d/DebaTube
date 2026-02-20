#!/bin/bash

# MySQL コンテナはパスワードなしで起動される
SCHEMA_FILE="sql/schema_20260215_135628.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "SQL file not found: $SCHEMA_FILE"
    exit 1
fi

echo "Loading schema from $SCHEMA_FILE ..."
docker compose exec -T db mysql -u root debate < "$SCHEMA_FILE"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to load schema file!"
    echo "Rolling back: dropping all created tables..."

    docker compose exec -T db mysql -u root debate -e "
    DROP TABLE IF EXISTS adus;
    DROP TABLE IF EXISTS alembic_version;
    DROP TABLE IF EXISTS external_videos;
    DROP TABLE IF EXISTS rebuttals;
    DROP TABLE IF EXISTS sentences;
    DROP TABLE IF EXISTS speeches;
    DROP TABLE IF EXISTS transcriptions;
    DROP TABLE IF EXISTS words;
    "

    echo "All tables dropped. Exiting."
    exit 1
fi

echo "Schema loaded successfully."
