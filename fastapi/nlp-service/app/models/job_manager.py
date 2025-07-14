import uuid
import asyncio
from typing import Dict, Optional, Any
from enum import Enum
from datetime import datetime
import threading
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import Session
from models.whisper import transcribe_audio
from models.pyannote import diarize_audio
from models.whisper import SpeechRecognition
from models.pyannote import SpeakerDiarization
from models.sentence import create_sentences_from_words_and_speakers, Sentence
from database import SessionLocal, Base

class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class JobType(Enum):
    SPEECH_RECOGNITION = "speech_recognition"
    SPEAKER_DIARIZATION = "speaker_diarization"
    SENTENCE_GENERATION = "sentence_generation"

class Job(Base):
    __tablename__ = "jobs"
    
    job_id = Column(String(255), primary_key=True)
    job_type = Column(SQLEnum(JobType), nullable=False)
    round_id = Column(Integer, index=True)
    audio_filename = Column(String(255), nullable=False, index=True)
    status = Column(SQLEnum(JobStatus), nullable=False, default=JobStatus.PENDING)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    error_message = Column(Text)
    result_data = Column(JSON)
    progress = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    
    def __init__(self, job_id: str, job_type: JobType, audio_filename: str, round_id: int):
        self.job_id = job_id
        self.job_type = job_type
        self.audio_filename = audio_filename
        self.round_id = round_id
        self.status = JobStatus.PENDING
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.progress = 0
        self.retry_count = 0

