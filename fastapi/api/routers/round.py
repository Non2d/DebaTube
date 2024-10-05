from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.future import select
from db import get_db

from typing import List
from pydantic import BaseModel

import models.round as round_db_model

from log_config import logger

router = APIRouter()


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
    # ~~GPTによるセグメント分割処理~~
    first_segment_ids = [0, 2, 5, 9]
    last_segment_ids = [i - 1 for i in first_segment_ids]
    for speech_create in round_create.speeches:
        argument_units = []
        tmp_text = ""
        tmp_first_segment_id = 0
        for id, segment in enumerate(speech_create):
            tmp_text += segment.text
            if id in first_segment_ids:
                tmp_first_segment_id = id  # 最初のセグメントIDを記録
                if tmp_text[0] == " ": # 先頭が空白文字の場合は削除
                    tmp_text = tmp_text[1:]
            if id in last_segment_ids or id == len(speech_create) - 1:
                # 最後のセグメントに達したらAUを作成
                argument_units.append(
                    round_db_model.ArgumentUnit(
                        sequence_id=len(argument_units),
                        start=speech_create[tmp_first_segment_id].start,
                        end=speech_create[id].end,
                        text=tmp_text,
                    )
                )
                tmp_text = ""
        speeches.append( 
            round_db_model.Speech(argument_units=argument_units, round=round) # スピーチごとにArgument Unitsを保存
        )
    db.add_all(speeches) # スピーチをデータベースに追加

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