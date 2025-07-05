import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from models.nlp_models import nlp_models
from models.sentence import SpeechRecognition, SpeakerDiarization
from models.job_manager import job_manager, JobType, JobStatus
from database import SessionLocal
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter()

class JobRequest(BaseModel):
    file_path: str = Field(..., example="/storage/audio.wav")
    round_id: int = Field(..., example=1)
    language: str = Field(default="english", example="english")

class SpeechRecognitionResponse(BaseModel):
    success: bool
    message: str
    data: List[Dict[str, Any]]
    
class SpeakerDiarizationResponse(BaseModel):
    success: bool
    message: str
    data: List[Dict[str, Any]]

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

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    result: Optional[Any]

@router.post("/speech-recognition", response_model=SpeechRecognitionResponse)
async def process_speech_recognition(request: JobRequest):
    """
    音声認識を実行してDBに保存し、結果を返す
    
    Args:
        request: ファイルパスとラウンドIDを含むリクエスト
    
    Returns:
        SpeechRecognitionResponse: 音声認識結果
    """
    try:
        # ファイルの存在確認
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=400, detail=f"File not found: {request.file_path}")
        
        # 音声認識実行
        result = nlp_models.transcribe_audio(request.file_path, request.language)
        
        # DBに保存
        db: Session = SessionLocal()
        try:
            for item in result:
                speech_record = SpeechRecognition(
                    round_id=request.round_id,
                    start=item["start"],
                    end=item["end"],
                    text=item["text"],
                    created_at=datetime.now()
                )
                db.add(speech_record)
            db.commit()
        finally:
            db.close()
        
        return SpeechRecognitionResponse(
            success=True,
            message="Speech recognition completed",
            data=result
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process speech recognition: {str(e)}")

@router.post("/speaker-diarization", response_model=SpeakerDiarizationResponse)
async def process_speaker_diarization(request: JobRequest):
    """
    話者分離を実行してDBに保存し、結果を返す
    
    Args:
        request: ファイルパスとラウンドIDを含むリクエスト
    
    Returns:
        SpeakerDiarizationResponse: 話者分離結果
    """
    try:
        # ファイルの存在確認
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=400, detail=f"File not found: {request.file_path}")
        
        # 話者分離実行
        result = nlp_models.diarize_speakers(request.file_path)
        
        # DBに保存
        db: Session = SessionLocal()
        try:
            for item in result:
                speaker_record = SpeakerDiarization(
                    round_id=request.round_id,
                    start=item["start"],
                    end=item["end"],
                    speaker=item["speaker"],
                    created_at=datetime.now()
                )
                db.add(speaker_record)
            db.commit()
        finally:
            db.close()
        
        return SpeakerDiarizationResponse(
            success=True,
            message="Speaker diarization completed",
            data=result
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process speaker diarization: {str(e)}")

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
