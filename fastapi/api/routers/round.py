from typing import List, Any
import schemas.round as round_schema  # import api.schemas.roundだとエラーになる

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

import cruds.round as round_crud
from db import get_db, get_db_sync

router = APIRouter()

@router.get("/rounds", response_model=List[round_schema.Round])
async def list_rounds(db: AsyncSession = Depends(get_db)):
    return await round_crud.get_rounds(db)


@router.post("/rounds", response_model=round_schema.RoundCreateResponse)
async def create_round(
    round_body: round_schema.RoundCreate, db: AsyncSession = Depends(get_db)
):
    return await round_crud.create_round(db, round_body)


# awaitを忘れると，文法は問題ないがround_crud.create_round(db, round_body) の応答を待たずにレスポンスを返してしまい，エラーになる


# @router.put("/rounds/{round_id}", response_model=round_schema.RoundCreateResponse)
# async def update_round(
#     round_id: int, round_body: round_schema.RoundCreate, db: AsyncSession = Depends(get_db)
# ):
#     round = await round_crud.get_round(db, round_id=round_id)
#     if round is None:
#         raise HTTPException(status_code=404, detail="Round not found")

#     return await round_crud.update_round(db, round_body, original=round)


# @router.delete("/rounds/{round_id}", response_model=None)
# async def delete_round(round_id: int, db: AsyncSession = Depends(get_db)):
#     round = await round_crud.get_round(db, round_id=round_id)
#     if round is None:
#         raise HTTPException(status_code=404, detail="Round not found")

#     return await round_crud.delete_round(db, original=round)

# speech_idのスピーチのSegmentを更新
# @router.put("/speech/{speech_id}/asr", response_model=List[round_schema.Segment], response_model_exclude_unset=True)
# async def register_speech_asr(
#     background_tasks: BackgroundTasks, speech_id: int, segments: List[round_schema.SegmentCreate], db: AsyncSession = Depends(get_db)
# ):
#     return await round_crud.update_speech_asr(db=db, background_tasks=background_tasks, speech_id=speech_id, segments=segments)

# speech_idのスピーチのSegmentを同期的に更新
# @router.put("/speech/{speech_id}/asr", response_model=List[round_schema.ADU])
# def register_speech_asr(
#     speech_id: int, segments: List[round_schema.SegmentCreate], db: Session = Depends(get_db_sync)
# ):
#     return round_crud.update_speech_asr_sync(db=db, speech_id=speech_id, segments=segments)
    # return await round_crud.update_speech_asr(db=db, background_tasks=background_tasks, speech_id=speech_id, segments=segments)

@router.put("/round/{round_id}/asr", response_model=List[List[round_schema.ADU]])
def register_round_asr(
    round_id: int, segments_list: List[List[round_schema.SegmentCreate]], db: Session = Depends(get_db_sync)
):
    return round_crud.update_round_asr_sync(db=db, round_id=round_id, segments_list=segments_list)

# @router.put("/round/{round_id}/asr", response_model=List[List[round_schema.Segment]], response_model_exclude_unset=True)
# async def register_round_asr(
#     background_tasks: BackgroundTasks, round_id: int, segments_list: List[List[round_schema.SegmentCreate]], db: AsyncSession = Depends(get_db)
# ):
#     return await round_crud.update_round_asr(db=db, background_tasks=background_tasks, round_id=round_id, segments_list=segments_list)
