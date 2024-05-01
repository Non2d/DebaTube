from typing import Tuple, Optional

from sqlalchemy import select
from sqlalchemy.engine import Result
from sqlalchemy.ext.asyncio import AsyncSession

import models.round as round_model


async def get_done(db: AsyncSession, round_id: int) -> Optional[round_model.Done]:
    result: Result = await db.execute(
        select(round_model.Done).filter(round_model.Done.id == round_id)
    )
    done: Optional[Tuple[round_model.Done]] = result.first()
    return done[0] if done is not None else None  # 要素が一つであってもtupleで返却されるので１つ目の要素を取り出す


async def create_done(db: AsyncSession, round_id: int) -> round_model.Done:
    done = round_model.Done(id=round_id)
    db.add(done)
    await db.commit()
    await db.refresh(done)
    return done


async def delete_done(db: AsyncSession, original: round_model.Done) -> None:
    await db.delete(original)
    await db.commit()