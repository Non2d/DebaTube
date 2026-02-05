from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy import select, func
import math

from db import get_db
from cruds import round as round_crud
from models.round import Round, Speech, Adu, Rebuttal, Sentence, Word
from sqlalchemy.orm import selectinload, aliased

router = APIRouter()


# ==================== Pydantic Models ====================

from enum import Enum
from typing import Literal

# Import speech positions from utils
from routers.utils import NA_ORDER, ASIAN_ORDER, WSDC_ORDER, HPDU_ORDER, BP_ORDER, OPENING_HALF_BP_ORDER, DEBATE_FORMATS

class RoundType(str, Enum):
    RECORD = "record"
    EXTERNAL_VIDEO = "external_video"

class RoundStyle(str, Enum):
    NORTH_AMERICAN = "north_american"
    ASIAN = "asian"
    WSDC = "wsdc"
    HPDU = "hpdu"
    BRITISH_PARLIAMENTARY = "british_parliamentary"
    BP_OPENING_HALF = "bp_opening_half"

class StepStatus(str, Enum):
    """Processing step status"""
    NOT_IN_QUEUE = "not_in_queue"
    IN_QUEUE = "in_queue"
    PROCESSING = "processing"
    DONE = "done"

# All possible speech positions across all formats
ALL_SPEECH_POSITIONS = list(set(NA_ORDER + ASIAN_ORDER + WSDC_ORDER + HPDU_ORDER + BP_ORDER + OPENING_HALF_BP_ORDER))

# Speech position type for validation
SpeechPosition = Literal[
    "Proposition_1st", "Opposition_1st",
    "Proposition_2nd", "Opposition_2nd", 
    "Proposition_3rd", "Opposition_3rd",
    "Proposition_4th", "Opposition_4th"
]

class RoundCreate(BaseModel):
    """ラウンド作成リクエスト"""
    name: str
    type: RoundType = RoundType.RECORD
    style: RoundStyle = RoundStyle.BRITISH_PARLIAMENTARY
    motion: Optional[str] = None
    tags: Optional[str] = None
    video_id: Optional[str] = None
    video_title: Optional[str] = None
    video_description: Optional[str] = None
    video_published_at: Optional[str] = None
    video_channel_id: Optional[str] = None
    video_channel_title: Optional[str] = None
    video_thumbnail_url: Optional[str] = None
    video_tags: Optional[list] = None
    video_category_id: Optional[str] = None
    owner_id: Optional[str] = None


class RoundUpdate(BaseModel):
    """ラウンド更新リクエスト（部分更新）- 全フィールドOptional"""
    style: Optional[RoundStyle] = None
    motion: Optional[str] = None
    tags: Optional[str] = None


class RoundResponse(BaseModel):
    id: int
    name: str
    try_count: int
    type: RoundType
    note: Optional[str] = None
    style: Optional[RoundStyle] = None
    motion: Optional[str] = None
    tags: Optional[str] = None
    video_id: Optional[str] = None
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
    audio_path: Optional[str] = None
    duration: Optional[float] = None
    first_sentence_id: Optional[int] = None
    last_sentence_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class AduCreate(BaseModel):
    speech_id: int
    first_sentence_id: int
    last_sentence_id: int
    text: str
    role: str


class AduResponse(BaseModel):
    id: int
    speech_id: int
    first_sentence_id: int
    last_sentence_id: int
    text: str
    role: str

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


class SpeechDiarizationEntry(BaseModel):
    position: SpeechPosition  # e.g. "Proposition_1st"
    first_sentence_id: int
    last_sentence_id: int

class DiarizationUpdateRequest(BaseModel):
    entries: List[SpeechDiarizationEntry]

class SentenceWithTime(BaseModel):
    id: int
    text: str
    start_time: float
    end_time: float

    class Config:
        from_attributes = True



# ==================== Round Endpoints ====================

