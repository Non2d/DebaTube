from typing import List
import schemas.round as round_schema #import api.schemas.roundだとエラーになる

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import cruds.round as round_crud
from db import get_db

router = APIRouter()


@router.get("/rounds", response_model=List[round_schema.Round])
async def list_rounds(db: AsyncSession = Depends(get_db)):
    return await round_crud.get_rounds_with_rebuttals(db)


@router.post("/rounds", response_model=round_schema.RoundCreateResponse)
async def create_round(
    round_body: round_schema.RoundCreate, db: AsyncSession = Depends(get_db)
):
    return await round_crud.create_round(db, round_body)
# awaitを忘れると，文法は問題ないがround_crud.create_round(db, round_body) の応答を待たずにレスポンスを返してしまい，エラーになる


@router.put("/rounds/{round_id}", response_model=round_schema.RoundCreateResponse)
async def update_round(
    round_id: int, round_body: round_schema.RoundCreate, db: AsyncSession = Depends(get_db)
):
    round = await round_crud.get_round(db, round_id=round_id)
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")

    return await round_crud.update_round(db, round_body, original=round)


@router.delete("/rounds/{round_id}", response_model=None)
async def delete_round(round_id: int, db: AsyncSession = Depends(get_db)):
    round = await round_crud.get_round(db, round_id=round_id)
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    
    return await round_crud.delete_round(db, original=round)