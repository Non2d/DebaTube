from fastapi import APIRouter, Depends, HTTPException
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

from cruds.gpt import segment2argument_units, segment2argument_units_unstructured, speeches2rebuttals, digest2motion

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

class RebuttalCreate(BaseModel):
    src: int
    tgt: int

class ArgumentUnitCreate(BaseModel):
    sequence_id: int
    start: float
    end: float
    text: str
class ArgumentUnitsCreate(BaseModel):
    argument_units: List[ArgumentUnitCreate]
class RoundBatchCreate(BaseModel):
    title: str
    motion: str
    speeches: List[ArgumentUnitsCreate]
    pois: List[int]
    rebuttals: List[RebuttalCreate]

class ArgumentUnitCreate(BaseModel):
    sequence_id: int
    start: float
    end: float
    text: str

# response schema
class PoiResponse(BaseModel):
    # id: int
    argument_unit_id: int

    class Config:
        orm_mode = True

class RebuttalResponse(BaseModel):
    # id: int
    src: int
    tgt: int

    class Config:
        orm_mode = True

class ArgumentUnitResponse(BaseModel):
    # id: int
    sequence_id: int
    start: float
    end: float
    text: str

    class Config:
        orm_mode = True

class SpeechResponse(BaseModel):
    # id: int
    argument_units: List[ArgumentUnitResponse]

    class Config:
        orm_mode = True

class RoundResponse(BaseModel):
    # id: int
    title: str
    motion: str
    pois: List[PoiResponse]
    rebuttals: List[RebuttalResponse]
    speeches: List[SpeechResponse]

    class Config:
        orm_mode = True

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

@router.get("/batch-rounds", response_model=List[RoundResponse])
async def get_rounds(db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).options(
        selectinload(round_db_model.Round.pois),
        selectinload(round_db_model.Round.rebuttals),
        selectinload(round_db_model.Round.speeches).selectinload(
            round_db_model.Speech.argument_units
        ),
    )
    result = await db.execute(query)
    rounds = result.scalars().unique().all()
    return rounds

@router.get("/rounds/{round_id}")
async def get_round(round_id: int, db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).options(
        selectinload(round_db_model.Round.rebuttals),
        selectinload(round_db_model.Round.speeches).selectinload(
            round_db_model.Speech.argument_units
        ),
    ).filter_by(id=round_id)
    result = await db.execute(query)
    round = result.scalars().first()
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    return round

@router.delete("/rounds/{round_id}")
async def delete_round(round_id: int, db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).filter_by(id=round_id)
    result = await db.execute(query)
    round = result.scalars().first()
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    await db.delete(round)
    await db.commit()
    logger.info(f"Round {round_id}: {round.title} deleted")
    return {"message": f"Round {round_id}: {round.title} deleted"}

@router.post("/rounds", response_model=RoundResponse)
async def create_round(round_create: RoundCreate, db: AsyncSession = Depends(get_db)): # Roundレコードを作成
    if len(round_create.speeches) not in [6, 8]:
        raise HTTPException(status_code=400, detail="The number of speeches must be 6 or 8.")
    
    logger.info(f"round_create.title: {round_create.title}, is empty?: {round_create.title == ''}")
    
    if round_create.title == "":
        raise HTTPException(status_code=400, detail="Title must not be empty.")

    round = round_db_model.Round(
        title=round_create.title,
        motion=round_create.motion,
    )
    db.add(round)
    
    speeches = []

    start_time = time.time()  # 開始時間を記録

    # POIの処理
    # pois = []
    # pois.append(round_db_model.Poi(argument_unit_id=1, round=round))
    # pois.append(round_db_model.Poi(argument_unit_id=2, round=round))
    # db.add_all(pois)

    # ここでsegment2argment_unitsの処理を並行実行
    segment_tasks = [segment2argument_units(speech_create) for speech_create in round_create.speeches]
    segment_results = await asyncio.gather(*segment_tasks)  # 並行実行して結果を待つ

    sequence_id = 0
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
                    sequence_id=sequence_id,
                    start=speech_create[first_seg_id].start,
                    end=speech_create[last_seg_id].end,
                    text=plain_text,
                )
            )
            sequence_id += 1
        
        # スピーチとArgument Unitsをデータベースに保存するためのリストに追加
        speeches.append(
            round_db_model.Speech(argument_units=argument_units, round=round)
        )
    
    db.add_all(speeches)  # スピーチをデータベースに追加

    # GPTによる反論判定
    rebuttals = await speeches2rebuttals(speeches) 
    logger.info("反論:"+str(rebuttals))
    db_rebuttals = []
    for rebuttal in rebuttals:
        db_rebuttals.append(
            round_db_model.Rebuttal(
                src=rebuttal.src,
                tgt=rebuttal.tgt,
                round=round
            )
        )
    db.add_all(db_rebuttals)

    # ここまでの変更全てをコミット
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

class DigestRequest(BaseModel):
    digest: str

@router.post("/motion")
async def create_motion(round_digest: DigestRequest):
    return await digest2motion(round_digest)

@router.post("/batch-round")
async def create_batch_round(round_create: RoundBatchCreate, db: AsyncSession = Depends(get_db)):
    if len(round_create.speeches) not in [6, 8]:
        raise HTTPException(status_code=400, detail="The number of speeches must be 6 or 8.")
    
    logger.info(f"round_create.title: {round_create.title}, is empty?: {round_create.title == ''}")
    
    if round_create.title == "":
        raise HTTPException(status_code=400, detail="Title must not be empty.")

    round = round_db_model.Round(
        title=round_create.title,
        motion=round_create.motion,
    )
    db.add(round)
    
    logger.info(f"type of speeches[0].argunits is : {type(round_create.speeches[0])}")

    db_speeches = []
    for argument_units in round_create.speeches:
        db_argument_units = []
        for arg_unit in argument_units.argument_units:
            db_argument_units.append(
                round_db_model.ArgumentUnit(
                    sequence_id=arg_unit.sequence_id,
                    start=arg_unit.start,
                    end=arg_unit.end,
                    text=arg_unit.text,
                )
            )

        db_speeches.append(
            round_db_model.Speech(
                argument_units=db_argument_units,
                round=round
            )
        )
    db.add_all(db_speeches)

    db_rebuttals = []
    for rebuttal in round_create.rebuttals:
        db_rebuttals.append(
            round_db_model.Rebuttal(
                src=rebuttal.src,
                tgt=rebuttal.tgt,
                round=round
            )
        )
    db.add_all(db_rebuttals)

    # ここまでの変更全てをコミット
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

    return round