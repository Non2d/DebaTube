import os
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, Union
import glob

from models.audio import extract_audio_from_youtube, save_uploaded_audio
from models.job_manager import job_manager, JobType

router = APIRouter()

class AudioResponse(BaseModel):
    success: bool
    filename: str
    message: str
    speech_recognition_job_id: str
    speaker_diarization_job_id: str
    group_speech_job_id: str
    sentence_generation_job_id: str

@router.post("/process-audio", response_model=AudioResponse, tags=["Audio Tasks"])
async def process_audio(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    round_id: int = Form(...),
    start_bg_tasks: bool = Form(default=False)
):
    """
    音声ファイルのアップロードまたはYouTubeのURL(例：https://www.youtube.com/watch?v=vSUTLRj7s7s)から音声を処理する統合エンドポイント
    
    Args:
        file: アップロードされる音声ファイル（オプション）
        url: YouTubeのURL（オプション）
        round_id: ラウンドID
        start_bg_tasks: バックグラウンドタスクを自動開始するか
    
    Returns:
        AudioResponse: 保存されたファイルパスと結果
    """
    try:
        if not file and not url:
            raise HTTPException(status_code=400, detail="Either file or URL must be provided")
        elif file and url:
            raise HTTPException(status_code=400,detail="Provide either file or URL, not both")
        
        if file:
            file_content = await file.read()
            file_path = save_uploaded_audio(file_content, file.filename)
            message = "Successfully uploaded and saved audio file"
        else:
            file_path = extract_audio_from_youtube(url)
            message = "Successfully extracted audio file from YouTube"
        
        base_filename = os.path.splitext(os.path.basename(file_path))[0]
        mp3_filename = f"{base_filename}.mp3"
        wav_filename = f"{base_filename}.wav"
        speech_job_id = job_manager.create_job(
            JobType.SPEECH_RECOGNITION, 
            mp3_filename, 
            round_id
        )
        speaker_job_id = job_manager.create_job(
            JobType.SPEAKER_DIARIZATION, 
            wav_filename, 
            round_id
        )
        speech_group_job_id = job_manager.create_job(
            JobType.GROUPING_SPEECH,
            mp3_filename,
            round_id
        )
        sentence_job_id = job_manager.create_job(
            JobType.SENTENCE_GENERATION, 
            mp3_filename, 
            round_id
        )
        
        if start_bg_tasks: #バックグランドタスクの自動発火
            job_manager.start_job(speech_job_id)
            job_manager.start_job(speaker_job_id)
        
        filename = os.path.splitext(os.path.basename(file_path))[0]
        
        return AudioResponse(
            success=True,
            filename=filename,
            message=message,
            speech_recognition_job_id=speech_job_id,
            speaker_diarization_job_id=speaker_job_id,
            group_speech_job_id=speech_group_job_id,
            sentence_generation_job_id=sentence_job_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process audio: {str(e)}"
        )

@router.get("/audio_files", tags=["Audio Tasks"])
async def get_audio_files():
    """
    /storage以下にある音声ファイル名を取得する
    """
    try:
        audio_extensions = ["*.wav", "*.mp3", "*.m4a", "*.flac", "*.ogg", "*.aac"]
        audio_files = []
        
        for extension in audio_extensions:
            files = glob.glob(f"storage/{extension}")
            # ファイル名のみを取得（パスを除く）
            audio_files.extend([os.path.basename(file) for file in files])
        
        return {"files": sorted(audio_files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audio files: {str(e)}")
    
@router.post("/update-cookie", tags=["Audio Tasks"])
async def update_cookie(text_content: str = Body(..., media_type="text/plain")):
    """
    POSTされた平文を/storage/cookies.txtに完全に上書きして反映するAPI
    """
    try:
        content = text_content.encode('utf-8')
        cookie_file_path = "storage/cookies.txt"
        
        with open(cookie_file_path, "wb") as f:
            f.write(content)
        return {"message": "Cookie file updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update cookie file: {str(e)}")
