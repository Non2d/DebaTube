import httpx
import os
import json
from fastapi import HTTPException
from typing import Dict, List, Any, Optional
from config import TRANSCRIPTION_API_URL

async def check_service_health():
    """
    Check the health of the external transcription service.
    Returns the raw response object or raises HTTPException.
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/health"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(target_url, timeout=5.0)
            return resp
    except httpx.RequestError as e:
        print(f"Service Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="Transcription Service Unreachable")
    except Exception as e:
        print(f"Service General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Service Error")

async def download_audio_remote(url: str, num_chunks: int = 4) -> Dict[str, Any]:
    """
    Download and split audio from YouTube URL via external service.
    Returns JSON dictionary with video_id.
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/download-and-split-audio"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={"url": url, "num_chunks": num_chunks},
                timeout=None  # Download may take time
            )
            
            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(status_code=resp.status_code, detail=f"Service Download Failed: {error_detail}")
            
            return resp.json()
            
    except httpx.RequestError as e:
        print(f"Download Service Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="Transcription Service Download Failed (Unreachable)")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Download Service General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Service Error During Download")

async def transcribe_audio_remote(video_id: str, max_workers: int = 2) -> Dict[str, Any]:
    """
    Transcribe audio via external service using video_id.
    Returns standard Whisper verbose format dictionary.
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/transcribe"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url, 
                json={"video_id": video_id, "max_workers": max_workers}, 
                timeout=None
            )
            
            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(status_code=resp.status_code, detail=f"Service Transcription Failed: {error_detail}")
            
            external_result = resp.json()
            
            # Post-processing (logic moved from proxy.py)
            all_words = []
            duration = external_result.get("duration", 0.0)
            
            if "segments" in external_result:
                for segment in external_result["segments"]:
                    if "words" in segment:
                        for word_obj in segment["words"]:
                            all_words.append({
                                "word": word_obj.get("word", ""),
                                "start": word_obj.get("start", 0.0),
                                "end": word_obj.get("end", 0.0)
                            })
            
            standard_response = {
                "task": "transcribe",
                "language": external_result.get("language", "en"),
                "duration": duration,
                "text": external_result.get("text", ""),
                "words": all_words
            }
            
            return standard_response
            
    except httpx.RequestError as e:
        print(f"Transcription Service Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="Transcription Service Transcription Failed (Unreachable)")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription Service General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Service Error During Transcription")

async def get_cached_video_ids_remote() -> Dict[str, Any]:
    """
    Get the list of currently cached video IDs from external service.
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/cache"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(target_url, timeout=5.0)
            
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Failed to get cache info: {resp.text}")
            
            return resp.json()
            
    except httpx.RequestError as e:
        print(f"Cache Service Request Error: {str(e)}")
        # Return empty list or raise error? Original code raised error but CRR handles check failure gracefully.
        # But this function is "get from GPU", so raising error is appropriate. Caller handles loop/fallback.
        raise HTTPException(status_code=503, detail="Transcription Service Unreachable")
    except Exception as e:
        print(f"Cache Service General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Service Error During Cache Check")

async def delete_audio_cache_remote(video_id: str) -> None:
    """
    Delete audio cache from external service.
    """
    if not TRANSCRIPTION_API_URL:
        raise ValueError("TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/audio/{video_id}"

    async with httpx.AsyncClient() as client:
        resp = await client.delete(target_url, timeout=5.0)

        if resp.status_code not in [200, 404]:
             raise HTTPException(status_code=resp.status_code, detail=f"Failed to delete external cache: {resp.text}")

async def delete_background_transcription_batch_remote(
    video_ids: Optional[List[str]] = None,
    round_ids: Optional[List[int]] = None
) -> Dict[str, Any]:
    """
    Delete background transcription data in batch from external service.

    Args:
        video_ids: List of video IDs to delete
        round_ids: List of round IDs to delete

    Returns:
        Dictionary with deleted_count and message
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background/batch"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                "DELETE",
                target_url,
                json={
                    "video_ids": video_ids or [],
                    "round_ids": round_ids or []
                },
                timeout=10.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Batch deletion failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Batch Deletion Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (batch deletion)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Batch Deletion General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Batch Deletion"
        )

async def transcribe_background_remote(
    round_id: int,
    url: str,
    num_chunks: int = 4,
    max_workers: int = 2,
    is_forced: bool = False
) -> Dict[str, Any]:
    """
    Start background transcription via external service.
    Returns initial status information.

    Args:
        round_id: Round ID for tracking
        url: YouTube URL
        num_chunks: Number of chunks to split audio into
        max_workers: Maximum number of parallel workers
        is_forced: Force re-processing even if already completed

    Returns:
        Dictionary with video_id, round_id, and status
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={
                    "round_id": round_id,
                    "url": url,
                    "num_chunks": num_chunks,
                    "max_workers": max_workers,
                    "is_forced": is_forced
                },
                timeout=30.0  # Background job start should be quick
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Background transcription start failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Background Transcription Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (background)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Background Transcription General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Background Transcription Start"
        )

