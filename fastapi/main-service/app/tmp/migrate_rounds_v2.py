import asyncio
import os
import sys

# Change path to import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app'))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
# Force root for migration to ensure permissions and correct creds in dev
DB_URL = "mysql+aiomysql://root@db:3306/debate?charset=utf8"
# MYSQL_USER = os.getenv("MYSQL_USER")
# ...

async def migrate():
    # Create engine locally
    local_engine = create_async_engine(DB_URL, echo=True)
    async with local_engine.begin() as conn:
        print("Starting migration...")

        # 1. Find and Drop FK on speeches referencing rounds
        # We need to find the constraint name dynamically
        print("Finding FK constraint on speeches table...")
        result = await conn.execute(text("""
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'speeches' 
            AND REFERENCED_TABLE_NAME = 'rounds' 
            AND TABLE_SCHEMA = DATABASE();
        """))
        fk_constraints = result.fetchall()
        
        for fk in fk_constraints:
            constraint_name = fk[0]
            print(f"Dropping Foreign Key: {constraint_name}")
            await conn.execute(text(f"ALTER TABLE speeches DROP FOREIGN KEY {constraint_name}"))

        # Also drop the index on round_name if it exists (usually created for FK)
        # Note: Keeps the column for now to migrate data.

        # 2. Alter 'rounds' table
        print("Altering rounds table...")
        # Check if 'id' exists to avoid double run
        columns = await conn.execute(text("SHOW COLUMNS FROM rounds LIKE 'id'"))
        if not columns.fetchone():
            # Drop PK (name)
            # Check if name is actually PK
            try:
                await conn.execute(text("ALTER TABLE rounds DROP PRIMARY KEY"))
            except Exception as e:
                print(f"Warning dropping PK: {e} (might not exist or already dropped)")

            # Add id column
            await conn.execute(text("ALTER TABLE rounds ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST"))
            
            # Make sure name is unique
            # Check if index exists?
            try:
                await conn.execute(text("CREATE UNIQUE INDEX idx_rounds_name ON rounds(name)"))
            except Exception as e:
                print(f"Index on name might already exist: {e}")

            # Add new columns
            await conn.execute(text("ALTER TABLE rounds ADD COLUMN try_count INT DEFAULT 1"))
            await conn.execute(text("ALTER TABLE rounds ADD COLUMN type VARCHAR(50) DEFAULT 'record'"))
        else:
            print(" Rounds table already has 'id'. Skipping alteration.")

        # 3. Alter 'speeches' table
        print("Altering speeches table...")
        columns_speech = await conn.execute(text("SHOW COLUMNS FROM speeches LIKE 'round_id'"))
        if not columns_speech.fetchone():
            await conn.execute(text("ALTER TABLE speeches ADD COLUMN round_id INT AFTER id"))
            
            # Migrate Data which maps round_name -> round_id
            print("Migrating data: linking speeches to round ids...")
            await conn.execute(text("""
                UPDATE speeches s
                JOIN rounds r ON s.round_name = r.name
                SET s.round_id = r.id
            """))
            
            # Add FK
            print("Adding Foreign Key to speeches(round_id)...")
            await conn.execute(text("""
                ALTER TABLE speeches 
                ADD CONSTRAINT fk_speeches_round_id 
                FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
            """))

            # Optional: Drop round_name. 
            # CAUTION: If we drop this before code update, code breaks. 
            # Implementation plan says drop. I will drop it to be clean.
            # But we must ensure index on round_name is dropped if necessary?
            # Usually dropping column drops index on it.
            print("Dropping round_name from speeches...")
            await conn.execute(text("ALTER TABLE speeches DROP COLUMN round_name"))
            
        else:
             print(" Speeches table already has 'round_id'. Skipping alteration.")

        print("Migration completed successfully.")

if __name__ == "__main__":
    asyncio.run(migrate())
