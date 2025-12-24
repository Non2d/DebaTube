import asyncio
import os
import sys

# Standardize path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# Force root for migration
DB_URL = "mysql+aiomysql://root@db:3306/debate?charset=utf8"

async def migrate():
    local_engine = create_async_engine(DB_URL, echo=True)
    async with local_engine.begin() as conn:
        print("Starting migration: Updating Unique Constraints...")

        # 1. Drop existing unique index on name
        # We try logical names. 'name' is the default if created via simple constraint, or 'idx_rounds_name' if we named it.
        # Reference: We created 'idx_rounds_name' in previous script.
        
        dropped = False
        possible_names = ['idx_rounds_name', 'name']
        
        for index_name in possible_names:
            try:
                # Check if exists first? Or just try drop.
                # In MySQL: DROP INDEX index_name ON table_name
                await conn.execute(text(f"DROP INDEX {index_name} ON rounds"))
                print(f"Dropped index: {index_name}")
                dropped = True
            except Exception as e:
                print(f"Index {index_name} not found or could not be dropped: {e}")

        # 2. Add composite unique index
        try:
            await conn.execute(text("CREATE UNIQUE INDEX idx_rounds_name_try_count ON rounds(name, try_count)"))
            print("Created composite unique index on (name, try_count)")
        except Exception as e:
            print(f"Error creating new index: {e}")

        print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())
