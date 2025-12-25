from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy import select

from db import get_db
from cruds import round as round_crud
from models.round import Round, Speech, Adu, Rebuttal, Sentence, Word
from sqlalchemy.orm import selectinload

router = APIRouter()


# ==================== Pydantic Models ====================

from enum import Enum

class RoundType(str, Enum):
    RECORD = "record"
    EXTERNAL_VIDEO = "external_video"

class RoundStyle(str, Enum):
    NORTH_AMERICAN = "north_american"
    ASIAN = "asian"
    BRITISH_PARLIAMENTARY = "british_parliamentary"
    BP_OPENING_HALF = "bp_opening_half"

class RoundCreate(BaseModel):
    """ラウンド作成リクエスト"""
    name: str
    type: RoundType = RoundType.RECORD
    style: RoundStyle = RoundStyle.BRITISH_PARLIAMENTARY
    motion: Optional[str] = None


class RoundResponse(BaseModel):
    id: int
    name: str
    try_count: int
    type: RoundType
    note: Optional[str] = None
    style: Optional[RoundStyle] = None
    motion: Optional[str] = None
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
    round_id: int
    # round_name is tricky with new schema. We keep it if we can lazy load or if we updated CRUD to load it.
    # For now, let's expose round_id. Frontend might need migration.
    # But user asked to add fields to ROUNDs.
    # I will allow round_name to be mapped if available.
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
    round_obj = await round_crud.create_round(
        db, 
        name=round_data.name,
        type=round_data.type.value,
        style=round_data.style.value if round_data.style else None,
        motion=round_data.motion
    )
    return RoundResponse(
        id=round_obj.id,
        name=round_obj.name,
        try_count=round_obj.try_count,
        type=round_obj.type,
        note=round_obj.note,
        style=round_obj.style,
        motion=round_obj.motion,
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
            id=r.id,
            name=r.name,
            try_count=r.try_count,
            type=r.type,
            note=r.note,
            created_at=r.created_at.isoformat()
        )
        for r in rounds
    ]


