import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from models.job_manager import job_manager
from datetime import datetime

router = APIRouter()

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

class JobTriggerRequest(BaseModel):
    job_id: str = Field(..., example="speech_recognition_abc123")

@router.post("/job/trigger", tags=["Job Control"])
async def trigger_job(request: JobTriggerRequest):
    """
    ジョブをトリガー（job_idによる指定）
    
    Args:
        request: job_idを含むリクエスト
    
    Returns:
        JobResponse: トリガー結果
    """
    try:
        # 既存のジョブを再トリガー
        success = job_manager.trigger_job(request.job_id)
        if success:
            return JobResponse(
                job_id=request.job_id,
                status="processing",
                message="Job triggered successfully"
            )
        else:
            raise HTTPException(status_code=400, detail="Job cannot be triggered")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

class JobCreateRequest(BaseModel):
    job_id: str = Field(..., example="abc123")

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
