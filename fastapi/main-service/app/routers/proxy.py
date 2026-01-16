from fastapi import APIRouter, HTTPException, Response
import httpx
import os
import json
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

router = APIRouter()

TRANSCRIPTION_API_URL = os.getenv("TRANSCRIPTION_API_URL")

@router.get("/external-gpu-health")
async def check_gpu_health():
    """
    Proxy endpoint to check the health of the external GPU transcription server.
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/health"
    
    try:
        async with httpx.AsyncClient() as client:
            # Short timeout since it's just a health check
            resp = await client.get(target_url, timeout=5.0)
            
            # Forward the content and status
            return Response(
                content=resp.content, 
                status_code=resp.status_code, 
                media_type=resp.headers.get("content-type")
            )
    except httpx.RequestError as e:
        # Network error (timeout, connection failed)
        # Log the error internally
        print(f"Proxy Request Error: {str(e)}")
        # Return generic error to client to hide URL
        raise HTTPException(status_code=503, detail="GPU Server Unreachable")
    except Exception as e:
        print(f"Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error")

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
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/download-and-split-audio"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                target_url,
                json=request.model_dump(),
                timeout=None  # Download may take time
            )
            
            # Forward the response
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type")
            )
            
    except httpx.RequestError as e:
        print(f"Download Proxy Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="GPU Server Download Failed (Unreachable)")
    except Exception as e:
        print(f"Download Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Download")

@router.post("/external-gpu-transcribe")
async def proxy_transcribe(
    request: TranscribeRequest
):
    """
    Proxy endpoint to transcribe audio via external GPU server using video_id.
    Converts the response from segments-based format to standard Whisper verbose format.
    """
    if not TRANSCRIPTION_API_URL:
        raise HTTPException(status_code=500, detail="TRANSCRIPTION_API_URL not configured")
    
    target_url = f"{TRANSCRIPTION_API_URL}/transcribe"
    
    try:
        async with httpx.AsyncClient() as client:
            # Forward the JSON body directly
            # No timeout as requested by user
            resp = await client.post(
                target_url, 
                json=request.model_dump(), 
                timeout=None
            )
            
            if resp.status_code != 200:
                # Forward error response
                return Response(
                    content=resp.content, 
                    status_code=resp.status_code, 
                    media_type=resp.headers.get("content-type")
                )
            
            # Parse external GPU response
            external_result = resp.json()
            
            # Convert from segments-based format to standard Whisper verbose format
            # External format: { "video_id": str, "duration": float, "text": str, "segments": [...], "language": str, ... }
            # Target format: { "task": str, "language": str, "duration": float, "text": str, "words": [...] }
            # Note: Extra fields in external_result are ignored
            
            all_words = []
            duration = external_result.get("duration", 0.0)
            
            # Extract words from all segments
            if "segments" in external_result:
                for segment in external_result["segments"]:
                    if "words" in segment:
                        for word_obj in segment["words"]:
                            all_words.append({
                                "word": word_obj.get("word", ""),
                                "start": word_obj.get("start", 0.0),
                                "end": word_obj.get("end", 0.0)
                            })
            
            # Build standard Whisper verbose response
            standard_response = {
                "task": "transcribe",
                "language": external_result.get("language", "en"),
                "duration": duration,
                "text": external_result.get("text", ""),
                "words": all_words
            }
            
            # Return as JSON
            return Response(
                content=json.dumps(standard_response),
                status_code=200,
                media_type="application/json"
            )
            
    except httpx.RequestError as e:
        # Log error locally
        print(f"Transcription Proxy Request Error: {str(e)}")
        raise HTTPException(status_code=503, detail="GPU Server Transcription Failed (Unreachable)")
    except Exception as e:
        print(f"Transcription Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Proxy Error During Transcription")

