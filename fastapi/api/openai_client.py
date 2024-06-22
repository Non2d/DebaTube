from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from logging_config import logger
from dotenv import load_dotenv

import json
import models.round as round_model

import ast

from openai import AsyncOpenAI
from openai import OpenAI

load_dotenv()
client = AsyncOpenAI()
client_sync = OpenAI()

#ここでOpenAI APIを呼び出す
async def argument_mining_by_llm(db: AsyncSession, db_segments: List[round_model.Segment], speech_id: int):
    try:
        print("Starting argument mining by LLM.")
        await group_segments(db, db_segments, speech_id)
    except Exception as e:
        print(f"Error in background task: {e}")
        raise e
    finally:
        print("Database session closed")

async def group_segments(db: AsyncSession, db_segments: List[round_model.Segment], speech_id: int):
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

        first_segment_list = [int(str_num) for str_num in response.choices[0].message.content[1:-1].split(",")] #各ADUの最初のセグメントのidのリスト
        logger.info("OpenAI API response and ADU id list: %s %s", response.choices[0].message.content, first_segment_list)

        # first_segment_listを用いてADUを作成。具体的には、[0,5,9]のとき、0~4, 5~8, 9~len-1のsegmentをADUに代入する。
        # ただし、segment_idからADU.textを取得する処理はリスナに任せるので、ここではsegment_idのリストを渡すだけにする。

        ADUs = []
        for first_segment_id in first_segment_list:
            segments = []
            for segment in db_segments[first_segment_id:]:
                segments.append(segment) # 既存のSegmentインスタンスを参照するだけなので、オーバーヘッドは生じない
            ADUs.append(round_model.ADU(segments=segments, speech_id=speech_id))

        db.add_all(ADUs) 
        await db.commit() # 普通にdbを扱える

        for ADU in ADUs:
            await db.refresh(ADU)

        # ADU.transcriptの更新は未実装。
        # segmentsとの緊密な整合性の維持が重要なため、background taskで実装する。

        logger.info("Background tasks completed successfully")

        return ADUs
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in background task: {e}")
        raise e
    finally:
        await db.close()  # セッションを明示的に閉じる
        logger.info("Database session closed")


#同期バージョン
def argument_mining_by_llm_sync(db: Session, db_segments: List[round_model.Segment], speech_id: int):
    try:
        print("Starting argument mining by LLM.")
        return group_segments_sync(db, db_segments, speech_id)
    except Exception as e:
        print(f"Error in background task: {e}")
        raise e
    finally:
        print("Database session closed")

def group_segments_sync(db: Session, db_segments: List[round_model.Segment], speech_id: int):
    try:
        logger.info("Starting grouping segments to ADUs.")

        prompt_input = ""
        for i, item in enumerate(db_segments):
            prompt_input += f" {i}:{item.text.strip()}" # i + items[0].id = item.idの関係
        logger.info("segments: %s", prompt_input)
        user_prompt = "Regroup the given segments to argumentative discourse units and return the list of index of the first segment in each unit. The scheme of output is just a list of index e.g., [0,12,44,50]. YOU MUST NOT RETURN ANYTHING OTHER THAN THAT. Note that argumentative discourse units are elementary argumentation factors. Given segments:" + prompt_input

        response = client_sync.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a judge in the competitive debate and have to objectively analyze structures of arguments"},
                {"role": "user", "content": user_prompt}
            ]
        )

        first_segment_list = [int(str_num) for str_num in response.choices[0].message.content[1:-1].split(",")] #各ADUの最初のセグメントのidのリスト
        if first_segment_list[0] != 0:
            first_segment_list.insert(0, 0)
        logger.info("OpenAI API response and ADU id list: %s %s", response.choices[0].message.content, first_segment_list)

        # first_segment_listを用いてADUを作成。具体的には、[0,5,9]のとき、0~4, 5~8, 9~len-1のsegmentをADUに代入する。
        # ただし、segment_idからADU.textを取得する処理はリスナに任せるつもりだったが、同期版ではまぁいっかという気持ち
        # 当然一つ目の要素は必ず0である。

        #今更思ったけど、DBいじったりAPI叩いたり、関心がグチャグチャだな。リファクタリングしたい。
        ADUs = []
        for i in range(len(first_segment_list)):
            segments = []
            adu_transcript = ""
            for segment in db_segments[first_segment_list[i]:first_segment_list[i+1] if i<len(first_segment_list)-1 else None]:
                segments.append(segment)
                adu_transcript += segment.text
            adu_transcript = adu_transcript.lstrip() #先頭の空白を削除
            ADUs.append(round_model.ADU(segments=segments, speech_id=speech_id, transcript=adu_transcript))

        db.add_all(ADUs)
        db.commit() # 普通にdbを扱える

        for ADU in ADUs:
            db.refresh(ADU)

        logger.info("Background tasks completed successfully")

        return ADUs
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error in background task: {e}")
        raise e
    finally:
        db.close()  # セッションを明示的に閉じる
        logger.info("Database session closed")

def identify_rebuttal_sync(db: Session, input:str, round_id: int):
    try:
        rebuttals = []
        #ここでOpenAI APIを呼び出す
        user_prompt = "Identify the rebuttals for the given argumentative discourse units. Return the list of tuples of rebuttals i.e., (id of rebuttal source, id of rebuttal target). YOU MUST NOT RETURN ANYTHING OTHER THAN THAT. Given Input:" + input

        response = client_sync.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a judge in the competitive debate and have to objectively analyze structures of arguments"},
                {"role": "user", "content": user_prompt}
            ]
        )

        rebuttals = ast.literal_eval(response.choices[0].message.content[1:-1])

        Rebuttals = []
        for rebuttal in rebuttals:
            Rebuttals.append(round_model.Rebuttal(src=rebuttal[0], tgt=rebuttal[1]))
            logger.info("REB REB REB", rebuttal)
        
        db.add_all(Rebuttals)
        db.commit()
        for Rebuttal in Rebuttals:
            db.refresh(Rebuttal)

        logger.info("OpenAI API response and rebuttal list: %s", rebuttals)
        return rebuttals
    except Exception as e:
        logger.error(f"Error in background task: {e}")
        raise e
    finally:
        logger.info("Background tasks completed successfully")