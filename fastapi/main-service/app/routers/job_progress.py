from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List

from db import get_db
from cruds import job_progress as job_progress_crud

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


@router.get("/job-progress/{round_id}", response_model=JobProgressResponse)
async def get_job_progress(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    ラウンドの処理進捗を取得
    
    - 文字起こし、文、ADU、反論の完了状況を確認
    - 各スピーチ（1-8）の個別状況も返す
    - EXISTS クエリで軽量に実装
    """
    try:
        progress = await job_progress_crud.get_job_progress(db, round_id)
        return JobProgressResponse(**progress)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
