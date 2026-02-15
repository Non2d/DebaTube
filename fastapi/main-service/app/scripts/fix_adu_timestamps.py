
import asyncio
import os
import sys

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import async_session
from app.models.round import Adu, Sentence, Word, Speech

async def fix_adu_timestamps():
    print("Starting ADU timestamp fix...")
    
    async with async_session() as session:
        # Fetch all ADUs with their related words
        # Eager load: Adu -> Sentence(first) -> Word(first)
        stmt = select(Adu).options(
            selectinload(Adu.first_sentence).selectinload(Sentence.first_word),
            selectinload(Adu.last_sentence).selectinload(Sentence.last_word)
        )
        
        result = await session.execute(stmt)
        adus = result.scalars().all()
        
        updated_count = 0
        skipped_count = 0
        
        for adu in adus:
            should_update = False
            new_start = None
            new_end = None
            
            # Start Time Correction
            if adu.first_sentence and adu.first_sentence.first_word:
                word_start = adu.first_sentence.first_word.start_time
                if abs(adu.start_time - word_start) > 0.001: # Check if differ
                    new_start = word_start
                    should_update = True
            
            # End Time Correction (might as well fix this too)
            if adu.last_sentence and adu.last_sentence.last_word:
                word_end = adu.last_sentence.last_word.end_time
                if abs(adu.end_time - word_end) > 0.001:
                    new_end = word_end
                    should_update = True

            if should_update:
                old_start = adu.start_time
                if new_start is not None:
                    adu.start_time = new_start
                if new_end is not None:
                    adu.end_time = new_end
                
                print(f"Fixing ADU {adu.id}: Start {old_start} -> {adu.start_time}")
                updated_count += 1
            else:
                skipped_count += 1
        
        if updated_count > 0:
            await session.commit()
            print(f"Successfully updated {updated_count} ADUs.")
        else:
            print("No ADUs required updates.")
            
        print(f"Skipped {skipped_count} ADUs (already correct or missing word data).")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(fix_adu_timestamps())
