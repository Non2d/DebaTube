from fastapi import APIRouter, HTTPException, Response
import json
from pydantic import BaseModel
from services.transcription_service import (
    check_service_health,
    download_audio_remote,
    transcribe_audio_remote,
    get_cached_video_ids_remote,
    delete_audio_cache_remote,
    cancel_transcription_batch_remote,
    get_thread_status_remote
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

class CancelTranscriptionRequest(BaseModel):
    video_ids: list[str]

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

@router.post("/transcribe-background/cancel/batch")
async def proxy_cancel_transcription_batch(
    request: CancelTranscriptionRequest
):
    """
    Proxy endpoint to cancel background transcription jobs via external service.
    """
    result = await cancel_transcription_batch_remote(request.video_ids)
    return result

def _deduplicate_tasks(tasks: list) -> list:
    """
    Deduplicate tasks based on video_id.
    If both TranscribeMain and TranscribeChunk exist for the same video_id, only keep TranscribeChunk.
    If only TranscribeMain exists (no TranscribeChunk), keep TranscribeMain.
    """
    if not tasks:
        return []

    # Group tasks by video_id
    video_id_tasks = {}
    for task in tasks:
        # Task format: "TranscribeMain(video_id=...)" or "TranscribeChunk(video_id=...)"
        video_id = None

        # Extract video_id from task string
        if "video_id=" in task:
            try:
                start = task.index("video_id=") + len("video_id=")
                end = task.index(")", start)
                video_id = task[start:end].strip("'\"")
            except (ValueError, IndexError):
                # If parsing fails, keep the task as-is
                video_id = None

        if video_id:
            if video_id not in video_id_tasks:
                video_id_tasks[video_id] = []
            video_id_tasks[video_id].append(task)
        else:
            # Tasks without video_id, keep as-is
            if None not in video_id_tasks:
                video_id_tasks[None] = []
            video_id_tasks[None].append(task)

    # Deduplicate: if both TranscribeMain and TranscribeChunk exist, remove TranscribeMain
    result = []
    for video_id, task_list in video_id_tasks.items():
        if video_id is None:
            result.extend(task_list)
        else:
            has_main = any("TranscribeMain" in t for t in task_list)
            has_chunk = any("TranscribeChunk" in t for t in task_list)

            if has_main and has_chunk:
                # Both exist: only add TranscribeChunk tasks
                result.extend([t for t in task_list if "TranscribeChunk" in t])
            else:
                # Only main or only chunk: add all
                result.extend(task_list)

    return result

@router.get("/thread/status")
async def get_thread_status():
    """
    Proxy endpoint to get the status of active and zombie tasks from the external transcription service.
    Returns original task lists plus deduplicated total counts.
    """
    result = await get_thread_status_remote()

    # Get task lists from result
    active_tasks = result.get("active_tasks", [])
    zombie_tasks = result.get("zombie_tasks", [])

    # Deduplicate tasks
    deduplicated_active = _deduplicate_tasks(active_tasks)
    deduplicated_zombie = _deduplicate_tasks(zombie_tasks)

    # Add total counts
    result["total_active_tasks"] = len(deduplicated_active)
    result["total_zombie_tasks"] = len(deduplicated_zombie)

    return result

