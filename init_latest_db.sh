#!/bin/bash

# Check if tables already exist
TABLE_COUNT=$(docker compose exec -T db mysql -u root debate -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='debate' AND table_name != 'alembic_version';")
TABLE_COUNT=$(echo "$TABLE_COUNT" | tr -d ' \r\n')

if [ "$TABLE_COUNT" != "0" ]; then
    echo "Tables already exist ($TABLE_COUNT tables). Skipping init. Use update_db.sh instead."
    exit 0
fi

echo "No tables found. Initializing DB..."

docker compose exec fastapi python -m alembic upgrade head

if [ $? -ne 0 ]; then
    echo "Failed to apply migration!"
    exit 1
fi

echo "DB initialization complete."
