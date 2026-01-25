import httpx
import os
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

async def get_batch_transcription_status(round_ids: List[int]) -> Dict[int, Optional[str]]:
    """
    Get batch transcription status from Galleria API.
    
    Args:
        round_ids: List of round IDs to check
        
    Returns:
        Dictionary mapping round_id to status string:
        - "PENDING" -> task is queued
        - "PROCESSING" -> task is running
        - "COMPLETED" -> task is done
        - "ERROR" -> task failed
        - None -> not found (404)
        # TODO: Unify status naming across Galleria API, DebaTube API, and Frontend
        # Current mapping:
        #   Galleria: PENDING/PROCESSING/COMPLETED/ERROR
        #   DebaTube: not_in_queue/in_queue/processing/done
        #   Frontend: pending/processing/completed/error/disabled
    """
    if not TRANSCRIPTION_API_URL:
        return {}
    
    if not round_ids:
        return {}
    
    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background/status/batch"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json={"round_ids": round_ids},
                timeout=10.0
            )
            
            if resp.status_code == 200:
                data = resp.json()
                # Actual format from Galleria API: [{"round_id": 50, "status": "COMPLETED", ...}, ...]
                result = {}
                
                if isinstance(data, list):
                    # Array format: convert to dict
                    for item in data:
                        rid = item.get("round_id")
                        status = item.get("status")
                        if rid is not None:
                            result[rid] = status
                else:
                    # Legacy object format: {round_id: {"status": "PENDING", ...}, ...}
                    for round_id in round_ids:
                        round_id_str = str(round_id)
                        if round_id_str in data and data[round_id_str]:
                            result[round_id] = data[round_id_str].get("status")
                        else:
                            result[round_id] = None
                
                # Fill in None for missing round_ids
                for round_id in round_ids:
                    if round_id not in result:
                        result[round_id] = None
                
                return result
            else:
                # If batch endpoint fails, return empty dict (fallback to DB-based status)
                return {}
                
    except Exception as e:
        print(f"Batch Status Check Error: {str(e)}")
        return {}  # Graceful fallback

async def start_transcription_background(
    round_id: int,
    url: str,
    num_chunks: int = 4,
    max_workers: int = 2,
    is_forced: bool = False
) -> Dict[str, Any]:
    """
    Start background transcription task via Galleria API.
    
    Args:
        round_id: Round ID
        url: YouTube URL
        num_chunks: Number of audio chunks (default: 4)
        max_workers: Number of parallel workers (default: 2)
        is_forced: Force re-transcription even if cached (default: False)
        
    Returns:
        {"task_id": "xxx", "status": "started"}
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
                timeout=10.0  # Quick response expected (just task creation)
            )
            
            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(status_code=resp.status_code, detail=f"Failed to start background transcription: {error_detail}")
            
            return resp.json()
            
    except httpx.RequestError as e:
        print(f"Background Transcription Start Error: {str(e)}")
        raise HTTPException(status_code=503, detail="Transcription Service Unreachable")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Background Transcription Start General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Service Error During Background Transcription Start")


async def get_transcription_result(round_id: int) -> Dict[str, Any]:
    """
    Get completed transcription result from Galleria API.
    
    Args:
        round_id: Round ID
        
    Returns:
        Transcription result in standard Whisper verbose format
        
    Raises:
        HTTPException: If result not found or not yet completed
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/transcribe-background?round_id={round_id}"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(target_url, timeout=10.0)
            
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Transcription result not found or not yet completed")
            
            if resp.status_code != 200:
                error_detail = resp.text
                try:
                    error_detail = resp.json().get("detail", error_detail)
                except:
                    pass
                raise HTTPException(status_code=resp.status_code, detail=f"Failed to get transcription result: {error_detail}")
            
            return resp.json()
            
    except httpx.RequestError as e:
        print(f"Get Transcription Result Error: {str(e)}")
        raise HTTPException(status_code=503, detail="Transcription Service Unreachable")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get Transcription Result General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Service Error During Get Transcription Result")

