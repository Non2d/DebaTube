from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import yt_dlp
import os
import shutil

router = APIRouter()

APP_DIR = os.path.dirname(__file__)
AUDIO_DIR = "/app/tmp-audio-save"
os.makedirs(AUDIO_DIR, exist_ok=True)

class AudioDownloadRequest(BaseModel):
    video_id: str

class AudioDownloadResponse(BaseModel):
    video_id: str
    audio_path: str
    title: str
    duration: int
    filename: str

def get_audio_path(video_id: str) -> str:
    # Check for existing specific file: AUDIO_DIR/{video_id}/full_audio.m4a
    # We prioritize m4a as per new requirement, but could check others if needed.
    # User specifically asked for: /tmp-audio-save/video_id/full_audio.m4a
    
    target_dir = os.path.join(AUDIO_DIR, video_id)
    target_path = os.path.join(target_dir, "full_audio.m4a")
    
    if os.path.exists(target_path):
        return target_path
        
    # Backward compatibility: check old path style if migration not done?
    # Old: AUDIO_DIR/{video_id}.m4a
    old_path = os.path.join(AUDIO_DIR, f"{video_id}.m4a")
    if os.path.exists(old_path):
        # We could migrate it here or just return it. 
        # Let's return it for now to avoid breaking existing.
        return old_path
        
    return ""


@router.post("/download-audio", response_model=AudioDownloadResponse)
async def download_audio(request: AudioDownloadRequest):
    """
    Download audio from YouTube video using yt-dlp.
    Saves to /app/tmp-audio-save/{video_id}/full_audio.m4a
    """
    video_id = request.video_id
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Check if already exists
    existing_path = get_audio_path(video_id)
    # If it exists and is the new format, return it.
    if existing_path and "full_audio.m4a" in existing_path:
        filename = os.path.basename(existing_path)
        return AudioDownloadResponse(
            video_id=video_id,
            audio_path=existing_path,
            title="Existing Audio", 
            duration=0,
            filename=filename
        )

    # Prepare directory
    target_dir = os.path.join(AUDIO_DIR, video_id)
    os.makedirs(target_dir, exist_ok=True)

    # Output template: .../video_id/full_audio.%(ext)s
    output_template = os.path.join(target_dir, "full_audio.%(ext)s")
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'force_ipv4': True, 
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # filename returned by prepare_filename might depend on extension before conversion
            # But we know we targeting full_audio.m4a
            final_path = os.path.join(target_dir, "full_audio.m4a")
            
            if not os.path.exists(final_path):
                 raise Exception("Downloaded file not found at expected path: " + final_path)

            return AudioDownloadResponse(
                video_id=info.get('id', video_id),
                audio_path=final_path,
                title=info.get('title', 'Unknown Title'),
                duration=info.get('duration', 0),
                filename="full_audio.m4a"
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download audio: {str(e)}")


from fastapi.responses import FileResponse

@router.get("/audio/{video_id}")
async def get_audio_file(video_id: str):
    """
    Serve the downloaded audio file for the given video_id.
    """
    path = get_audio_path(video_id)
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found")
        
    return FileResponse(path, media_type="audio/mp4", filename=os.path.basename(path))