class JobManager:
    def __init__(self):
        self.lock = threading.Lock()
    
    def create_job(self, job_type: JobType, audio_filename: str, round_id: int) -> str:
        """新しいジョブを作成"""
        job_id = f"{job_type.value}_{str(uuid.uuid4())[:8]}"
        job = Job(job_id, job_type, audio_filename, round_id)
        
        db: Session = SessionLocal()
        try:
            db.add(job)
            db.commit()
            return job_id
        finally:
            db.close()
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """ジョブを取得"""
        db: Session = SessionLocal()
        try:
            return db.query(Job).filter(Job.job_id == job_id).first()
        finally:
            db.close()
    
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
            self._update_job_status(job.job_id, JobStatus.PROCESSING, progress=10, started_at=datetime.utcnow())
            
            if job.job_type == JobType.SPEECH_RECOGNITION:
                file_path = f"storage/{job.audio_filename}"
                result = transcribe_audio(file_path)
                self._update_job_status(job.job_id, progress=80)
                self._save_speech_recognition_to_db(result, job.round_id, job.audio_filename)
                self._update_job_status(job.job_id, progress=100)
                
            elif job.job_type == JobType.SPEAKER_DIARIZATION:
                file_path = f"storage/{job.audio_filename}"
                result = diarize_audio(file_path)
                print(f"SPEAKER_DIARIZATION job result: {result}")
                self._update_job_status(job.job_id, progress=80)
                self._save_speaker_diarization_to_db(result, job.round_id, job.audio_filename)
                self._update_job_status(job.job_id, progress=100)
            
            elif job.job_type == JobType.SENTENCE_GENERATION:
                self._generate_and_save_sentences(job.round_id, job.audio_filename)
                self._update_job_status(job.job_id, progress=100)
                result = {"message": "Sentences generated successfully"}
            
            self._update_job_status(job.job_id, JobStatus.COMPLETED, 
                                  result_data=result, completed_at=datetime.utcnow())
            
            # ジョブ完了ログを出力と自動sentence generation
            if job.job_type in [JobType.SPEECH_RECOGNITION, JobType.SPEAKER_DIARIZATION]:
                print(f"Job completed: {job.job_type.value} for {job.audio_filename}")
                
                # speech recognitionとspeaker diarizationが両方完了したかチェック
                if self._check_prerequisites_for_sentence_generation(job.audio_filename, job.round_id):
                    print(f"Prerequisites met. Auto-triggering sentence generation for {job.audio_filename}")
                    success, message = self.trigger_sentence_generation_for_audio(job.audio_filename)
                    if success:
                        print(f"Auto sentence generation started: {message}")
                    else:
                        print(f"Auto sentence generation failed: {message}")
                else:
                    print(f"Waiting for other prerequisites for {job.audio_filename}")
            
        except Exception as e:
            print(f"Job {job.job_id} failed with error: {str(e)}")
            self._update_job_status(job.job_id, JobStatus.FAILED, 
                                  error_message=str(e), completed_at=datetime.utcnow())
            
            # エラーログを出力
            if job.job_type in [JobType.SPEECH_RECOGNITION, JobType.SPEAKER_DIARIZATION]:
                print(f"Job failed: {job.job_type.value} for {job.audio_filename}")
    
    def _update_job_status(self, job_id: str, status: JobStatus = None, progress: int = None, 
                          started_at: datetime = None, completed_at: datetime = None,
                          error_message: str = None, result_data: Any = None):
        """ジョブのステータスを更新"""
        db: Session = SessionLocal()
        try:
            job = db.query(Job).filter(Job.job_id == job_id).first()
            if job:
                if status is not None:
                    job.status = status
                if progress is not None:
                    job.progress = progress
                if started_at is not None:
                    job.started_at = started_at
                if completed_at is not None:
                    job.completed_at = completed_at
                if error_message is not None:
                    job.error_message = error_message
                if result_data is not None:
                    job.result_data = result_data
                job.updated_at = datetime.utcnow()
                db.commit()
        finally:
            db.close()
    
    def _save_speech_recognition_to_db(self, data: list, round_id: int, audio_filename: str):
        """音声認識結果をDBに保存"""
        db: Session = SessionLocal()
        try:
            for item in data:
                speech_record = SpeechRecognition(
                    round_id=round_id,
                    audio_filename=audio_filename,
                    start=item["start"],
                    end=item["end"],
                    text=item["text"],
                    created_at=datetime.now()
                )
                db.add(speech_record)
            db.commit()
        finally:
            db.close()
    
    def _save_speaker_diarization_to_db(self, data: list, round_id: int, audio_filename: str):
        """話者分離結果をDBに保存"""
        db: Session = SessionLocal()
        try:
            print(f"Saving speaker diarization data to DB for round_id: {round_id}, audio_filename: {audio_filename}")
            for item in data:
                print(f"Saving item: {item}")
                speaker_record = SpeakerDiarization(
                    round_id=round_id,
                    audio_filename=audio_filename,
                    start=item["start"],
                    end=item["end"],
                    speaker=item["speaker"],
                    created_at=datetime.now()
                )
                db.add(speaker_record)
            db.commit()
            print(f"Successfully saved {len(data)} speaker diarization records")
        finally:
            db.close()
    
    def retry_job(self, job_id: str) -> bool:
        """ジョブをリトライ"""
        db: Session = SessionLocal()
        try:
            job = db.query(Job).filter(Job.job_id == job_id).first()
            if not job or job.status not in [JobStatus.FAILED]:
                return False
            
            job.status = JobStatus.PENDING
            job.error_message = None
            job.result_data = None
            job.progress = 0
            job.retry_count += 1
            job.started_at = None
            job.completed_at = None
            job.updated_at = datetime.utcnow()
            db.commit()
            
            self.start_job(job_id)
            return True
        finally:
            db.close()
    
    
    def _generate_and_save_sentences(self, round_id: int, audio_filename: str):
        """sentence生成とDB保存"""
        db: Session = SessionLocal()
        try:
            # 音声認識結果を取得
            speech_data = db.query(SpeechRecognition).filter(
                SpeechRecognition.audio_filename == audio_filename
            ).order_by(SpeechRecognition.start).all()
            
            # 話者分離結果を取得
            speaker_data = db.query(SpeakerDiarization).filter(
                SpeakerDiarization.audio_filename == audio_filename
            ).order_by(SpeakerDiarization.start).all()
            
            if not speech_data or not speaker_data:
                raise Exception(f"Speech recognition or speaker diarization data not found for audio_filename {audio_filename}")
            
            sentences = create_sentences_from_words_and_speakers(speech_data, speaker_data)
            db.query(Sentence).filter(Sentence.audio_filename == audio_filename).delete()
            
            for sentence in sentences:
                sentence_record = Sentence(
                    round_id=round_id,
                    audio_filename=audio_filename,
                    start=sentence["start"],
                    end=sentence["end"],
                    speaker=sentence["speaker"],
                    text=sentence["text"],
                    created_at=datetime.now()
                )
                db.add(sentence_record)
            
            db.commit()
            print(f"Successfully generated and saved {len(sentences)} sentences for audio_filename {audio_filename}")
        finally:
            db.close()
    
    
    def trigger_sentence_generation_for_audio(self, audio_filename: str) -> tuple[bool, str]:
        """特定のオーディオファイルに対して手動でsentence生成をトリガー"""
        try:
            db: Session = SessionLocal()
            try:
                speech_count = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).count()
                speaker_count = db.query(SpeakerDiarization).filter(
                    SpeakerDiarization.audio_filename == audio_filename
                ).count()
                print(f"Data check for {audio_filename}: Speech records: {speech_count}, Speaker records: {speaker_count}")
                
                if speech_count == 0 or speaker_count == 0:
                    error_msg = f"Missing data for {audio_filename}. Speech: {speech_count > 0}, Speaker: {speaker_count > 0}"
                    print(error_msg)
                    return False, error_msg

                sentence_count = db.query(Sentence).filter(
                    Sentence.audio_filename == audio_filename
                ).count()
                
                if sentence_count > 0:
                    msg = f"Sentences already exist for {audio_filename} ({sentence_count} records)"
                    print(msg)
                    return False, msg
                
                speech_data = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).first()
                
                if not speech_data:
                    return False, "Failed to get round_id from speech recognition data"
                
                sentence_job_id = self.create_job(
                    JobType.SENTENCE_GENERATION, 
                    audio_filename, 
                    speech_data.round_id
                )
                
                self.start_job(sentence_job_id)
                success_msg = f"Successfully triggered sentence generation job {sentence_job_id} for {audio_filename}"
                print(success_msg)
                return True, success_msg
                
            finally:
                db.close()
                
        except Exception as e:
            error_msg = f"Error triggering sentence generation for {audio_filename}: {str(e)}"
            print(error_msg)
            return False, error_msg
    
    def check_sentence_generation_readiness(self, audio_filename: str) -> dict:
        """特定のオーディオファイルのsentence生成の準備状況をチェック"""
        try:
            db: Session = SessionLocal()
            try:
                speech_count = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).count()
                speaker_count = db.query(SpeakerDiarization).filter(
                    SpeakerDiarization.audio_filename == audio_filename
                ).count()
                sentence_count = db.query(Sentence).filter(
                    Sentence.audio_filename == audio_filename
                ).count()
                sentence_job = db.query(Job).filter(
                    Job.audio_filename == audio_filename,
                    Job.job_type == JobType.SENTENCE_GENERATION
                ).first()
                
                sentence_job_exists = sentence_job is not None
                sentence_job_status = sentence_job.status.value if sentence_job else "None"
                ready_for_generation = speech_count > 0 and speaker_count > 0 and sentence_count == 0 and not sentence_job_exists
                
                return {
                    "audio_filename": audio_filename,
                    "speech_recognition_records": speech_count,
                    "speaker_diarization_records": speaker_count,
                    "sentence_records": sentence_count,
                    "sentence_job_exists": sentence_job_exists,
                    "sentence_job_status": sentence_job_status,
                    "ready_for_generation": ready_for_generation,
                    "status_message": self._get_status_message(speech_count, speaker_count, sentence_count, sentence_job_exists, sentence_job_status)
                }
                
            finally:
                db.close()
                
        except Exception as e:
            return {
                "audio_filename": audio_filename,
                "error": str(e),
                "ready_for_generation": False
            }
    
    def _check_prerequisites_for_sentence_generation(self, audio_filename: str, round_id: int) -> bool:
        """
        sentence generation実行の前提条件をチェック
        - speech recognitionデータが存在する
        - speaker diarizationデータが存在する
        - sentence generationがまだ実行されていない
        """
        try:
            db: Session = SessionLocal()
            try:
                speech_count = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).count()
                speaker_count = db.query(SpeakerDiarization).filter(
                    SpeakerDiarization.audio_filename == audio_filename
                ).count()
                sentence_count = db.query(Sentence).filter(
                    Sentence.audio_filename == audio_filename
                ).count()
                sentence_job_running = db.query(Job).filter(
                    Job.audio_filename == audio_filename,
                    Job.job_type == JobType.SENTENCE_GENERATION,
                    Job.status.in_([JobStatus.PENDING, JobStatus.PROCESSING])
                ).count() > 0
                
                # 前提条件: speech + speaker データがあり、sentence データが無く、ジョブも実行中でない
                return (speech_count > 0 and speaker_count > 0 and 
                       sentence_count == 0 and not sentence_job_running)
                
            finally:
                db.close()
                
        except Exception as e:
            print(f"Error checking prerequisites for {audio_filename}: {str(e)}")
            return False
    
    def _get_status_message(self, speech_count: int, speaker_count: int, sentence_count: int, sentence_job_exists: bool, sentence_job_status: str) -> str:
        """状態メッセージを生成"""
        if sentence_count > 0:
            return f"Sentences already generated ({sentence_count} records)"
        elif sentence_job_exists:
            return f"Sentence generation job in progress (status: {sentence_job_status})"
        elif speech_count == 0:
            return "Missing speech recognition data"
        elif speaker_count == 0:
            return "Missing speaker diarization data"
        else:
            return "Ready for sentence generation"
    
    def get_jobs_by_audio_filename(self, audio_filename: str) -> list:
        """指定された音声ファイル名に関連するすべてのジョブを取得"""
        db: Session = SessionLocal()
        try:
            jobs = db.query(Job).filter(Job.audio_filename == audio_filename).all()
            return [{
                "job_id": job.job_id,
                "job_type": job.job_type.value,
                "status": job.status.value,
                "progress": job.progress,
                "created_at": job.created_at,
                "started_at": job.started_at,
                "completed_at": job.completed_at,
                "updated_at": job.updated_at,
                "retry_count": job.retry_count,
                "error_message": job.error_message
            } for job in jobs]
        finally:
            db.close()

def create_jobs_table():
    """jobs テーブルを作成"""
    try:
        from database import engine
        
        # jobs テーブルのみを作成
        Job.__table__.create(bind=engine, checkfirst=True)
        
        print("✅ jobs テーブルが正常に作成されました")
        return True
        
    except Exception as e:
        print(f"❌ エラーが発生しました: {str(e)}")
        return False

# グローバルインスタンス
job_manager = JobManager()