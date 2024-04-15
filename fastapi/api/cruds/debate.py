from sqlalchemy.ext.asyncio import AsyncSession

import models.debate as debate_model
import schemas.debate as debate_schema

from typing import List
from sqlalchemy.sql import select
from sqlalchemy.engine import Result

async def create_round(
        db: AsyncSession, debate_create: debate_schema.RoundCreate
) -> debate_model.Round:
    debate = debate_model.Round(**debate_create.model_dump())
    db.add(debate)
    await db.commit()
    await db.refresh(debate)
    return debate

# async def get_rounds(db: AsyncSession) -> List[debate_model.Round]:
#     result : Result = await (
#         db.execute(
#             select(
#                 debate_model.Round.id,
#                 debate_model.Round.source,
#                 debate_model.Round.motion,
#                 debate_model.Round.rebuttals,
#                 debate_model.Round.POIs,
#                 debate_model.Round.speeches
#             )
#         )
#     )
#     return result.all()

async def get_rounds(db: AsyncSession) -> List[debate_model.Round]:
    result : Result = await (
        db.execute(
            select(debate_model.Round)
        )
    )
    return result.scalars().all()