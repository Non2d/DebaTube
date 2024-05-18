from typing import List, Tuple, Optional

from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

import models.round as round_model
import schemas.round as round_schema


async def create_round(db: AsyncSession, round_create: round_schema.RoundCreate) -> round_model.Round:
    # Roundオブジェクトを作成
    round = round_model.Round(
        motion=round_create.motion,
        source=round_create.source.model_dump(),
        POIs=round_create.POIs,
    )
    db.add(round)

    # Rebuttalsオブジェクトを作成
    rebuttals = [round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round=round) for rebuttal in round_create.rebuttals]
    db.add_all(rebuttals)
    
    # SpeechesおよびADUsオブジェクトを作成
    for speech_create in round_create.speeches:
        speech = round_model.Speech(start_time=speech_create.start_time, round=round)
        db.add(speech)
        ADUs = [round_model.ADU(sequence_id=ADU.sequence_id, transcript=ADU.transcript, speech=speech) for ADU in speech_create.ADUs]
        db.add_all(ADUs)
        
        # Segmentsオブジェクトを作成
        for ADU, adu_create in zip(ADUs, speech_create.ADUs):
            segments = [round_model.Segment(start_time=segment.start_time, end_time=segment.end_time, text=segment.text, ADU=ADU) for segment in adu_create.segments]
            db.add_all(segments)

    # 一度にコミット
    await db.commit()
    await db.refresh(round)

    # 関係のロード
    await db.execute(
        select(round_model.Round)
        .options(
            selectinload(round_model.Round.rebuttals),
            selectinload(round_model.Round.speeches).selectinload(round_model.Speech.ADUs).selectinload(round_model.ADU.segments)
        )
        .filter_by(id=round.id)
    )
    
    return round

async def get_rounds(db: AsyncSession) -> List[any]:
    result = await db.execute(
        select(round_model.Round).options(selectinload(round_model.Round.rebuttals), selectinload(round_model.Round.speeches).selectinload(round_model.Speech.ADUs).selectinload(round_model.ADU.segments))
    )
    rounds = result.scalars().unique().all()
    return rounds

async def get_round(db: AsyncSession, round_id: int) -> Optional[round_model.Round]:
    result: Result = await db.execute(
        select(round_model.Round).filter(round_model.Round.id == round_id)
        )
    round: Optional[Tuple[round_model.Round]] = result.first()
    return round[0] if round is not None else None

async def update_round(
        db:AsyncSession, round_create: round_schema.RoundCreate, original: round_model.Round
) -> round_model.Round:
    original.title = round_create.title
    db.add(original)
    await db.commit()
    await db.refresh(original)
    return original

async def delete_round(db: AsyncSession, original: round_model.Round) -> None:
    await db.delete(original)
    await db.commit()

#legacy code
# async def create_round(
#     db: AsyncSession, round_create: round_schema.RoundCreate
# ) -> round_model.Round:
#     # dbにいれるまえに、_createオブジェクトを_modelオブジェクト（Taskなど）に変換する
#     round = round_model.Round(
#         motion=round_create.motion,
#         source=round_create.source.model_dump(),
#         POIs=round_create.POIs,
#     )
#     db.add(round)
#     await db.commit()
#     await db.refresh(round)

#     rebuttals = [round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round_id=round.id) for rebuttal in round_create.rebuttals]
    
#     db.add_all(rebuttals)
#     await db.commit()
#     await db.refresh(round)
    
#     for speech_create in round_create.speeches:
#         speech = round_model.Speech(start_time=speech_create.start_time, round_id=round.id)
#         db.add(speech)
#         await db.commit()
#         await db.refresh(round)
#         await db.refresh(speech)
#         # この時点ではspeechにはADUは入ってないので、speech.ADUsは存在しない

#         ADUs = [round_model.ADU(sequence_id=i, transcript=str(ADU.transcript), speech_id=speech.id) for i, ADU in enumerate(speech_create.ADUs)]
#         db.add_all(ADUs)
#         await db.commit()
#         await db.refresh(round)
#         await db.refresh(speech)

#     for segment_create in segment_create.segments:
#         segment = round_model.Segment(start_time=segment_create.start_time, end_time=segment_create.end_time, transcript=segment_create.transcript, ADU_id=ADUs.id)
#         db.add(segment)
#         await db.commit()

#     round_response_model = round_model.Round(
#         id=round.id,
#         motion=round.motion,
#         source=round.source,
#         POIs=round.POIs,
#         rebuttals = [round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round_id=round.id) for rebuttal in round_create.rebuttals],
#         speeches = [round_model.Speech(start_time=speech.start_time, round_id=round.id) for speech in round_create.speeches]
#     )

#     return round_response_model