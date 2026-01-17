from fastapi import APIRouter, HTTPException, Response
import json
from pydantic import BaseModel
from services.transcription_service import (
    check_service_health,
    download_audio_remote,
    transcribe_audio_remote,
    get_cached_video_ids_remote,
    delete_audio_cache_remote
)

router = APIRouter()

@router.get("/transcription-service/health")
async def check_service_health_proxy():
    """
    Proxy endpoint to check the health of the external transcription service.
    """
    resp = await check_service_health()
    # Forward the content and status
    return Response(
        content=resp.content, 
        status_code=resp.status_code, 
        media_type=resp.headers.get("content-type")
    )

class DownloadAudioRequest(BaseModel):
    url: str
    num_chunks: int = 4

class TranscribeRequest(BaseModel):
    video_id: str
    max_workers: int = 2

@router.post("/transcription-service/download-audio")
async def proxy_download_audio(
    request: DownloadAudioRequest
):
    """
    Proxy endpoint to download and split audio from YouTube URL via external service.
    Returns video_id for subsequent transcription.
    """
    result = await download_audio_remote(request.url, request.num_chunks)
    return result

@router.post("/transcription-service/transcribe")
async def proxy_transcribe(
    request: TranscribeRequest
):
    """
    Proxy endpoint to transcribe audio via external service using video_id.
    Converts the response from segments-based format to standard Whisper verbose format.
    """
    result = await transcribe_audio_remote(request.video_id, request.max_workers)
    
    # Return as JSON (FastAPI handles serialization)
    return result

@router.get("/transcription-service/cached_video_ids")
async def get_cached_video_ids():
    """
    Proxy endpoint to get the list of currently cached (downloaded) video IDs from external service.
    """
    result = await get_cached_video_ids_remote()
    return result

@router.delete("/transcription-service/delete-cache/{video_id}")
async def proxy_delete_audio_cache(video_id: str):
    """
    Proxy endpoint to delete audio cache from external service.
    """
    try:
        await delete_audio_cache_remote(video_id)
        return {"status": "success", "message": f"Deleted cache for {video_id}"}
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Cache Deletion")

# Backward compatibility / Internal use function (deprecated, use service directly)
async def delete_audio_cache_internal(video_id: str):
    await delete_audio_cache_remote(video_id)


