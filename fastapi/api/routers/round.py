from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from db import get_db

router = APIRouter()

@router.get("/rounds")
async def get_rounds(db: AsyncSession = Depends(get_db)):
    pass

@router.post("/rounds/{round_id}")
async def create_round(round_id: int, db: AsyncSession = Depends(get_db)):
    # whisper-diarization.csvからデータを取得してデータベースに追加する
    pass