from typing import List, Tuple, Optional

from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

import models.round as round_model
import schemas.round as round_schema


async def create_round(
    db: AsyncSession, round_create: round_schema.RoundCreate
) -> round_model.Round:
    # dbにいれるまえに、_createオブジェクトを_modelオブジェクト（Taskなど）に変換する
    round = round_model.Round(
        motion=round_create.motion,
        source=round_create.source.model_dump(),
        POIs=round_create.POIs,
    )
    db.add(round)
    await db.commit()
    await db.refresh(round)

    rebuttals = [round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round_id=round.id) for rebuttal in round_create.rebuttals]
    
    db.add_all(rebuttals)
    await db.commit()
    await db.refresh(round)
    
    for speech_create in round_create.speeches:
        speech = round_model.Speech(start_time=speech_create.start_time, round_id=round.id)
        db.add(speech)
        await db.commit()
        await db.refresh(round)
        await db.refresh(speech)
        # この時点ではspeechにはADUは入ってないので、speech.ADUsは存在しない

        ADUs = [round_model.ADU(sequence_id=i, transcript=str(i)+str(ADU.transcript), speech_id=speech.id) for i, ADU in enumerate(speech_create.ADUs)]
        db.add_all(ADUs)
        await db.commit()
        await db.refresh(round)
        await db.refresh(speech)  

    round_response_model = round_model.Round(
        id=round.id,
        motion=round.motion,
        source=round.source,
        POIs=round.POIs,
        rebuttals = [round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round_id=round.id) for rebuttal in round_create.rebuttals],
        speeches = [round_model.Speech(start_time=speech.start_time, round_id=round.id) for speech in round_create.speeches]
    )

    print(round_response_model)

    return round_response_model

async def get_rounds_with_done(db: AsyncSession) -> List[any]:
    result = await db.execute(
        select(round_model.Round).options(joinedload(round_model.Round.rebuttals))
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

