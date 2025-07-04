import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from models.job_manager import job_manager, JobType, JobStatus
from datetime import datetime

router = APIRouter()

class JobRequest(BaseModel):
    file_path: str = Field(..., example="/storage/audio.wav")
    round_id: int = Field(..., example=1)
    language: str = Field(default="english", example="english")

class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    result: Optional[Any]

@router.post("/speech-recognition", response_model=JobResponse)
async def start_speech_recognition(request: JobRequest):
    """
    音声認識ジョブを開始
    
    Args:
        request: ファイルパスとラウンドIDを含むリクエスト
    
    Returns:
        JobResponse: ジョブIDと開始状態
    """
    try:
        # ファイルの存在確認
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=400, detail=f"File not found: {request.file_path}")
        
        # ジョブを作成・開始
        job_id = job_manager.create_job(
            JobType.SPEECH_RECOGNITION, 
            request.file_path, 
            request.round_id
        )
        job_manager.start_job(job_id)
        
        return JobResponse(
            job_id=job_id,
            status="processing",
            message="Speech recognition job started"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start speech recognition: {str(e)}")

@router.post("/speaker-diarization", response_model=JobResponse)
async def start_speaker_diarization(request: JobRequest):
    """
    話者分離ジョブを開始
    
    Args:
        request: ファイルパスとラウンドIDを含むリクエスト
    
    Returns:
        JobResponse: ジョブIDと開始状態
    """
    try:
        # ファイルの存在確認
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=400, detail=f"File not found: {request.file_path}")
        
        # ジョブを作成・開始
        job_id = job_manager.create_job(
            JobType.SPEAKER_DIARIZATION, 
            request.file_path, 
            request.round_id
        )
        job_manager.start_job(job_id)
        
        return JobResponse(
            job_id=job_id,
            status="processing",
            message="Speaker diarization job started"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start speaker diarization: {str(e)}")

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    ジョブの状態を取得
    
    Args:
        job_id: ジョブID
    
    Returns:
        JobStatusResponse: ジョブの詳細状態
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status.value,
        progress=job.progress,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
        result=job.result
    )

@router.post("/jobs/{job_id}/retry", response_model=JobResponse)
async def retry_job(job_id: str):
    """
    失敗したジョブをリトライ
    
    Args:
        job_id: ジョブID
    
    Returns:
        JobResponse: リトライ結果
    """
    success = job_manager.retry_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Job cannot be retried")
    
    return JobResponse(
        job_id=job_id,
        status="processing",
        message="Job retry started"
    )