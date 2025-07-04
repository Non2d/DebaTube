import uuid
import asyncio
from typing import Dict, Optional, Any
from enum import Enum
from datetime import datetime
import threading
from models.nlp_models import nlp_models
from models.sentence import SpeechRecognition, SpeakerDiarization
from database import SessionLocal
from sqlalchemy.orm import Session

class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class JobType(Enum):
    SPEECH_RECOGNITION = "speech_recognition"
    SPEAKER_DIARIZATION = "speaker_diarization"

class Job:
    def __init__(self, job_id: str, job_type: JobType, file_path: str, round_id: int):
        self.job_id = job_id
        self.job_type = job_type
        self.file_path = file_path
        self.round_id = round_id
        self.status = JobStatus.PENDING
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None
        self.error_message = None
        self.result = None
        self.progress = 0

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}
        self.lock = threading.Lock()
    
    def create_job(self, job_type: JobType, file_path: str, round_id: int) -> str:
        """新しいジョブを作成"""
        job_id = f"{job_type.value}_{str(uuid.uuid4())[:8]}"
        job = Job(job_id, job_type, file_path, round_id)
        
        with self.lock:
            self.jobs[job_id] = job
        
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """ジョブを取得"""
        with self.lock:
            return self.jobs.get(job_id)
    
    def start_job(self, job_id: str):
        """ジョブを開始"""
        job = self.get_job(job_id)
        if not job:
            return
        
        # バックグラウンドでジョブを実行
        threading.Thread(target=self._execute_job, args=(job,), daemon=True).start()
    
    def _execute_job(self, job: Job):
        """ジョブを実行"""
        try:
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.now()
            job.progress = 10
            
            if job.job_type == JobType.SPEECH_RECOGNITION:
                result = nlp_models.transcribe_audio(job.file_path)
                job.progress = 80
                self._save_speech_recognition_to_db(result, job.round_id)
                job.progress = 100
                
            elif job.job_type == JobType.SPEAKER_DIARIZATION:
                result = nlp_models.diarize_speakers(job.file_path)
                job.progress = 80
                self._save_speaker_diarization_to_db(result, job.round_id)
                job.progress = 100
            
            job.result = result
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now()
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now()
    
    def _save_speech_recognition_to_db(self, data: list, round_id: int):
        """音声認識結果をDBに保存"""
        db: Session = SessionLocal()
        try:
            for item in data:
                speech_record = SpeechRecognition(
                    round_id=round_id,
                    start=item["start"],
                    end=item["end"],
                    text=item["text"],
                    created_at=datetime.now()
                )
                db.add(speech_record)
            db.commit()
        finally:
            db.close()
    
    def _save_speaker_diarization_to_db(self, data: list, round_id: int):
        """話者分離結果をDBに保存"""
        db: Session = SessionLocal()
        try:
            for item in data:
                speaker_record = SpeakerDiarization(
                    round_id=round_id,
                    start=item["start"],
                    end=item["end"],
                    speaker=item["speaker"],
                    created_at=datetime.now()
                )
                db.add(speaker_record)
            db.commit()
        finally:
            db.close()
    
    def retry_job(self, job_id: str) -> bool:
        """ジョブをリトライ"""
        job = self.get_job(job_id)
        if not job or job.status not in [JobStatus.FAILED]:
            return False
        
        job.status = JobStatus.PENDING
        job.error_message = None
        job.result = None
        job.progress = 0
        self.start_job(job_id)
        return True

# グローバルインスタンス
job_manager = JobManager()