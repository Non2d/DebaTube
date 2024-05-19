from typing import List, Tuple, Optional

from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

import models.round as round_model
import schemas.round as round_schema
import datetime


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
    for speech_create in round_create.speeches:
        speech = round_model.Speech(start_time=speech_create.start_time, round=round)
        db.add(speech)
        db.commit()
        db.refresh(speech)

        # ADUs = [
        #     round_model.ADU(sequence_id=ADU.sequence_id, speech=speech)
        #     for ADU in speech_create.ADUs
        # ]
        # db.add_all(ADUs)

        # # Segmentsオブジェクトを作成
        # for adu_create in speech_create.ADUs:
        #     segments = [
        #         round_model.Segment(
        #             start=segment.start,
        #             end=segment.end,
        #             text=segment.text,
        #             speech=speech,
        #         )
        #         for segment in adu_create.segments
        #     ]
        #     db.add_all(segments)

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
    db: AsyncSession, speech_id: int, segments: List[round_schema.Segment]
) -> List[round_model.Segment]:
    db_segments = [
        round_model.Segment(
            start=segment.start, end=segment.end, text=segment.text, speech_id=speech_id
        )
        for segment in segments
    ]
    db.add_all(db_segments)
    await db.commit()
    return segments


async def get_speech_asr(db: AsyncSession, speech_id: int) -> round_model.Segment:
    result = await db.execute(
        select(round_model.Segment)
        .join(round_model.Speech)
        .join(round_model.Round)
        .filter(round_model.Round.id == speech_id)
    )
    segments = result.scalars().unique().all()
    return segments
