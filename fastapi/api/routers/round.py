from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.future import select
from db import get_db
import time

import asyncio

from typing import List
from pydantic import BaseModel

import models.round as round_db_model

from log_config import logger

router = APIRouter()

from cruds.gpt import segment2argment_units, argument_units2rebuttals

@router.get("/rounds")
async def get_rounds(db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).options(
        selectinload(round_db_model.Round.rebuttals),
        selectinload(round_db_model.Round.speeches).selectinload(
            round_db_model.Speech.argument_units
        ),
    )
    result = await db.execute(query)
    rounds = result.scalars().unique().all()
    return rounds


# request schema
class SegmentCreate(BaseModel):  # たぶんだけどSegmentを返すことはない
    start: float
    end: float
    text: str

class RoundCreate(BaseModel):
    title: str
    motion: str
    speeches: List[List[SegmentCreate]]
    # pois: List[int]  # リクエストの時点ではpoiはまだ確定していない
    # rebuttals: List[Rebuttal] # リクエストの時点ではrebuttalはまだ存在しない

# response schema
class PoiResponse(BaseModel):
    id: int
    argument_unit_id: int

    class Config:
        orm_mode = True

class RebuttalResponse(BaseModel):
    id: int
    src: int
    tgt: int

    class Config:
        orm_mode = True

class ArgumentUnitResponse(BaseModel):
    id: int
    sequence_id: int
    start: float
    end: float
    text: str

    class Config:
        orm_mode = True

class SpeechResponse(BaseModel):
    id: int
    argument_units: List[ArgumentUnitResponse]

    class Config:
        orm_mode = True

class RoundResponse(BaseModel):
    id: int
    title: str
    motion: str
    pois: List[PoiResponse]
    rebuttals: List[RebuttalResponse]
    speeches: List[SpeechResponse]

    class Config:
        orm_mode = True


@router.post("/rounds", response_model=RoundResponse)
async def create_round(round_create: RoundCreate, db: AsyncSession = Depends(get_db)): # Roundレコードを作成

    round = round_db_model.Round(
        title=round_create.title,
        motion=round_create.motion,
    )
    db.add(round)
    
    speeches = []

    start_time = time.time()  # 開始時間を記録

    # ここでsegment2argment_unitsの処理を並行実行
    segment_tasks = [segment2argment_units(speech_create) for speech_create in round_create.speeches]
    segment_results = await asyncio.gather(*segment_tasks)  # 並行実行して結果を待つ

    for idx, first_seg_ids in enumerate(segment_results):
        speech_create = round_create.speeches[idx]
        argument_units = []
        
        for i in range(len(first_seg_ids)):
            first_seg_id = first_seg_ids[i]

            if i == len(first_seg_ids) - 1:
                last_seg_id = len(speech_create) - 1
            elif first_seg_ids[i] == first_seg_ids[i+1]:
                last_seg_id = first_seg_ids[i]
            else:
                last_seg_id = first_seg_ids[i+1] - 1

            logger.info(f"len_speech_create: {len(speech_create)} first_seg_id: {first_seg_id}, last_seg_id: {last_seg_id}")
            
            segment_texts = [speech_create[j].text.strip() for j in range(first_seg_id, last_seg_id + 1)]
            plain_text = ' '.join(segment_texts)

            argument_units.append(
                round_db_model.ArgumentUnit(
                    sequence_id=0,
                    start=speech_create[first_seg_id].start,
                    end=speech_create[last_seg_id].end,
                    text=plain_text,
                )
            )
        
        # スピーチとArgument Unitsをデータベースに保存するためのリストに追加
        speeches.append(
            round_db_model.Speech(argument_units=argument_units, round=round)
        )
    
    db.add_all(speeches)  # スピーチをデータベースに追加

    # POIとRebuttalの処理
    pois = []
    pois.append(round_db_model.Poi(argument_unit_id=1, round=round))
    pois.append(round_db_model.Poi(argument_unit_id=2, round=round))
    db.add_all(pois)

    rebuttals = []
    # ~~GPTによるRebuttal判定処理~~
    rebuttals.append(round_db_model.Rebuttal(src=1, tgt=2, round=round))
    rebuttals.append(round_db_model.Rebuttal(src=2, tgt=1, round=round))
    db.add_all(rebuttals)

    # データベースの変更をコミット
    await db.commit()
    await db.refresh(round)

    # roundデータを取得し、関連するリレーションをロード
    await db.execute(
        select(round_db_model.Round)
        .options(
            selectinload(round_db_model.Round.rebuttals),
            selectinload(round_db_model.Round.pois),
            selectinload(round_db_model.Round.speeches).selectinload(
                round_db_model.Speech.argument_units
            ),
        )
        .filter_by(id=round.id)
    )

    end_time = time.time()  # 終了時間を記録
    logger.info(f"非同期処理の実行時間: {end_time - start_time}秒")

    return round

@router.post("/segment2argment_units")
async def test_segment2argment_units(texts: List[SegmentCreate]):
    return await segment2argment_units(texts)

@router.post("/argument_units2rebuttals")
async def test_argument_units2rebuttals():
    return await argument_units2rebuttals()