@router.post("/rounds", response_model=RoundResponse)
async def create_round(round_data: RoundCreate, db: AsyncSession = Depends(get_db)):
    """
    新しいラウンドを作成
    """
    try:
        round_obj = await round_crud.create_round(
            db,
            name=round_data.name,
            type=round_data.type.value,
            style=round_data.style.value if round_data.style else None,
            motion=round_data.motion,
            tags=round_data.tags,
            video_id=round_data.video_id,
            video_title=round_data.video_title,
            video_description=round_data.video_description,
            video_published_at=round_data.video_published_at,
            video_channel_id=round_data.video_channel_id,
            video_channel_title=round_data.video_channel_title,
            video_thumbnail_url=round_data.video_thumbnail_url,
            video_tags=round_data.video_tags,
            video_category_id=round_data.video_category_id,
            owner_id=round_data.owner_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return RoundResponse(
        id=round_obj.id,
        name=round_obj.name,
        try_count=round_obj.try_count,
        type=round_obj.type,
        note=round_obj.note,
        style=round_obj.style,
        motion=round_obj.motion,
        tags=round_obj.tags,
        video_id=round_obj.video_id,
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
            style=r.style,
            motion=r.motion,
            tags=r.tags,
            video_id=r.video_id,
            created_at=r.created_at.isoformat()
        )
        for r in rounds
    ]


