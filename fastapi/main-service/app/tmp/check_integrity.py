
import asyncio
from sqlalchemy import text
from db import async_engine

async def check_integrity():
    async with async_engine.connect() as conn:
        print("--- WORDS per Speech ---")
        rows = await conn.execute(text("SELECT speech_id, COUNT(*) FROM words GROUP BY speech_id"))
        for r in rows:
            print(f"Speech {r[0]}: {r[1]} words")
            
        print("\n--- SENTENCES per Speech ---")
        rows = await conn.execute(text("SELECT speech_id, COUNT(*) FROM sentences GROUP BY speech_id"))
        for r in rows:
            print(f"Speech {r[0]}: {r[1]} sentences")

if __name__ == "__main__":
    asyncio.run(check_integrity())
