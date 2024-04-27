from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import cruds.debate as debate_crud
from db import get_db

import schemas.debate as debate_schema

router = APIRouter()

@router.get("/rounds", response_model=List[debate_schema.Round])
async def list_rounds(db:AsyncSession = Depends(get_db)):
    return await debate_crud.get_rounds(db)

@router.post("/rounds", response_model=debate_schema.RoundCreateResponse)
async def create_round(round_body:debate_schema.RoundCreate, db:AsyncSession = Depends(get_db)):
    return await debate_crud.create_round(db, round_body)

@router.put("/rounds/{round_id}", response_model=debate_schema.RoundCreateResponse)
async def update_round(
    round_id: int, round_body:debate_schema.RoundCreate, db:AsyncSession = Depends(get_db)
):
    round = await debate_crud.get_round(db, round_id=round_id)
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    return await debate_crud.update_round(db, round_body, original=round)
#将来的にRebuttalだけ更新できるエンドポイントも作成したい!

@router.delete("/rounds/{round_id}", response_model=None)
async def delete_round(round_id:int):
    return