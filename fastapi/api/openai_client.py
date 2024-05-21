from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from logging_config import logger
from dotenv import load_dotenv

import sqlalchemy, asyncio, os, time
import models.round as round_model

from openai import OpenAI

load_dotenv()
client = OpenAI()

async def argumentMiningByLLM(db: AsyncSession, db_segments: List[round_model.Segment]):
    try:
        answer = "test"
        logger.info("Starting grouping segments to ADUs.")
        #ここでOpenAI APIを呼び出す
        # logger.info("APIKEY: %s", os.getenv("OPENAI_API_KEY"))

        # await asyncio.sleep(5)  # 非同期スリープを使用
        # time.sleep(5) # 同期スリープを使用

        response = await client.chat.completions.create(
            model="gpt-3.5-turbo-0125",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Who is ImperialHal?"}
            ]
        )
        answer = response.choices[0].message.content
        logger.info("OpenAI API response: %s", answer)

        db.add(round_model.Segment(start=0, end=1, text=answer, speech_id=1))
        await db.commit() # 普通にdbを扱える

        logger.info("Background tasks completed successfully")
        # logger.info("segments: %s", [str({c.key: getattr(segment, c.key) for c in sqlalchemy.inspect(segment).mapper.column_attrs}) for segment in db_segments])
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in background task: {e}")
        raise e
    finally:
        await db.close()  # セッションを明示的に閉じる
        logger.info("Database session closed")