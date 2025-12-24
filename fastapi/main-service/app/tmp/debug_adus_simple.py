import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select, func, text
from dotenv import load_dotenv

# Standardize path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from models.round import Speech, Adu, Round, Sentence

load_dotenv()
DB_URL = "mysql+aiomysql://root@db:3306/debate?charset=utf8"

async def debug_speech(speech_id):
    print("Creating engine...", flush=True)
    engine = create_async_engine(DB_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        print(f"Checking Speech ID: {speech_id}", flush=True)
        
        try:
            # Simple check
            stmt = select(Speech).where(Speech.id == speech_id).options(selectinload(Speech.round))
            print("Executing query...", flush=True)
            result = await db.execute(stmt)
            print("Query executed.", flush=True)
            speech = result.scalar_one_or_none()
        except Exception as e:
            print(f"Error querying speech: {e}", flush=True)
            return

        if not speech:
            print("Speech not found.", flush=True)
            return

        print(f"Speech found: ID={speech.id}, Position={speech.position}, Round={speech.round.name}", flush=True)
        
        # Check ADUs
        result_adu = await db.execute(select(Adu).where(Adu.speech_id == speech_id))
        adus = result_adu.scalars().all()
        print(f"ADU count: {len(adus)}", flush=True)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        sid = int(sys.argv[1])
    else:
        sid = 75
    asyncio.run(debug_speech(sid))
