from fastapi import APIRouter, HTTPException, Response
import json
from pydantic import BaseModel
from services.external_gpu import (
    check_gpu_health_service,
    download_audio_from_gpu,
    transcribe_audio_on_gpu,
    get_cached_video_ids_from_gpu,
    delete_audio_cache_on_gpu
)

router = APIRouter()

@router.get("/external-gpu-health")
async def check_gpu_health():
    """
    Proxy endpoint to check the health of the external GPU transcription server.
    """
    resp = await check_gpu_health_service()
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

@router.post("/external-gpu-download-audio")
async def proxy_download_audio(
    request: DownloadAudioRequest
):
    """
    Proxy endpoint to download and split audio from YouTube URL via external GPU server.
    Returns video_id for subsequent transcription.
    """
    result = await download_audio_from_gpu(request.url, request.num_chunks)
    return result

@router.post("/external-gpu-transcribe")
async def proxy_transcribe(
    request: TranscribeRequest
):
    """
    Proxy endpoint to transcribe audio via external GPU server using video_id.
    Converts the response from segments-based format to standard Whisper verbose format.
    """
    result = await transcribe_audio_on_gpu(request.video_id, request.max_workers)
    
    # Return as JSON (FastAPI handles serialization)
    return result

@router.get("/cached_video_ids")
async def get_cached_video_ids():
    """
    Proxy endpoint to get the list of currently cached (downloaded) video IDs from external GPU server.
    """
    result = await get_cached_video_ids_from_gpu()
    return result

@router.delete("/external-gpu-delete-cache/{video_id}")
async def proxy_delete_audio_cache(video_id: str):
    """
    Proxy endpoint to delete audio cache from external GPU server.
    """
    try:
        await delete_audio_cache_on_gpu(video_id)
        return {"status": "success", "message": f"Deleted cache for {video_id}"}
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Cache Deletion")

# Backward compatibility / Internal use function (deprecated, use service directly)
async def delete_audio_cache_internal(video_id: str):
    await delete_audio_cache_on_gpu(video_id)


