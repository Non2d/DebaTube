import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from models.nlp_models import nlp_models
from models.sentence import SpeechRecognition, SpeakerDiarization
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