async def get_transcription_status_remote(round_id: int) -> Dict[str, Any]:
    """
    Get the status of a background transcription job.

    Args:
        round_id: Round ID to check status for

    Returns:
        Dictionary with video_id, round_id, and status (PENDING/PROCESSING/COMPLETED/ERROR)
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background/status"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                target_url,
                params={"round_id": round_id},
                timeout=5.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Status check failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Status Check Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (status check)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Status Check General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Status Check"
        )

async def get_transcription_status_remote_batch(round_ids: List[int]) -> List[Dict[str, Any]]:
    """
    Get the status of multiple background transcription jobs in batch.

    Args:
        round_ids: List of round IDs to check status for

    Returns:
        List of dictionaries with video_id, round_id, and status (PENDING/PROCESSING/COMPLETED/ERROR)
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background/status/batch"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={"round_ids": round_ids},
                timeout=10.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Batch status check failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Batch Status Check Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (batch status check)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Batch Status Check General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Batch Status Check"
        )

async def get_transcription_result_remote(round_id: int) -> Dict[str, Any]:
    """
    Get the result of a completed background transcription job.
    Converts from LocalWhisper format to standard Whisper verbose format.

    Args:
        round_id: Round ID to get results for

    Returns:
        Dictionary in standard Whisper verbose format with task, language, duration, text, and words
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                target_url,
                params={"round_id": round_id},
                timeout=30.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Result retrieval failed: {error_detail}"
                )

            external_result = resp.json()

            # Validate status
            status = external_result.get("status", "PENDING")
            if status != "COMPLETED":
                raise HTTPException(
                    status_code=400,
                    detail=f"Transcription not completed yet. Current status: {status}"
                )

            # Convert from LocalWhisper format to standard Whisper verbose format
            # LocalWhisper has: text, language, duration, duration_after_vad, segments (with words)
            # Standard format needs: task, language, duration, text, words (flat list)

            all_words = []
            if "segments" in external_result and external_result["segments"]:
                for segment in external_result["segments"]:
                    if "words" in segment and segment["words"]:
                        for word_obj in segment["words"]:
                            all_words.append({
                                "word": word_obj.get("word", ""),
                                "start": word_obj.get("start", 0.0),
                                "end": word_obj.get("end", 0.0)
                            })

            standard_response = {
                "task": "transcribe",
                "language": external_result.get("language", "en"),
                "duration": external_result.get("duration", 0.0),
                "text": external_result.get("text", ""),
                "words": all_words
            }

            return standard_response

    except httpx.RequestError as e:
        print(f"Result Retrieval Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (result retrieval)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Result Retrieval General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Result Retrieval"
        )

async def download_audio_background_batch_remote(
    items: List[Dict[str, str]],
    num_chunks: int = 4,
    max_workers: int = 2,
    is_forced: bool = False
) -> str:
    """
    Start background audio download via external service in batch.
    Returns message from external API.

    Args:
        items: List of items with url (e.g., [{"url": "..."}, ...])
        num_chunks: Number of chunks to split audio into
        max_workers: Maximum number of parallel workers
        is_forced: Force re-processing even if already completed

    Returns:
        String message from external API
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/download-and-split-audio-background/batch"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={
                    "items": items,
                    "num_chunks": num_chunks,
                    "max_workers": max_workers,
                    "is_forced": is_forced
                },
                timeout=30.0  # Background job start should be quick
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Background audio download start failed: {error_detail}"
                )

            # Return the response text as a string message
            return resp.text

    except httpx.RequestError as e:
        print(f"Background Audio Download Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (background audio download)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Background Audio Download General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Background Audio Download Start"
        )

async def get_download_audio_status_remote_batch(
    video_ids: Optional[List[str]] = None,
    round_ids: Optional[List[int]] = None
) -> List[Dict[str, Any]]:
    """
    Get the status of multiple background audio download jobs in batch.

    Args:
        video_ids: List of video IDs to check status for
        round_ids: List of round IDs to check status for (optional)

    Returns:
        List of dictionaries with video_id and dl_audio_status
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/download-and-split-audio-background/status/batch"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={
                    "video_ids": video_ids or [],
                    "round_ids": round_ids or []
                },
                timeout=10.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Batch status check failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Batch Audio Download Status Check Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (batch audio download status check)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Batch Audio Download Status Check General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Batch Audio Download Status Check"
        )

async def cancel_transcription_batch_remote(video_ids: List[str]) -> Dict[str, Any]:
    """
    Cancel background transcription jobs in batch via external service.

    Args:
        video_ids: List of video IDs to cancel

    Returns:
        Dictionary with cancellation results
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background/cancel/batch"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={"video_ids": video_ids},
                timeout=10.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Batch cancellation failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Batch Cancellation Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (batch cancellation)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Batch Cancellation General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Batch Cancellation"
        )

async def get_thread_status_remote() -> Dict[str, Any]:
    """
    Get the status of active and zombie tasks from the external transcription service.

    Returns:
        Dictionary with active_tasks and zombie_tasks lists
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")

    target_url = f"{TRANSCRIPTION_API_URL}/threads/status"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                target_url,
                timeout=10.0
            )

            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Thread status request failed: {error_detail}"
                )

            return resp.json()

    except httpx.RequestError as e:
        print(f"Thread Status Request Error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Transcription Service Unreachable (thread status)"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Thread Status General Error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal Service Error During Thread Status Request"
        )