@router.get("/rounds/{round_name}", response_model=RoundResponse)
async def get_round(round_name: str, try_count: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    ラウンドを名前で取得
    try_countを指定するとそのバージョンのラウンドを取得
    指定なしの場合は最新を取得
    """
    round_obj = await round_crud.get_round(db, round_name, try_count=try_count)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    return RoundResponse(
        id=round_obj.id,
        name=round_obj.name,
        try_count=round_obj.try_count,
        type=round_obj.type,
        note=round_obj.note,
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


# ==================== Round Summary Endpoints ====================

class RoundSummaryResponse(BaseModel):
    id: int
    video_id: str
    title: str
    description: str
    motion: Optional[str] = None
    style: Optional[RoundStyle] = None
    date_uploaded: str
    channel_id: str
    tag: str
    poi_count: int
    rebuttal_count: int
    speech_count: int
    total_argument_units: int
    type: RoundType
    try_count: int

@router.get("/rounds-summary", response_model=List[RoundSummaryResponse])
async def get_rounds_summary(db: AsyncSession = Depends(get_db)):
    """
    ダッシュボード用のラウンドサマリーを取得
    """
    rounds = await round_crud.get_all_rounds_with_details(db)
    
    summary_list = []
    for r in rounds:
        speeches = r.speeches or []
        speech_cnt = len(speeches)
        
        # Count ADUs
        adu_cnt = 0
        rebuttal_cnt = 0
        poi_cnt = 0
        
        for s in speeches:
            adus = s.adus or []
            adu_cnt += len(adus)
            for a in adus:
                if a.role == 'poi':
                    poi_cnt += 1
                # Count rebuttals starting from this ADU
                rebuttals = a.rebuttals_as_source or []
                rebuttal_cnt += len(rebuttals)
        
        summary_list.append(RoundSummaryResponse(
            id=r.id,
            video_id="", # 未実装
            title=r.name,
            description=r.note or "",
            motion=r.motion,
            style=r.style,
            date_uploaded=r.created_at.isoformat(),
            channel_id="", # 未実装
            tag=r.type, # タグとしてタイプを表示
            poi_count=poi_cnt,
            rebuttal_count=rebuttal_cnt,
            speech_count=speech_cnt,
            total_argument_units=adu_cnt,
            type=r.type,
            try_count=r.try_count
        ))
    
    return summary_list


# ==================== Speech Endpoints ====================

@router.post("/speeches", response_model=SpeechResponse)
async def create_speech(
    speech: SpeechCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    新しいスピーチを作成
    """
    # Look up round_id from round_name
    round_obj = await round_crud.get_round(db, speech.round_name)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")

    speech_obj = await round_crud.create_speech(
        db,
        round_id=round_obj.id,
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


@router.get("/rounds/{round_id}/graph", response_model=Dict[str, Any])
async def get_round_graph(round_id: int, db: AsyncSession = Depends(get_db)):
    """
    指定されたround_idのグラフデータ（スピーチ、ADU、反論関係）を取得
    JSON形式は results_.../rebuttal_graph_....json に準拠
    """
    # Force loading of speeches and ADUs
    stmt = (
        select(Round)
        .options(
            selectinload(Round.speeches).selectinload(Speech.adus),
            selectinload(Round.speeches).selectinload(Speech.sentences)
        )
        .where(Round.id == round_id)
    )
    result = await db.execute(stmt)
    round_obj = result.scalar_one_or_none()
    
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")

    speeches_data = {}
    
    # Pre-fetch start times for all ADUs in this round efficiently
    speech_ids = [s.id for s in round_obj.speeches]
    
    adu_start_times = {}
    if speech_ids:
        # Query: Select ADU.id, Word.start_time 
        #        FROM adus 
        #        JOIN sentences ON adus.speech_id = sentences.speech_id AND adus.start_sentence_index = sentences.index
        #        JOIN words ON sentences.speech_id = words.speech_id AND sentences.start_word_index = words.index
        #        WHERE adus.speech_id IN speech_ids
        
        time_stmt = (
            select(Adu.id, Word.start_time)
            .join(Sentence, (Adu.speech_id == Sentence.speech_id) & (Adu.start_sentence_index == Sentence.index))
            .join(Word, (Sentence.speech_id == Word.speech_id) & (Sentence.start_word_index == Word.index))
            .where(Adu.speech_id.in_(speech_ids))
        )
        
        time_result = await db.execute(time_stmt)
        adu_start_times = {row.id: row.start_time for row in time_result.all()}

    # Construct speeches dictionary
    global_adu_index = 0
    db_id_to_local_id = {}

    # Need to iterate speeches in a deterministic order for consistent checking, usually format order.
    # But since we just want a graph, iterating speeches as they are is okay, provided we map consistently.
    # If round_obj.speeches order is random, IDs change. Ideally sort speeches by position/ID.
    sorted_speeches = sorted(
        round_obj.speeches, 
        key=lambda s: s.id if s.id else 0
    ) 
    # Or by 'index' if position order is known? But ID is fine for determinism.

    for speech in sorted_speeches:
        role_name = speech.position # e.g. "Proposition_1st"
        adu_list = []
        
        current_adus = speech.adus or []
        current_adus.sort(key=lambda a: a.id)
        
        for adu in current_adus:
            global_adu_index += 1
            local_id = global_adu_index
            db_id_to_local_id[adu.id] = local_id

            adu_list.append({
                "id": local_id, # return Local ID (1..N)
                "type": adu.role, 
                "text": adu.text,
                "start": adu_start_times.get(adu.id, 0.0)
            })
        
        speeches_data[role_name] = adu_list

    # Construct rebuttals list
    rebuttals_data = []
    
    if speech_ids:
        r_stmt = (
            select(Rebuttal.src_adu_id, Rebuttal.tgt_adu_id)
            .join(Adu, Rebuttal.src_adu_id == Adu.id)
            .where(Adu.speech_id.in_(speech_ids))
        )
        
        r_result = await db.execute(r_stmt)
        for row in r_result.all():
            db_src = row.src_adu_id
            db_tgt = row.tgt_adu_id
            
            # Map DB IDs to local IDs
            if db_src in db_id_to_local_id and db_tgt in db_id_to_local_id:
                rebuttals_data.append([
                    db_id_to_local_id[db_src], 
                    db_id_to_local_id[db_tgt]
                ])

    return {
        "speeches": speeches_data,
        "rebuttals": rebuttals_data
    }
