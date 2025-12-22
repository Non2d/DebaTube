from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from db import get_db
from cruds import round as round_crud
from models.round import Round, Speech, Adu, Rebuttal

router = APIRouter()


# ==================== Pydantic Models ====================

class RoundCreate(BaseModel):
    """ラウンド作成リクエスト"""
    name: str


class RoundResponse(BaseModel):
    name: str
    created_at: str

    class Config:
        from_attributes = True


class SpeechCreate(BaseModel):
    """スピーチ作成リクエスト"""
    round_name: str
    position: str
    audio_path: Optional[str] = None
    duration: Optional[float] = None
    raw_transcription: Optional[Dict[str, Any]] = None


class SpeechResponse(BaseModel):
    id: int
    round_name: str
    position: str
    audio_path: Optional[str]
    duration: Optional[float]

    class Config:
        from_attributes = True


class AduCreate(BaseModel):
    """ADU作成リクエスト"""
    speech_id: int
    start_sentence_index: int
    end_sentence_index: int
    text: str
    role: str
    start_time: float
    end_time: float


class AduResponse(BaseModel):
    id: int
    speech_id: int
    start_sentence_index: int
    end_sentence_index: int
    text: str
    role: str
    start_time: float
    end_time: float

    class Config:
        from_attributes = True


class RebuttalCreate(BaseModel):
    """反論関係作成リクエスト"""
    src_adu_id: int
    tgt_adu_id: int


class RebuttalResponse(BaseModel):
    id: int
    src_adu_id: int
    tgt_adu_id: int

    class Config:
        from_attributes = True


# ==================== Round Endpoints ====================

@router.post("/rounds", response_model=RoundResponse)
async def create_round(round_data: RoundCreate, db: AsyncSession = Depends(get_db)):
    """
    新しいラウンドを作成
    """
    round_obj = await round_crud.create_round(db, name=round_data.name)
    return RoundResponse(
        name=round_obj.name,
        created_at=round_obj.created_at.isoformat()
    )


@router.get("/rounds", response_model=List[RoundResponse])
async def get_all_rounds(db: AsyncSession = Depends(get_db)):
    """
    すべてのラウンドを取得
    """
    rounds = await round_crud.get_all_rounds(db)
    return [
        RoundResponse(
            name=r.name,
            created_at=r.created_at.isoformat()
        )
        for r in rounds
    ]


@router.get("/rounds/{round_name}", response_model=RoundResponse)
async def get_round(round_name: str, db: AsyncSession = Depends(get_db)):
    """
    ラウンドを名前で取得
    """
    round_obj = await round_crud.get_round(db, round_name)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    return RoundResponse(
        name=round_obj.name,
        created_at=round_obj.created_at.isoformat()
    )


@router.delete("/rounds/{round_name}")
async def delete_round(round_name: str, db: AsyncSession = Depends(get_db)):
    """
    ラウンドを削除
    """
    success = await round_crud.delete_round(db, round_name)
    if not success:
        raise HTTPException(status_code=404, detail="Round not found")
    return {"status": "success", "message": f"Round {round_name} deleted"}


# ==================== Speech Endpoints ====================

@router.post("/speeches", response_model=SpeechResponse)
async def create_speech(
    speech: SpeechCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    新しいスピーチを作成
    """
    speech_obj = await round_crud.create_speech(
        db,
        round_name=speech.round_name,
        position=speech.position,
        audio_path=speech.audio_path,
        duration=speech.duration,
        raw_transcription=speech.raw_transcription
    )
    return speech_obj


@router.get("/speeches/{speech_id}", response_model=SpeechResponse)
async def get_speech(speech_id: int, db: AsyncSession = Depends(get_db)):
    """
    スピーチをIDで取得
    """
    speech = await round_crud.get_speech(db, speech_id)
    if not speech:
        raise HTTPException(status_code=404, detail="Speech not found")
    return speech


@router.get("/rounds/{round_name}/speeches", response_model=List[SpeechResponse])
async def get_speeches_by_round(round_name: str, db: AsyncSession = Depends(get_db)):
    """
    ラウンド名でスピーチ一覧を取得
    """
    speeches = await round_crud.get_speeches_by_round(db, round_name)
    return speeches


# ==================== ADU Endpoints ====================

@router.post("/adus", response_model=AduResponse)
async def create_adu(
    adu: AduCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    新しいADUを作成
    """
    adu_obj = await round_crud.create_adu(
        db,
        speech_id=adu.speech_id,
        start_sentence_index=adu.start_sentence_index,
        end_sentence_index=adu.end_sentence_index,
        text=adu.text,
        role=adu.role,
        start_time=adu.start_time,
        end_time=adu.end_time
    )
    return adu_obj


@router.get("/adus/{adu_id}", response_model=AduResponse)
async def get_adu(adu_id: int, db: AsyncSession = Depends(get_db)):
    """
    ADUをIDで取得
    """
    adu = await round_crud.get_adu(db, adu_id)
    if not adu:
        raise HTTPException(status_code=404, detail="ADU not found")
    return adu


@router.get("/speeches/{speech_id}/adus", response_model=List[AduResponse])
async def get_adus_by_speech(speech_id: int, db: AsyncSession = Depends(get_db)):
    """
    スピーチIDでADU一覧を取得
    """
    adus = await round_crud.get_adus_by_speech(db, speech_id)
    return adus


@router.get("/rounds/{round_name}/adus", response_model=List[AduResponse])
async def get_adus_by_round(round_name: str, db: AsyncSession = Depends(get_db)):
    """
    ラウンド名でADU一覧を取得
    """
    adus = await round_crud.get_adus_by_round(db, round_name)
    return adus


# ==================== Rebuttal Endpoints ====================

@router.post("/rebuttals", response_model=RebuttalResponse)
async def create_rebuttal(
    rebuttal: RebuttalCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    新しい反論関係を作成
    """
    rebuttal_obj = await round_crud.create_rebuttal(
        db,
        src_adu_id=rebuttal.src_adu_id,
        tgt_adu_id=rebuttal.tgt_adu_id
    )
    return rebuttal_obj


@router.get("/rounds/{round_name}/rebuttals", response_model=List[RebuttalResponse])
async def get_rebuttals_by_round(round_name: str, db: AsyncSession = Depends(get_db)):
    """
    ラウンド名で反論関係一覧を取得
    """
    rebuttals = await round_crud.get_rebuttals_by_round(db, round_name)
    return rebuttals
