from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional

from db import get_db
from cruds import job_progress as job_progress_crud
from services.transcription_service import get_batch_transcription_status, get_cached_video_ids_remote
from models.round import Round, Word, Sentence
from utils.audio import get_audio_path

router = APIRouter()


class SpeechProgress(BaseModel):
    """スピーチごとの進捗状況"""
    position: str  # "Proposition_1st", "Opposition_1st", etc.
    has_audio: bool | None  # Deprecated, will be None
    has_transcription: bool
    has_sentences: bool
    has_adus: bool


class JobProgressResponse(BaseModel):
    """ラウンド全体の処理進捗"""
    round_id: int
    external_has_audio: bool  # 外部GPUサーバーに音声ファイルが存在するか
    local_has_audio: bool  # ローカル（VPS）に音声ファイルが存在するか
    has_all_raw_speech_transcription: bool  # 全スピーチの文字起こしが完了しているか
    has_raw_round_transcription: bool  # ラウンド全体の文字起こしが存在するか
    words_registered: bool
    sentences_registered: bool
    speeches_complete: bool
    adus_complete: bool
    rebuttals_complete: bool
    speeches: List[SpeechProgress]


@router.get("/job-progress-v1", response_model=JobProgressResponse)
async def get_job_progress_v1(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    ラウンドの処理進捗を取得 (Legacy version - DB only, no Galleria API)
    
    - 文字起こし、文、ADU、反論の完了状況を確認
    - 各スピーチ（1-8）の個別状況も返す
    - EXISTS クエリで軽量に実装
    """
    try:
        progress = await job_progress_crud.get_job_progress(db, round_id)
        return JobProgressResponse(**progress)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/job-progress/{round_id}", response_model=JobProgressResponse)
async def get_job_progress(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    ラウンドの処理進捗を取得 (New version - integrates with Galleria API)
    
    - Step 1-A: Audio download status (external + local cache check)
    - Step 1-B: Transcription status (Galleria API + DB check)
    - Step 1-C: Words registered (DB check)
    - Step 1-D: Sentences registered (DB check)
    - Step 2-4: Speech/ADU/Rebuttal status (DB check)
    """
    try:
        # Get Round object
        round_result = await db.execute(select(Round).where(Round.id == round_id))
        round_obj = round_result.scalar_one_or_none()
        
        if not round_obj:
            raise HTTPException(status_code=404, detail="Round not found")
        
        # Step 1-A: Audio Download
        external_has_audio = False
        local_has_audio = False
        
        if round_obj.video_id:
            # Check external cache
            try:
                cache_data = await get_cached_video_ids_remote()
                cached_video_ids = cache_data.get("cached_video_ids", [])
                external_has_audio = round_obj.video_id in cached_video_ids
            except:
                pass
            
            # Check local cache
            audio_path = get_audio_path(round_obj.video_id)
            local_has_audio = bool(audio_path)
        
        # Step 1-B: Transcription (Galleria API + DB)
        galleria_statuses = await get_batch_transcription_status([round_id])
        galleria_status = galleria_statuses.get(round_id)
        has_raw_round_transcription = round_obj.raw_transcription is not None
        
        # Consider transcription complete if either:
        # 1. Galleria API reports COMPLETED, or
        # 2. DB has raw_transcription
        transcription_complete = (galleria_status == "COMPLETED") or has_raw_round_transcription
        
        # Step 1-C: Words registered
        word_count_stmt = select(func.count(Word.id)).where(Word.round_id == round_id)
        word_count = (await db.execute(word_count_stmt)).scalar() or 0
        words_registered = word_count >= 3
        
        # Step 1-D: Sentences registered
        sentence_count_stmt = select(func.count(Sentence.id)).where(Sentence.round_id == round_id)
        sentence_count = (await db.execute(sentence_count_stmt)).scalar() or 0
        sentences_registered = sentence_count >= 3
        
        # Get legacy progress data for speeches/ADUs/rebuttals
        legacy_progress = await job_progress_crud.get_job_progress(db, round_id)
        
        return JobProgressResponse(
            round_id=round_id,
            external_has_audio=external_has_audio,
            local_has_audio=local_has_audio,
            has_all_raw_speech_transcription=legacy_progress["has_all_raw_speech_transcription"],
            has_raw_round_transcription=transcription_complete,  # Updated with Galleria API
            words_registered=words_registered,
            sentences_registered=sentences_registered,
            speeches_complete=legacy_progress["speeches_complete"],
            adus_complete=legacy_progress["adus_complete"],
            rebuttals_complete=legacy_progress["rebuttals_complete"],
            speeches=legacy_progress["speeches"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

