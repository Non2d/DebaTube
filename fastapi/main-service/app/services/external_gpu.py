import httpx
import os
from fastapi import HTTPException
from typing import Dict, List, Any, Optional
from config import TRANSCRIPTION_API_URL

async def check_gpu_health_service():
    """
    Check the health of the external GPU transcription server.
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
        print(f"Proxy Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="GPU Server Unreachable")
    except Exception as e:
        print(f"Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error")

async def download_audio_from_gpu(url: str, num_chunks: int = 4) -> Dict[str, Any]:
    """
    Download and split audio from YouTube URL via external GPU server.
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
                raise HTTPException(status_code=resp.status_code, detail=f"GPU Server Download Failed: {error_detail}")
            
            return resp.json()
            
    except httpx.RequestError as e:
        print(f"Download Proxy Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="GPU Server Download Failed (Unreachable)")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Download Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Download")

async def transcribe_audio_on_gpu(video_id: str, max_workers: int = 2) -> Dict[str, Any]:
    """
    Transcribe audio via external GPU server using video_id.
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
                raise HTTPException(status_code=resp.status_code, detail=f"GPU Transcription Failed: {error_detail}")
            
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
        print(f"Transcription Proxy Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="GPU Server Transcription Failed (Unreachable)")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcription Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Transcription")

async def get_cached_video_ids_from_gpu() -> Dict[str, Any]:
    """
    Get the list of currently cached video IDs from external GPU server.
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
        print(f"Cache Proxy Request Error: {str(e)}")
        # Return empty list or raise error? Original code raised error but CRR handles check failure gracefully.
        # But this function is "get from GPU", so raising error is appropriate. Caller handles loop/fallback.
        raise HTTPException(status_code=503, detail="GPU Server Unreachable")
    except Exception as e:
        print(f"Cache Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Cache Check")

async def delete_audio_cache_on_gpu(video_id: str) -> None:
    """
    Delete audio cache from external GPU server.
    """
    if not TRANSCRIPTION_API_URL:
        raise ValueError("TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/audio/{video_id}"
    
    async with httpx.AsyncClient() as client:
        resp = await client.delete(target_url, timeout=5.0)
        
        if resp.status_code not in [200, 404]:
             raise HTTPException(status_code=resp.status_code, detail=f"Failed to delete external cache: {resp.text}")
