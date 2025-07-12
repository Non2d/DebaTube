import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from pydantic import BaseModel, HttpUrl, Field
from typing import Union, List
import glob
import uuid

from models.audio import extract_audio_from_youtube, extract_audio_from_playlist, save_uploaded_audio
from models.job_manager import job_manager, JobType

router = APIRouter()

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

class UrlRequest(BaseModel):
    url: HttpUrl = Field(..., example="https://www.youtube.com/watch?v=1TSkkxu8on0")
    is_playlist: bool = False
    round_id: int = Field(..., example=1)
    start_bg_tasks: bool = Field(default=False, description="音声抽出後にspeech_recognitionとspeaker_diarizationのバックグラウンドタスクを自動開始するか")

class AudioResponse(BaseModel):
    success: bool
    file_path: Union[str, List[str]]
    message: str
    speech_recognition_job_id: Union[str, List[str], None] = None
    speaker_diarization_job_id: Union[str, List[str], None] = None

@router.post("/upload-audio", response_model=AudioResponse, tags=["Audio Tasks"])
async def upload_audio(
    file: UploadFile = File(...),
    round_id: int = Form(...),
    start_bg_tasks: bool = Form(default=False)
):
    """
    音声ファイルをアップロードして/storage以下に保存する
    
    Args:
        file: アップロードされる音声ファイル
        round_id: ラウンドID
        start_bg_tasks: バックグラウンドタスクを自動開始するか
    
    Returns:
        AudioResponse: 保存されたファイルパスと結果
    """
    try:
        # ファイル内容を読み取り
        file_content = await file.read()
        
        # ファイルを保存
        file_path = save_uploaded_audio(file_content, file.filename)
        
        speech_job_id = None
        speaker_job_id = None
        
        if start_bg_tasks:
            # Speech recognition job
            speech_job_id = job_manager.create_job(
                JobType.SPEECH_RECOGNITION, 
                file_path, 
                round_id
            )
            job_manager.start_job(speech_job_id)
            
            # Speaker diarization job
            speaker_job_id = job_manager.create_job(
                JobType.SPEAKER_DIARIZATION, 
                file_path, 
                round_id
            )
            job_manager.start_job(speaker_job_id)
        
        return AudioResponse(
            success=True,
            file_path=file_path,
            message="Successfully uploaded and saved audio file",
            speech_recognition_job_id=speech_job_id,
            speaker_diarization_job_id=speaker_job_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload audio: {str(e)}"
        )

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

@router.post("/extract-audio", response_model=AudioResponse, tags=["Audio Tasks"])
async def register_url(request: UrlRequest):
    """
    YouTubeのURLから音声ファイルを抽出して/storage以下に保存する
    
    Args:
        request: URLとプレイリストフラグを含むリクエスト
    
    Returns:
        AudioResponse: 保存されたファイルパスと結果
    """
    try:
        url_str = str(request.url)
        
        if request.is_playlist:
            file_paths = extract_audio_from_playlist(url_str)
            
            speech_job_ids = []
            speaker_job_ids = []
            
            if request.start_bg_tasks:
                for file_path in file_paths:
                    # Speech recognition job
                    speech_job_id = job_manager.create_job(
                        JobType.SPEECH_RECOGNITION, 
                        file_path, 
                        request.round_id
                    )
                    job_manager.start_job(speech_job_id)
                    speech_job_ids.append(speech_job_id)
                    
                    # Speaker diarization job
                    speaker_job_id = job_manager.create_job(
                        JobType.SPEAKER_DIARIZATION, 
                        file_path, 
                        request.round_id
                    )
                    job_manager.start_job(speaker_job_id)
                    speaker_job_ids.append(speaker_job_id)
                
                # Sentence generation will be triggered automatically after speech+diarization complete
            
            return AudioResponse(
                success=True,
                file_path=file_paths,
                message=f"Successfully extracted {len(file_paths)} audio files from playlist",
                speech_recognition_job_id=speech_job_ids if speech_job_ids else None,
                speaker_diarization_job_id=speaker_job_ids if speaker_job_ids else None
            )
        else:
            file_path = extract_audio_from_youtube(url_str)
            
            speech_job_id = None
            speaker_job_id = None
            
            if request.start_bg_tasks:
                # Speech recognition job
                speech_job_id = job_manager.create_job(
                    JobType.SPEECH_RECOGNITION, 
                    file_path, 
                    request.round_id
                )
                job_manager.start_job(speech_job_id)
                
                # Speaker diarization job
                speaker_job_id = job_manager.create_job(
                    JobType.SPEAKER_DIARIZATION, 
                    file_path, 
                    request.round_id
                )
                job_manager.start_job(speaker_job_id)
                
                # Sentence generation will be triggered automatically after speech+diarization complete
            
            return AudioResponse(
                success=True,
                file_path=file_path,
                message="Successfully extracted audio file",
                speech_recognition_job_id=speech_job_id,
                speaker_diarization_job_id=speaker_job_id
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract audio: {str(e)}"
        )