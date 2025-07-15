import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List, Literal
from models.whisper import transcribe_audio
from models.pyannote import diarize_audio
from models.whisper import SpeechRecognition
from models.pyannote import SpeakerDiarization
from models.job_manager import job_manager, JobType, JobStatus
from database import SessionLocal
from sqlalchemy.orm import Session
from datetime import datetime

router = APIRouter()

class JobRequest(BaseModel):
    filename: str = Field(..., example="audio.wav")
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
    result_head: Optional[Any] #TODO:直接sentences等の元のテーブルを参照する

class JobRetryRequest(BaseModel):
    job_id: str = Field(..., example="abc123")

@router.post("/trigger-speech-recognition", response_model=SpeechRecognitionResponse, tags=["Manual Triggers"])
async def process_speech_recognition(request: JobRequest):
    """
    音声認識を実行してDBに保存し、結果を返す
    
    Args:
        request: ファイル名とラウンドIDを含むリクエスト
    
    Returns:
        SpeechRecognitionResponse: 音声認識結果
    """
    try:
        # ファイルパスを構築
        file_path = f"storage/{request.filename}"
        
        # ファイルの存在確認
        if not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail=f"File not found: {request.filename}")
        
        # 音声認識実行
        result = transcribe_audio(file_path, request.language)
        
        # DBに保存 - job_managerの関数を使用
        try:
            job_manager._save_speech_recognition_to_db(result, request.round_id, request.filename)
            print(f"Saved {len(result)} speech recognition records to database")
            
            # 自動sentence generation チェック
            if job_manager._check_prerequisites_for_sentence_generation(request.filename, request.round_id):
                print(f"Prerequisites met. Auto-triggering sentence generation for {request.filename}")
                success, message = job_manager.trigger_sentence_generation_for_audio(request.filename)
                if success:
                    print(f"Auto sentence generation started: {message}")
                else:
                    print(f"Auto sentence generation failed: {message}")
                    
        except Exception as e:
            print(f"Database save error: {e}")
            raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")
        
        return SpeechRecognitionResponse(
            success=True,
            message="Speech recognition completed",
            data=result
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process speech recognition: {str(e)}")

@router.post("/trigger-speaker-diarization", response_model=SpeakerDiarizationResponse, tags=["Manual Triggers"])
async def process_speaker_diarization(request: JobRequest):
    """
    話者分離を実行してDBに保存し、結果を返す
    
    Args:
        request: ファイル名とラウンドIDを含むリクエスト
    
    Returns:
        SpeakerDiarizationResponse: 話者分離結果
    """
    try:
        # ファイルパスを構築
        file_path = f"storage/{request.filename}"
        
        # ファイルの存在確認
        if not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail=f"File not found: {request.filename}")
        
        # 話者分離実行
        result = diarize_audio(file_path)
        
        # DBに保存 - job_managerの関数を使用
        try:
            job_manager._save_speaker_diarization_to_db(result, request.round_id, request.filename)
            print(f"Saved {len(result)} speaker diarization records to database")
            
            # 自動sentence generation チェック
            if job_manager._check_prerequisites_for_sentence_generation(request.filename, request.round_id):
                print(f"Prerequisites met. Auto-triggering sentence generation for {request.filename}")
                success, message = job_manager.trigger_sentence_generation_for_audio(request.filename)
                if success:
                    print(f"Auto sentence generation started: {message}")
                else:
                    print(f"Auto sentence generation failed: {message}")
                    
        except Exception as e:
            print(f"Database save error: {e}")
            raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")
        
        print(result)
        
        return SpeakerDiarizationResponse(
            success=True,
            message="Speaker diarization completed",
            data=result
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process speaker diarization: {str(e)}")

@router.post("/trigger-sentence-generation", tags=["Manual Triggers"])
async def trigger_sentence_generation(request: JobRequest):
    """手動でsentence生成をトリガー"""
    try:
        success, message = job_manager.trigger_sentence_generation_for_audio(request.filename)
        
        if success:
            return {"status": "success", "message": message}
        else:
            # 400 Bad Requestで適切なエラーメッセージを返す
            raise HTTPException(status_code=400, detail=message)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/job/retry", tags=["Job Control"])
async def retry_job(request: JobRetryRequest):
    """
    ジョブをリトライ（job_idによる指定）
    
    Args:
        request: job_idを含むリクエスト
    
    Returns:
        JobResponse: リトライ結果
    """
    try:
        success = job_manager.retry_job(request.job_id)
        if not success:
            raise HTTPException(status_code=400, detail="Job cannot be retried")
        
        return JobResponse(
            job_id=request.job_id,
            status="processing",
            message="Job retry started"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/jobs", tags=["Job Control"])
async def query_jobs(
    job_id: Optional[str] = Query(None, description="ジョブID"),
    audio_filename: Optional[str] = Query(None, description="音声ファイル名")
):
    """
    ジョブを検索（クエリパラメータ使用）
    
    Args:
        job_id: ジョブID（オプション）
        audio_filename: 音声ファイル名（オプション）
    
    Returns:
        JobStatusResponse or dict: ジョブ情報
    """
    try:
        if audio_filename:
            # 拡張子がない場合、mp3とwavの両方を検索
            if '.' not in audio_filename:
                mp3_jobs = job_manager.get_jobs_by_audio_filename(f"{audio_filename}.mp3")
                wav_jobs = job_manager.get_jobs_by_audio_filename(f"{audio_filename}.wav")
                all_jobs = mp3_jobs + wav_jobs
                return {"audio_filename": audio_filename, "jobs": all_jobs}
            else:
                jobs = job_manager.get_jobs_by_audio_filename(audio_filename)
                return {"audio_filename": audio_filename, "jobs": jobs}
        
        elif job_id:
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
                result_head=job.result_head
            )
        
        else:
            raise HTTPException(status_code=400, detail="Either job_id or audio_filename is required")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