@router.get("/rounds/{round_id:int}", response_model=RoundResponse)
async def get_round_by_id(round_id: int, db: AsyncSession = Depends(get_db)):
    """
    ラウンドをIDで取得
    """
    round_obj = await round_crud.get_round_by_id(db, round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    return RoundResponse(
        id=round_obj.id,
        name=round_obj.name,
        try_count=round_obj.try_count,
        type=round_obj.type,
        note=round_obj.note,
        style=round_obj.style,
        motion=round_obj.motion,
        tags=round_obj.tags,
        video_id=round_obj.video_id,
        created_at=round_obj.created_at.isoformat()
    )


@router.get("/rounds/{round_name}", response_model=RoundResponse)
async def get_round(round_name: str, try_count: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    ラウンドを名前で取得
    try_countを指定するとそのバージョンのラウンドを取得
    指定なしの場合は最新を取得
    """
    round_obj = await round_crud.get_round_by_name(db, round_name, try_count=try_count)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    return RoundResponse(
        id=round_obj.id,
        name=round_obj.name,
        try_count=round_obj.try_count,
        type=round_obj.type,
        note=round_obj.note,
        style=round_obj.style,
        motion=round_obj.motion,
        tags=round_obj.tags,
        video_id=round_obj.video_id,
        created_at=round_obj.created_at.isoformat()
    )


@router.patch("/rounds/{round_id:int}")
async def update_round(round_id: int, update_data: RoundUpdate, db: AsyncSession = Depends(get_db)):
    """
    ラウンドの情報を部分更新
    - style: ディベートスタイル
    - motion: 論題
    """
    round_obj = await round_crud.get_round_by_id(db, round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    
    # Update fields if provided (exclude_unset=True means only update fields that were explicitly set)
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for field, value in update_dict.items():
        setattr(round_obj, field, value)
    
    if update_dict:  # Only commit if there were changes
        db.add(round_obj)
        await db.commit()
        await db.refresh(round_obj)
    
    return {"status": "success", "message": "Round updated", "updated_fields": list(update_dict.keys())}


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
    video_id: Optional[str] = None
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

class PaginatedRoundSummaryResponse(BaseModel):
    items: List[RoundSummaryResponse]
    total: int
    page: int
    limit: int

    total_pages: int


@router.get("/rounds-summary", response_model=PaginatedRoundSummaryResponse)
async def get_rounds_summary(
    type: Optional[str] = Query(None), 
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db)
):
    """
    ダッシュボード用のラウンドサマリーを取得（ページング付き）
    """
    skip = (page - 1) * limit
    
    # Get total count
    total = await round_crud.get_rounds_count(db, type=type)
    
    # Get paginated items
    rounds = await round_crud.get_all_rounds_with_details(db, type=type, skip=skip, limit=limit)
    
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
            video_id=r.video_id,
            title=r.name,
            description=r.note or "",
            motion=r.motion,
            style=r.style,
            date_uploaded=r.created_at.isoformat(),
            channel_id="", # TODO: Add channel_id
            tag=r.type, # タグとしてタイプを表示
            poi_count=poi_cnt,
            rebuttal_count=rebuttal_cnt,
            speech_count=speech_cnt,
            total_argument_units=adu_cnt,
            type=r.type,
            try_count=r.try_count
        ))
    
    total_pages = math.ceil(total / limit) if limit > 0 else 0
    
    return PaginatedRoundSummaryResponse(
        items=summary_list,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages
    )


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
    round_obj = await round_crud.get_round_by_name(db, speech.round_name)
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


@router.get("/rounds/id/{round_id}/speeches", response_model=List[SpeechResponse])
async def get_speeches_by_round_id(round_id: int, db: AsyncSession = Depends(get_db)):
    """
    ラウンドIDでスピーチ一覧を取得
    """
    speeches = await round_crud.get_speeches_by_round_id(db, round_id)
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
        first_sentence_id=adu.first_sentence_id,
        last_sentence_id=adu.last_sentence_id,
        text=adu.text,
        role=adu.role
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


@router.get("/rounds/{round_id}/sentences_with_time", response_model=List[SentenceWithTime])
async def get_sentences_with_time(round_id: int, db: AsyncSession = Depends(get_db)):
    """
    指定されたラウンドのすべての文を、開始・終了時刻付きで取得。
    Wordテーブルと結合して計算する。
    """
    WordStart = aliased(Word)
    WordEnd = aliased(Word)

    stmt = (
        select(
            Sentence.id,
            Sentence.text,
            WordStart.start_time,
            WordEnd.end_time
        )
        .join(WordStart, Sentence.first_word_id == WordStart.id)
        .join(WordEnd, Sentence.last_word_id == WordEnd.id)
        .where(Sentence.round_id == round_id)
        .order_by(Sentence.id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        SentenceWithTime(
            id=row[0],
            text=row[1],
            start_time=row[2],
            end_time=row[3]
        )
        for row in rows
    ]


@router.post("/rounds/{round_id}/diarization", response_model=List[SpeechResponse])
async def update_diarization(
    round_id: int, 
    request: DiarizationUpdateRequest, 
    db: AsyncSession = Depends(get_db)
):
    """
    話者分離結果（各スピーチの開始・終了文ID）を一括更新する。
    """
    # 既存のスピーチを取得（なければ作成する必要があるが、通常Step 1か初期化で作られているはず）
    # もし無ければ作成するロジックを入れるか？ 
    # いったん既存のスピーチを探し、無ければ round_id と position で作成する。
    
    updated_speeches = []
    
    # トランザクション内で処理
    for entry in request.entries:
        # スピーチ検索
        stmt = select(Speech).where(Speech.round_id == round_id, Speech.position == entry.position)
        result = await db.execute(stmt)
        speech = result.scalar_one_or_none()
        
        if not speech:
            # Create new speech if not exists
            speech = Speech(
                round_id=round_id,
                position=entry.position,
                first_sentence_id=entry.first_sentence_id,
                last_sentence_id=entry.last_sentence_id
            )
            db.add(speech)
        else:
            speech.first_sentence_id = entry.first_sentence_id
            speech.last_sentence_id = entry.last_sentence_id
            db.add(speech)
            
        updated_speeches.append(speech)
    
    await db.commit()
    
    # Refresh all speeches to get database-generated IDs
    for speech in updated_speeches:
        await db.refresh(speech)
    
    # Return updated speeches as SpeechResponse objects
    return [
        SpeechResponse(
            id=speech.id,
            round_id=speech.round_id,
            position=speech.position,
            audio_path=speech.audio_path,
            duration=speech.duration,
            first_sentence_id=speech.first_sentence_id,
            last_sentence_id=speech.last_sentence_id
        )
        for speech in updated_speeches
    ]


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
        time_stmt = (
            select(Adu.id, Word.start_time)
            .join(Sentence, Adu.first_sentence_id == Sentence.id)
            .join(Word, Sentence.first_word_id == Word.id)
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


from models.external_video import ExternalVideo # Ensure this import exists at top level if not already

@router.get("/batch-rounds-with-features", response_model=Dict[str, Any])
async def batch_rounds_with_features(db: AsyncSession = Depends(get_db)):
    """
    Fetch all rounds with complete graph features (Speeches, ADUs, Rebuttals).
    Used by Explore page (legacy component support).
    Filters rounds that have at least one rebuttal (Step 4 Complete).
    Include dummy 'features' object for sorting compatibility.
    """
    stmt = (
        select(Round, ExternalVideo)
        .outerjoin(ExternalVideo, Round.video_id == ExternalVideo.video_id)
        .options(
            selectinload(Round.speeches).selectinload(Speech.adus).selectinload(Adu.rebuttals_as_source),
        )
    )
    
    result = await db.execute(stmt)
    rows = result.all() # Returns list of (Round, ExternalVideo) tuples
    
    response_list = []
    
    for r, ev in rows:
        # Determine speech order based on round style
        current_style = r.style if r.style else "british_parliamentary"
        # Map style strings to utility constants keys if necessary, or just use DEBATE_FORMATS straightforwardly
        # utils.DEBATE_FORMATS keys: "NA", "ASIAN", "BP", etc.
        # round.style values (from enum): "north_american", "asian", "british_parliamentary", etc.
        
        # Simple mapping
        format_key = "BP" # Default
        if current_style == "north_american":
            format_key = "NA"
        elif current_style == "asian":
            format_key = "ASIAN"
        elif current_style == "british_parliamentary":
            format_key = "BP"
        elif current_style == "wsdc":
            format_key = "WSDC"
        elif current_style == "hpdu":
            format_key = "HPDU"
            
        target_order = DEBATE_FORMATS.get(format_key, BP_ORDER)
        
        # Sort speeches by position in target_order
        # Create a dict for easy lookup of order index
        order_map = {pos: idx for idx, pos in enumerate(target_order)}
        
        # Sort speeches. If position not in map, put at end (999)
        sorted_speeches = sorted(
            r.speeches, 
            key=lambda s: order_map.get(s.position, 999)
        )
        
        has_speeches = len(sorted_speeches) > 0
        
        # 1. Collect Speeches and ADUs in the format expected by MacroStructure.tsx
        # legacy format: speeches: [ { argument_units: [ { sequence_id: 1, start: 10.0, ... } ] }, ... ]
        formatted_speeches = []
        
        db_id_to_local_id = {}
        global_adu_index = 0
        
        for speech in sorted_speeches:
            role_name = speech.position
            adu_list = []
            
            # Sort ADUs by ID within speech
            current_adus = sorted(speech.adus, key=lambda a: a.id if a.id else 0)
            
            for adu in current_adus:
                global_adu_index += 1
                local_id = global_adu_index
                db_id_to_local_id[adu.id] = local_id

                adu_list.append({
                    "sequence_id": local_id, # Frontend expects "sequence_id"
                    "type": adu.role,
                    "text": adu.text,
                    # Frontend expects "start"
                    "start": adu.start_time if adu.start_time is not None else 0.0
                })
            
            formatted_speeches.append({
                "role": role_name,
                "argument_units": adu_list
            })

        # 2. Collect Rebuttals
        # Frontend expects: [ { src: 1, tgt: 2 }, ... ]
        rebuttals_data = []
        for speech in sorted_speeches:
            for adu in speech.adus:
                for reb in adu.rebuttals_as_source:
                    tgt_id = reb.tgt_adu_id
                    src_id = reb.src_adu_id
                    
                    if src_id in db_id_to_local_id and tgt_id in db_id_to_local_id:
                        rebuttals_data.append({
                            "src": db_id_to_local_id[src_id],
                            "tgt": db_id_to_local_id[tgt_id]
                        })
        
        has_rebuttals = len(rebuttals_data) > 0

        # Filter: Only return rounds with Rebuttals and Speeches (Step 4 Complete) AND type is 'external_video'
        if has_rebuttals and has_speeches and r.type == 'external_video':
            # Use ExternalVideo.published_at if available, else Round.created_at
            published_date = ""
            if ev and ev.published_at:
                published_date = ev.published_at.isoformat()
            elif r.created_at:
                published_date = r.created_at.isoformat()

            response_list.append({
                "id": r.id,
                "video_id": r.video_id or "",
                "title": r.name,
                "description": r.note or "",
                "motion": r.motion or "",
                "date_uploaded": published_date,
                "channel_id": "",
                "tags": r.tags or "",
                "style": r.style,
                "try_count": r.try_count,
                 # Dummy features for legacy compatibility
                "features": {
                    "distance": 0.0,
                    "interval": 0.0,
                    "order": 0.0,
                    "rally": 0.0
                },
                "pois": [], # Expects empty list, not dict
                "speeches": formatted_speeches, # Ordered list
                "rebuttals": rebuttals_data # List of objects
            })

    # タグの頻度をカウント
    tag_frequency: dict = {}
    for item in response_list:
        if item.get("tags"):
            # カンマ区切りで複数のタグが含まれる場合に対応
            tags = [t.strip() for t in item["tags"].split(",") if t.strip()]
            for tag in tags:
                tag_frequency[tag] = tag_frequency.get(tag, 0) + 1

    # 出現頻度でソート（多い順）、同じ頻度ならアルファベット順
    sorted_tags = sorted(
        tag_frequency.items(),
        key=lambda x: (-x[1], x[0])
    )

    # タグリストを生成
    tags_list = [
        {"value": "All", "label": "All", "count": len(response_list)},
        *[{"value": tag, "label": tag, "count": count} for tag, count in sorted_tags]
    ]

    return {
        "rounds": response_list,
        "tags": tags_list
    }
