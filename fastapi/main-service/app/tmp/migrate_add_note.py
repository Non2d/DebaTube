import asyncio
import os
import sys

# Standardize path even for tmp script
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# Force root for migration to ensure permissions and correct creds in dev
# Assuming dev environment as per previous conversation
DB_URL = "mysql+aiomysql://root@db:3306/debate?charset=utf8"

async def migrate():
    # Create engine locally
    local_engine = create_async_engine(DB_URL, echo=True)
    async with local_engine.begin() as conn:
        print("Starting migration: Adding 'note' column to rounds table...")

        # Check if column exists
        columns = await conn.execute(text("SHOW COLUMNS FROM rounds LIKE 'note'"))
        if not columns.fetchone():
            await conn.execute(text("ALTER TABLE rounds ADD COLUMN note TEXT NULL"))
            print("Added 'note' column.")
        else:
            print("'note' column already exists.")

        print("Migration completed successfully.")

if __name__ == "__main__":
    asyncio.run(migrate())
