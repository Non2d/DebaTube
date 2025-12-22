from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
import json
from datetime import datetime
from log_config import logger

router = APIRouter()

# Define LOGS directory (same as in other routers, ideally should be shared config)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGS_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

class LogEventRequest(BaseModel):
    event_type: str
    timestamp: str 
    data: Optional[Dict[str, Any]] = None

@router.post("/event")
async def log_event(request: LogEventRequest):
    """
    Receive client-side events and log them to a daily log file.
    """
    try:
        # Generate daily log filename: user_events_YYYY-MM-DD.jsonl
        today = datetime.now().strftime("%Y-%m-%d")
        log_file = os.path.join(LOGS_DIR, f"user_events_{today}.jsonl")
        
        log_entry = request.model_dump()
        
        # Append to JSONL file
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
            
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Error saving user event log: {str(e)}")
        # Don't fail the request significantly if logging fails, but return 500 to warn client
        raise HTTPException(status_code=500, detail=f"Failed to save log: {str(e)}")
