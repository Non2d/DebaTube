import asyncio
import os
import sys
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from db import get_db, async_engine, async_session
from models.round import Speech, Adu, Round, Sentence

async def debug_speech(speech_id):
    async with async_session() as db:
        print(f"Checking Speech ID: {speech_id}", flush=True)
        
        # Get Speech
        try:
            result = await db.execute(select(Speech).where(Speech.id == speech_id).options(selectinload(Speech.round)))
            speech = result.scalar_one_or_none()
        except Exception as e:
            print(f"Error querying speech: {e}", flush=True)
            return

        if not speech:
            print("Speech not found.", flush=True)
            # Check max speech id
            res_max = await db.execute(select(func.max(Speech.id)))
            max_id = res_max.scalar()
            print(f"Max Speech ID is: {max_id}", flush=True)
            return

        print(f"Speech found: ID={speech.id}, Position={speech.position}, Round={speech.round.name} (try={speech.round.try_count}, id={speech.round.id})", flush=True)
        
        # Check Sentences
        result_sent = await db.execute(select(func.count(Sentence.id)).where(Sentence.speech_id == speech_id))
        sent_count = result_sent.scalar()
        print(f"Sentence count: {sent_count}", flush=True)

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
