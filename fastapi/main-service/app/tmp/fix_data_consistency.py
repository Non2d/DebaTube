
import asyncio
import logging
import json
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from db import async_session, async_engine
from models.round import Speech, Word, Sentence, Adu
from routers.utils import group_words_into_sentences
from cruds import round as round_crud

# ロガー設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_data():
    # 1. Clean up existing derived data
    logger.info("Cleaning up existing WORDS, SENTENCES and resetting ADUs...")
    async with async_engine.begin() as conn:
        await conn.execute(text("DELETE FROM words"))
        await conn.execute(text("DELETE FROM sentences"))
        await conn.execute(text("UPDATE adus SET start_sentence_index = NULL, end_sentence_index = NULL"))
    logger.info("Cleanup complete.")

    # 2. Backfill
    async with async_session() as db:
        db.expire_on_commit = False
        
        logger.info("Starting fresh backfill process...")
        
        result = await db.execute(
            select(Speech).where(Speech.raw_transcription.isnot(None))
        )
        speeches = result.scalars().all()
        logger.info(f"Found {len(speeches)} speeches with raw_transcription.")

        for speech in speeches:
            speech_id = speech.id
            position = speech.position
            raw_trans = speech.raw_transcription

            logger.info(f"Processing Speech {speech_id} ({position})...")
            
            if isinstance(raw_trans, str):
                try:
                    raw_trans = json.loads(raw_trans)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse raw_transcription for speech {speech_id}")
                    continue
            
            words_raw = raw_trans.get("words", [])
            if not words_raw:
                logger.warning(f"No words found in raw_transcription for speech {speech_id}")
                continue

            # Prepare Words
            words_data = []
            for i, w in enumerate(words_raw):
                start = w.get("start", 0.0)
                end = w.get("end", 0.0)
                text_content = w.get("word", w.get("text", ""))
                conf = w.get("probability", w.get("confidence", 0.0))
                
                words_data.append({
                    "speech_id": speech_id,
                    "index": i,
                    "text": text_content,
                    "start_time": round(float(start), 2),
                    "end_time": round(float(end), 2),
                    "confidence": float(conf) if conf else None
                })

            # Create Words
            words_objs = await round_crud.create_words_batch(db, words_data)
            
            words_for_grouping = [
                {
                    "text": w["text"],
                    "start": w["start_time"],
                    "end": w["end_time"]
                }
                for w in words_data
            ]
            
            full_text = raw_trans.get("text", "")
            if not full_text:
                full_text = " ".join([w["text"] for w in words_data])

            # Prepare Sentences
            sentences_info = group_words_into_sentences(full_text, words_for_grouping)
            
            sentences_data = []
            for s in sentences_info:
                sentences_data.append({
                    "speech_id": speech_id,
                    "index": s["id"],
                    "text": s["text"],
                    "start_word_index": s["start_word_index"],
                    "end_word_index": s["end_word_index"]
                })
            
            # Create Sentences
            sentences_objs = await round_crud.create_sentences_batch(db, sentences_data)
            
            logger.info(f"Created {len(words_objs)} words and {len(sentences_objs)} sentences for speech {speech_id}")

            # Repair ADUs
            # Note: We need to re-fetch ADUs here or use the relationship if possible, but simple fetch is safer
            adus = await round_crud.get_adus_by_speech(db, speech_id)
            if adus:
                logger.info(f"Attempting to match {len(adus)} ADUs to sentences...")
                for adu in adus:
                    found_start = -1
                    found_end = -1
                    adu_text_clean = adu.text.strip().replace(" ", "").lower()
                    
                    for i in range(len(sentences_data)):
                        combined_text = ""
                        for j in range(i, len(sentences_data)):
                            combined_text += sentences_data[j]["text"].strip().replace(" ", "").lower()
                            
                            # Check if ADU matches the start of combined string
                            # Ideally strict equality or containment. 
                            # Simplistic heuristics:
                            if adu_text_clean == combined_text:
                                found_start = sentences_data[i]["index"]
                                found_end = sentences_data[j]["index"]
                                break
                            
                            # Stop if combined is way longer
                            if len(combined_text) > len(adu_text_clean) + 20:
                                break
                        if found_start != -1:
                            break
                    
                    if found_start != -1:
                        adu.start_sentence_index = found_start
                        adu.end_sentence_index = found_end
                        db.add(adu)
                
                await db.commit()

        logger.info("All backfill operations completed successfully.")

if __name__ == "__main__":
    asyncio.run(fix_data())
