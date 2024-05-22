from typing import List

import sqlalchemy

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import models.round as round_model
import schemas.round as round_schema
import datetime

from fastapi import BackgroundTasks

from logging_config import logger
from openai_client import argumentMiningByLLM

async def create_round(
    db: AsyncSession, round_create: round_schema.RoundCreate
) -> round_model.Round:
    # Roundオブジェクトを作成
    round = round_model.Round(
        created_at=datetime.datetime.now(),
        updated_at=datetime.datetime.now(),
        deleted_at=None,
        motion=round_create.motion,
        source=round_create.source.model_dump(),
        POIs=round_create.POIs,
    )
    db.add(round)

    # Rebuttalsオブジェクトを作成
    rebuttals = [
        round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round=round)
        for rebuttal in round_create.rebuttals
    ]
    db.add_all(rebuttals)

    # SpeechesおよびADUsオブジェクトを作成
    speeches = [
        round_model.Speech(start_time=speech_create.start_time, round=round)
        for speech_create in round_create.speeches
    ]
    db.add_all(speeches)

    # 一度にコミット
    await db.commit()
    await db.refresh(round)

    # 関係のロード
    await db.execute(
        select(round_model.Round)
        .options(
            selectinload(round_model.Round.rebuttals),
            selectinload(round_model.Round.speeches)
            .selectinload(round_model.Speech.ADUs)
            .selectinload(round_model.ADU.segments),
        )
        .filter_by(id=round.id)
    )
    return round

async def get_rounds(db: AsyncSession) -> List[any]:
    result = await db.execute(
        select(round_model.Round).options(
            selectinload(round_model.Round.rebuttals),
            selectinload(round_model.Round.speeches)
            .selectinload(round_model.Speech.ADUs)
            .selectinload(round_model.ADU.segments),
        )
    )
    rounds = result.scalars().unique().all()
    return rounds

# speech_idのスピーチのSegmentを更新
async def create_speech_asr(
    db: AsyncSession, background_tasks:BackgroundTasks, speech_id: int, segments: List[round_schema.SegmentCreate]
) -> List[round_model.Segment]:
    db_segments = [
        round_model.Segment(
            start=segment.start, end=segment.end, text=segment.text, speech_id=speech_id
        )
        for segment in segments
    ]
    db.add_all(db_segments)
    await db.commit()
    for db_segment in db_segments:
        await db.refresh(db_segment)
    background_tasks.add_task(argumentMiningByLLM, db, db_segments, speech_id)
    return db_segments


async def get_speech_asr(db: AsyncSession, speech_id: int) -> round_model.Segment:
    result = await db.execute(
        select(round_model.Segment)
        .join(round_model.Speech)
        .join(round_model.Round)
        .filter(round_model.Round.id == speech_id)
    )
    segments = result.scalars().unique().all()
    return segments