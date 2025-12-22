
import asyncio
import logging
import json
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from db import async_session
from models.round import Speech, Word, Sentence, Adu
from routers.utils import group_words_into_sentences
from cruds import round as round_crud

# ロガー設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill_words_and_sentences():
    async with async_session() as db:
        logger.info("Starting backfill process...")
        
        # 1. Get all speeches that have raw_transcription
        # We also check if they already have words to avoid duplicates? 
        # Ideally we check if words count is 0.
        result = await db.execute(
            select(Speech).options(selectinload(Speech.words)).where(Speech.raw_transcription.isnot(None))
        )
        speeches = result.scalars().all()
        logger.info(f"Found {len(speeches)} speeches with raw_transcription.")

        for speech in speeches:
            if speech.words:
                logger.info(f"Speech {speech.id} ({speech.position}) already has words. Skipping.")
                continue

            logger.info(f"Processing Speech {speech.id} ({speech.position})...")
            
            raw_trans = speech.raw_transcription
            # raw_trans is likely a dict because SQLAlchemy JSON type
            if isinstance(raw_trans, str):
                try:
                    raw_trans = json.loads(raw_trans)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse raw_transcription for speech {speech.id}")
                    continue
            
            words_raw = raw_trans.get("words", [])
            if not words_raw:
                # Fallback: check if 'results' -> 'channels' -> 'alternatives' -> 'words' (Google STT?)
                # Or 'segments' (Whisper?) 
                # Assuming standard structure from previous code: raw_trans['words'] (based on audio2adu.py)
                # audio2adu.py: words_data_raw = transcript_data.get("words", [])
                logger.warning(f"No words found in raw_transcription for speech {speech.id}")
                continue

            # 2. Prepare Words
            words_data = []
            for i, w in enumerate(words_raw):
                # Ensure structure
                start = w.get("start", 0.0)
                end = w.get("end", 0.0)
                text = w.get("word", w.get("text", ""))
                conf = w.get("probability", w.get("confidence", 0.0))
                
                words_data.append({
                    "speech_id": speech.id,
                    "index": i,
                    "text": text,
                    "start_time": round(float(start), 2),
                    "end_time": round(float(end), 2),
                    "confidence": float(conf) if conf else None
                })

            # Create Words
            words_objs = await round_crud.create_words_batch(db, words_data)
            
            # Form words_list for grouping function
            # group_words_into_sentences expects [{"text":..., "start":..., "end":...}]
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

            # 3. Prepare Sentences
            sentences_info = group_words_into_sentences(full_text, words_for_grouping)
            
            sentences_data = []
            for s in sentences_info:
                # s: {"id":..., "text":..., "start_word_index":..., "end_word_index":...}
                sentences_data.append({
                    "speech_id": speech.id,
                    "index": s["id"],
                    "text": s["text"],
                    "start_word_index": s["start_word_index"],
                    "end_word_index": s["end_word_index"]
                })
            
            sentences_objs = await round_crud.create_sentences_batch(db, sentences_data)
            
            logger.info(f"Created {len(words_objs)} words and {len(sentences_objs)} sentences for speech {speech.id}")

            # 4. Repair ADUs (Optional but recommended)
            # Find ADUs for this speech
            adus = await round_crud.get_adus_by_speech(db, speech.id)
            if adus:
                logger.info(f"Attempting to repair {len(adus)} ADUs indices...")
                for adu in adus:
                    # Simple matching: find sentence range that contains ADU text
                    # Look for ADU text inside combined sentence text
                    # Or similarity matching? 
                    # Let's try exact substring match of stripped text first
                    
                    # This is complex. For now, let's map based on simplistic approach:
                    # If ADU text matches a sentence exactly?
                    # Or spread across multiple sentences.
                    
                    found_start = -1
                    found_end = -1
                    
                    adu_text_clean = adu.text.strip().replace(" ", "")
                    
                    # Accumulate sentence texts to find range
                    # This algorithm might be slow O(N^2), but N is small
                    for i in range(len(sentences_objs)):
                        combined_text = ""
                        for j in range(i, len(sentences_objs)):
                            combined_text += sentences_objs[j].text.strip().replace(" ", "") 
                            # Check if adu exists in start of combined
                            if adu_text_clean == combined_text:
                                found_start = i
                                found_end = j
                                break
                            if len(combined_text) > len(adu_text_clean) + 10:
                                break
                        if found_start != -1:
                            break
                    
                    if found_start != -1:
                        adu.start_sentence_index = found_start
                        adu.end_sentence_index = found_end
                        db.add(adu)
                        # logger.info(f"Matched ADU {adu.id} to sentences {found_start}-{found_end}")
                    else:
                        # Fallback: maybe just leave it or log warning
                        # logger.warning(f"Could not match ADU {adu.id} text to sentences.")
                        pass
                
                await db.commit()

        logger.info("Backfill completed.")

if __name__ == "__main__":
    asyncio.run(backfill_words_and_sentences())
