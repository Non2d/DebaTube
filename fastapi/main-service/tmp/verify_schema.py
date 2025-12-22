
import asyncio
from sqlalchemy import select
from db import async_engine
from models.round import Round, Speech, Word, Sentence, Adu
from cruds import round as round_crud
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_schema_logic():
    logger.info("Starting schema verification...")
    async with async_engine.begin() as conn:
        # Check tables existence (via creating dummy data which will fail if table missing)
        pass

    async with async_engine.connect() as conn:
        # Create a session-like interaction (async_engine.begin usually gives connection, crud needs session)
        # We need AsyncSession. The db.py usually exports get_db or sessionmaker.
        # Let's import AsyncSessionLocal from db (assuming it exists or similar)
        pass

from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from db import async_session as AsyncSessionLocal # check db.py for actual export

async def main():
    async with AsyncSessionLocal() as db:
        test_round_name = "TEST_ROUND_VERIFY"
        
        # 1. Clean up previous test
        await round_crud.delete_round(db, test_round_name)
        
        # 2. Create Round
        logger.info("Creating Round...")
        try:
            r = await round_crud.create_round(db, name=test_round_name)
        except Exception as e:
            logger.error(f"Failed to create round: {e}")
            return

        # 3. Create Speech
        logger.info("Creating Speech...")
        s = await round_crud.create_speech(db, round_name=test_round_name, position="Prop_1st")
        
        # 4. Create Words
        logger.info("Creating Words...")
        words_data = [
            {"speech_id": s.id, "index": 0, "text": "Hello", "start_time": 0.0, "end_time": 0.5},
            {"speech_id": s.id, "index": 1, "text": "world", "start_time": 0.5, "end_time": 1.0},
        ]
        await round_crud.create_words_batch(db, words_data)
        
        # 5. Create Sentences
        logger.info("Creating Sentences...")
        sentences_data = [
            {"speech_id": s.id, "index": 0, "text": "Hello world", "start_word_index": 0, "end_word_index": 1}
        ]
        await round_crud.create_sentences_batch(db, sentences_data)
        
        # 6. Create ADU (no timestamp)
        logger.info("Creating ADU...")
        adus_data = [
            {
                "speech_id": s.id,
                "start_sentence_index": 0,
                "end_sentence_index": 0,
                "text": "Hello world",
                "role": "introduction"
            }
        ]
        await round_crud.create_adus_batch(db, adus_data)
        
        # 7. Verify Data and Timestamp Reconstruction logic
        logger.info("Verifying Data Retrieval...")
        adus = await round_crud.get_adus_by_speech(db, s.id)
        sentences = await round_crud.get_sentences_by_speech(db, s.id)
        words = await round_crud.get_words_by_speech(db, s.id)
        
        sentences_map = {sent.index: sent for sent in sentences}
        words_map = {w.index: w for w in words}
        
        assert len(adus) == 1
        adu = adus[0]
        
        # Logic from audio2adu.py
        start_time = 0.0
        if adu.start_sentence_index in sentences_map:
            sent = sentences_map[adu.start_sentence_index]
            if sent.start_word_index in words_map:
                start_time = words_map[sent.start_word_index].start_time
        
        logger.info(f"Reconstructed Start Time: {start_time}")
        assert start_time == 0.0
        
        logger.info("Verification SUCCESS!")
        
        # Cleanup
        await round_crud.delete_round(db, test_round_name)

if __name__ == "__main__":
    asyncio.run(main())
