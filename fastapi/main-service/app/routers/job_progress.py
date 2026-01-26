from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

from db import get_db
from cruds import job_progress as job_progress_crud

router = APIRouter()


class BackgroundJobStatus(str, Enum):
    """バックグラウンドジョブのステータス"""
    NOT_IN_QUEUE = "NOT_IN_QUEUE"
    IN_QUEUE = "IN_QUEUE"
    PROCESSING = "PROCESSING"
    DONE = "DONE"


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


class JobProgressBackgroundResponse(BaseModel):
    """バックグラウンド文字起こし用の処理進捗"""
    round_id: int
    step_1: BackgroundJobStatus   # 1b, 1c, 1d が全て DONE のとき DONE
    step_1a: BackgroundJobStatus  # NOT_IN_QUEUE or DONE
    step_1b: BackgroundJobStatus  # NOT_IN_QUEUE, IN_QUEUE, PROCESSING, DONE, ERROR
    step_1c: BackgroundJobStatus  # NOT_IN_QUEUE or DONE
    step_1d: BackgroundJobStatus  # NOT_IN_QUEUE or DONE
    step_2: BackgroundJobStatus   # NOT_IN_QUEUE or DONE
    step_3: BackgroundJobStatus   # NOT_IN_QUEUE or DONE
    step_4: BackgroundJobStatus   # NOT_IN_QUEUE or DONE


class JobProgressBackgroundBatchRequest(BaseModel):
    """複数ラウンドの処理進捗取得リクエスト"""
    round_ids: List[int]


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


@router.get("/job-progress-background/{round_id}", response_model=JobProgressBackgroundResponse)
async def get_job_progress_background(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    バックグラウンド文字起こし用のラウンド処理進捗を取得

    - Step 1-A, 1-C, 1-D, 2, 3, 4: "not_in_queue" or "done"
    - Step 1-B: 外部APIステータスと対応
        - "NOT_IN_QUEUE" (404)
        - "IN_QUEUE" (PENDING)
        - "PROCESSING"
        - "DONE" (COMPLETED)
        - "ERROR"
    """
    try:
        progress = await job_progress_crud.get_job_progress_background(db, round_id)
        return JobProgressBackgroundResponse(**progress)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/job-progress-background-batch", response_model=List[JobProgressBackgroundResponse])
async def post_job_progress_background_batch(
    request: JobProgressBackgroundBatchRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    バックグラウンド文字起こし用のラウンド処理進捗を取得（複数試合一括）

    - Step 1-A, 1-C, 1-D, 2, 3, 4: "not_in_queue" or "done"
    - Step 1-B: 外部APIステータスと対応
        - "NOT_IN_QUEUE" (404)
        - "IN_QUEUE" (PENDING)
        - "PROCESSING"
        - "DONE" (COMPLETED)
        - "ERROR"
    """
    try:
        results = await job_progress_crud.get_job_progress_background_batch(db, request.round_ids)
        return [JobProgressBackgroundResponse(**r) for r in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
