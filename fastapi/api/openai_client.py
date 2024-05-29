from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from logging_config import logger
from dotenv import load_dotenv

import json
import models.round as round_model

from openai import AsyncOpenAI

load_dotenv()
client = AsyncOpenAI()

#ここでOpenAI APIを呼び出す
async def argumentMiningByLLM(db: AsyncSession, db_segments: List[round_model.Segment], speech_id: int):
    try:
        logger.info("Starting grouping segments to ADUs.")

        prompt_input = ""
        for i, item in enumerate(db_segments):
            prompt_input += f" {i}:{item.text.strip()}" # i + items[0].id = item.idの関係
        logger.info("segments: %s", prompt_input)
        user_prompt = "Regroup the given segments to argumentative discourse units and return the list of index of the first segment in each unit. The scheme of output is just a list of index e.g., [0,12,44,50]. YOU MUST NOT RETURN ANYTHING OTHER THAN THAT. Note that argumentative discourse units are elementary argumentation factors. Given segments:" + prompt_input

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a judge in the competitive debate and have to objectively analyze structures of arguments"},
                {"role": "user", "content": user_prompt}
            ]
        )

        first_segment_list = [int(str_num) for str_num in response.choices[0].message.content[1:-1].split(",")]
        logger.info("OpenAI API response and ADU id list: %s", response.choices[0].message.content, first_segment_list)

        # first_segment_listを用いてADUを作成。具体的には、[0,5,9]のとき、0~4, 5~8, 9~len-1のsegmentをADUに代入する。
        # ただし、segment_idからtextを取得する処理はリスナに任せるので、ここではsegment_idのリストを渡すだけにする。

        ADUs = []
        for first_segment_id in first_segment_list:
            segments = []
            for segment in db_segments[first_segment_id:]:
                segments.append(segment) # 既存のSegmentインスタンスを参照するだけなので、オーバーヘッドは生じない
            # ADUs.append(round_model.ADU(segments=segments, speech_id=speech_id))

        # db.add_all(ADUs)
        # await db.commit() # 普通にdbを扱える

        logger.info("Background tasks completed successfully")
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in background task: {e}")
        raise e
    finally:
        await db.close()  # セッションを明示的に閉じる
        logger.info("Database session closed")