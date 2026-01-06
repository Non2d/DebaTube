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
    # Check for existing files
    for ext in ['.m4a', '.webm', '.mp3', '.opus']:
        path = os.path.join(AUDIO_DIR, f"{video_id}{ext}")
        if os.path.exists(path):
            return path
    return ""

@router.post("/download-audio", response_model=AudioDownloadResponse)
async def download_audio(request: AudioDownloadRequest):
    """
    Download audio from YouTube video using yt-dlp.
    Saves to /app/audio/{video_id}.{ext}
    """
    video_id = request.video_id
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    # Check if already exists
    existing_path = get_audio_path(video_id)
    if existing_path:
        # Get metadata logic could be skipped or lightweight fetch if needed
        # For now, just return existing info if possible or re-fetch basic info
        # Let's re-fetch info to be safe or just trust existence
        filename = os.path.basename(existing_path)
        return AudioDownloadResponse(
            video_id=video_id,
            audio_path=existing_path,
            title="Existing Audio", # Placeholder, maybe fetch from DB if integrated later
            duration=0, # Placeholder
            filename=filename
        )

    output_template = os.path.join(AUDIO_DIR, f"{video_id}.%(ext)s")
    
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
        'force_ipv4': True, # Fix for 403
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            # FFmpeg conversion changes extension, so we need to find the final file
            final_path = filename.rsplit('.', 1)[0] + '.m4a'
            
            if not os.path.exists(final_path):
                # Fallback check
                if os.path.exists(filename):
                    final_path = filename
                else:
                    # Search dir for video_id.*
                    found = get_audio_path(video_id)
                    if found:
                        final_path = found
                    else:
                        raise Exception("Downloaded file not found")

            return AudioDownloadResponse(
                video_id=info.get('id', video_id),
                audio_path=final_path,
                title=info.get('title', 'Unknown Title'),
                duration=info.get('duration', 0),
                filename=os.path.basename(final_path)
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download audio: {str(e)}")
