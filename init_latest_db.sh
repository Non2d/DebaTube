#!/bin/bash

# MySQL コンテナはパスワードなしで起動される
# Check if tables already exist
TABLE_COUNT=$(docker compose exec -T db mysql -u root debate -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='debate' AND table_name != 'alembic_version';")
TABLE_COUNT=$(echo "$TABLE_COUNT" | tr -d ' \r\n')

if [ "$TABLE_COUNT" != "0" ]; then
    echo "Tables already exist ($TABLE_COUNT tables). Skipping init. Use update_db.sh instead."
    exit 0
fi

echo "No tables found. Initializing DB..."

SCHEMA_FILE="sql/schema_20260215_135628.sql"
DATA_FILE="sql/data_20260215_135628.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "SQL file not found: $SCHEMA_FILE"
    exit 1
fi

if [ ! -f "$DATA_FILE" ]; then
    echo "SQL file not found: $DATA_FILE"
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

echo "Loading data from $DATA_FILE ..."
docker compose exec -T db mysql -u root debate < "$DATA_FILE"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to load data file!"
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

echo "Stamping alembic version..."
docker compose exec fastapi python -m alembic stamp head

if [ $? -ne 0 ]; then
    echo "Failed to stamp alembic version!"
    exit 1
fi

echo "DB initialization complete."
