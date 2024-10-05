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
    query = (
        select(round_db_model.Round)
        .options(
            selectinload(round_db_model.Round.rebuttals),
            selectinload(round_db_model.Round.speeches)
            .selectinload(round_db_model.Speech.argument_units),
        )
    )
    result = await db.execute(query)
    rounds = result.scalars().unique().all()
    return rounds

#schema
class SegmentCreate(BaseModel): #たぶんだけどSegmentを返すことはない
    start: float
    end: float
    text: str

class RoundCreate(BaseModel):
    title: str
    motion: str
    pois: List[int]
    speeches: List[List[SegmentCreate]]
    # rebuttals: List[Rebuttal] # リクエストの時点ではrebuttalはまだ存在しない

class ArgumentUnitResponse(BaseModel): #responseガチるならこんな感じになるのかなぁ
    pass

@router.post("/rounds")
async def create_round(round_create: RoundCreate, db: AsyncSession = Depends(get_db)):
    # データベースにラウンドを追加する
    round = round_db_model.Round(
        title=round_create.title,
        motion=round_create.motion,
        pois=round_create.pois  # poiのidはglobal_idと一致しているはず
    )

    # ラウンドをデータベースに追加
    db.add(round)

    speeches = []
    first_segment_ids = [0, 2, 5, 9]
    # last_segment_ids の計算を修正
    last_segment_ids = [first_segment_ids[i+1] - 1 for i in range(len(first_segment_ids)-1)] + [len(round_create.speeches[0]) - 1]

    for speech_create in round_create.speeches:  # まずは2segmentごとに1AUにまとめる
        argument_units = []
        tmp_text = ""
        tmp_first_segment_id = 0

        for id, segment in enumerate(speech_create):
            tmp_text += segment.text
            if id in first_segment_ids:
                tmp_first_segment_id = id  # 最初のセグメントIDを記録
            if id in last_segment_ids:
                # 最後のセグメントに達したらAUを作成
                argument_units.append(round_db_model.ArgumentUnit(
                    sequence_id=len(argument_units),
                    start=speech_create[tmp_first_segment_id].start,
                    end=speech_create[id].end,  # 最後のセグメントIDのend
                    text=tmp_text
                ))
                tmp_text = ""  # テキストをリセット

        # スピーチごとにArgument Unitsを保存
        speeches.append(round_db_model.Speech(argument_units=argument_units, round=round))
    
    logger.info("--------------------------------------------------------------------------------")
    logger.info(speeches)

    speeches_const = [
        round_db_model.Speech(round=round, argument_units= [
            round_db_model.ArgumentUnit(
                sequence_id=0,
                start=0.0,
                end=1.0,
                text="Hello, I am the first speaker."
            ),
            round_db_model.ArgumentUnit(
                sequence_id=1,
                start=1.0,
                end=2.0,
                text="I will be talking about the first argument."
            )
        ])
    ]

    # スピーチをデータベースに追加
    db.add_all(speeches)

    # データベースの変更をコミット
    await db.commit()
    await db.refresh(round)

    # # ラウンドの情報を取得して返す
    # await db.execute(
    #     select(round_db_model.Round)
    #     .options(
    #         selectinload(round_db_model.Round.rebuttals),
    #         selectinload(round_db_model.Round.speeches)
    #         .selectinload(round_db_model.Speech.argument_units),
    #     )
    #     .filter_by(id=round.id)
    # )

    return "success"
