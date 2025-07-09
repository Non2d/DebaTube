import uuid
import asyncio
from typing import Dict, Optional, Any
from enum import Enum
from datetime import datetime
import threading
from models.whisper import transcribe_audio
from models.pyannote import diarize_audio
from models.whisper import SpeechRecognition
from models.pyannote import SpeakerDiarization
from models.sentence import create_sentences_from_words_and_speakers, Sentence
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
    SENTENCE_GENERATION = "sentence_generation"

class Job:
    def __init__(self, job_id: str, job_type: JobType, file_path: str, round_id: int):
        self.job_id: str = job_id
        self.job_type: JobType = job_type
        self.file_path: str = file_path
        self.round_id: int = round_id
        self.audio_filename: str = self._extract_audio_filename(file_path)
        self.status: JobStatus = JobStatus.PENDING
        self.created_at: datetime = datetime.now()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.error_message: Optional[str] = None
        self.result: Optional[Any] = None
        self.progress: int = 0
    
    def _extract_audio_filename(self, file_path: str) -> str:
        """ファイルパスからオーディオファイル名を抽出"""
        import os
        return os.path.basename(file_path)

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
                result = transcribe_audio(job.file_path)
                job.progress = 80
                self._save_speech_recognition_to_db(result, job.round_id, job.audio_filename)
                job.progress = 100
                
            elif job.job_type == JobType.SPEAKER_DIARIZATION:
                result = diarize_audio(job.file_path)
                print(f"SPEAKER_DIARIZATION job result: {result}")
                job.progress = 80
                self._save_speaker_diarization_to_db(result, job.round_id, job.audio_filename)
                job.progress = 100
            
            elif job.job_type == JobType.SENTENCE_GENERATION:
                self._generate_and_save_sentences(job.round_id, job.audio_filename)
                job.progress = 100
                result = {"message": "Sentences generated successfully"}
            
            job.result = result
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now()
            
            # ジョブ完了ログを出力
            if job.job_type in [JobType.SPEECH_RECOGNITION, JobType.SPEAKER_DIARIZATION]:
                print(f"Job completed: {job.job_type.value} for {job.audio_filename}")
                print(f"Manual sentence generation can now be triggered for {job.audio_filename}")
            
        except Exception as e:
            print(f"Job {job.job_id} failed with error: {str(e)}")
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now()
            
            # エラーログを出力
            if job.job_type in [JobType.SPEECH_RECOGNITION, JobType.SPEAKER_DIARIZATION]:
                print(f"Job failed: {job.job_type.value} for {job.audio_filename}")
    
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
        job = self.get_job(job_id)
        if not job or job.status not in [JobStatus.FAILED]:
            return False
        
        job.status = JobStatus.PENDING
        job.error_message = None
        job.result = None
        job.progress = 0
        self.start_job(job_id)
        return True
    
    
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
            
            # sentence生成
            sentences = create_sentences_from_words_and_speakers(speech_data, speaker_data)
            
            # 既存のsentenceデータを削除
            db.query(Sentence).filter(Sentence.audio_filename == audio_filename).delete()
            
            # 新しいsentenceデータを保存
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
                # 音声認識データの存在確認
                speech_count = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).count()
                
                # 話者分離データの存在確認
                speaker_count = db.query(SpeakerDiarization).filter(
                    SpeakerDiarization.audio_filename == audio_filename
                ).count()
                
                print(f"Data check for {audio_filename}: Speech records: {speech_count}, Speaker records: {speaker_count}")
                
                if speech_count == 0 or speaker_count == 0:
                    error_msg = f"Missing data for {audio_filename}. Speech: {speech_count > 0}, Speaker: {speaker_count > 0}"
                    print(error_msg)
                    return False, error_msg
                
                # 既存のsentenceデータをチェック
                sentence_count = db.query(Sentence).filter(
                    Sentence.audio_filename == audio_filename
                ).count()
                
                if sentence_count > 0:
                    msg = f"Sentences already exist for {audio_filename} ({sentence_count} records)"
                    print(msg)
                    return False, msg
                
                # round_idを取得
                speech_data = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).first()
                
                if not speech_data:
                    return False, "Failed to get round_id from speech recognition data"
                
                # sentence生成ジョブを作成
                sentence_job_id = self.create_job(
                    JobType.SENTENCE_GENERATION, 
                    "", 
                    speech_data.round_id
                )
                
                # ジョブのaudio_filenameを手動で設定
                if sentence_job_id in self.jobs:
                    self.jobs[sentence_job_id].audio_filename = audio_filename
                
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
                # 音声認識データの存在確認
                speech_count = db.query(SpeechRecognition).filter(
                    SpeechRecognition.audio_filename == audio_filename
                ).count()
                
                # 話者分離データの存在確認
                speaker_count = db.query(SpeakerDiarization).filter(
                    SpeakerDiarization.audio_filename == audio_filename
                ).count()
                
                # 既存のsentenceデータの存在確認
                sentence_count = db.query(Sentence).filter(
                    Sentence.audio_filename == audio_filename
                ).count()
                
                # sentence生成ジョブの存在確認
                sentence_job_exists = any(
                    job.audio_filename == audio_filename and job.job_type == JobType.SENTENCE_GENERATION
                    for job in self.jobs.values()
                )
                
                # ジョブの状態を取得
                sentence_job_status = "None"
                for job in self.jobs.values():
                    if job.audio_filename == audio_filename and job.job_type == JobType.SENTENCE_GENERATION:
                        sentence_job_status = job.status.value
                        break
                
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

# グローバルインスタンス
job_manager = JobManager()