from fastapi import APIRouter, HTTPException, Response
import httpx
import os
from dotenv import load_dotenv

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
