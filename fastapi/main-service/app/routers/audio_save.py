from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import os
import json
from log_config import logger
from datetime import datetime

router = APIRouter()

# Audio save directory
AUDIO_SAVE_DIR = Path("/app/audio-save")
AUDIO_SAVE_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/audio/save")
async def save_audio(
    match_name: str = Form(...),
    speech_index: int = Form(...),
    speech_name: str = Form(...),
    file: UploadFile = File(...),
    duration: float = Form(0)
):
    """
    Save audio recording to the server (supports multiple recordings per speech)

    Args:
        match_name: Name of the debate match (e.g., "2025-01-17-session_143052")
        speech_index: Index of the speech (0-7)
        speech_name: Name of the speech (e.g., "proposition_1st")
        file: Audio file (webm format)
        duration: Duration of the recording in seconds

    Returns:
        Success message with file path and sequence number
    """
    try:
        # Create match directory if it doesn't exist
        match_dir = AUDIO_SAVE_DIR / match_name
        match_dir.mkdir(parents=True, exist_ok=True)

        # Find existing files for this speech to determine sequence number
        existing_files = list(match_dir.glob(f"{speech_index}_{speech_name}_*.webm"))
        sequence_number = len(existing_files)

        # Create filename: {speech_index}_{speech_name}_{sequence}.webm
        filename = f"{speech_index}_{speech_name}_{sequence_number}.webm"
        file_path = match_dir / filename

        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Save metadata (duration) as JSON
        metadata = {
            "duration": duration,
            "timestamp": datetime.now().isoformat(),
            "speech_index": speech_index,
            "speech_name": speech_name,
            "sequence_number": sequence_number
        }
        metadata_path = file_path.with_suffix('.json')
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Audio file saved: {file_path} (sequence: {sequence_number}, duration: {duration}s)")

        return {
            "success": True,
            "message": "Audio file saved successfully",
            "file_path": str(file_path),
            "match_name": match_name,
            "speech_index": speech_index,
            "speech_name": speech_name,
            "sequence_number": sequence_number,
            "duration": duration
        }

    except Exception as e:
        logger.error(f"Failed to save audio file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save audio file: {str(e)}")


@router.get("/audio/matches")
async def list_matches():
    """
    List all saved debate matches

    Returns:
        List of match names
    """
    try:
        matches = [d.name for d in AUDIO_SAVE_DIR.iterdir() if d.is_dir()]
        return {
            "success": True,
            "matches": sorted(matches, reverse=True)  # Most recent first
        }
    except Exception as e:
        logger.error(f"Failed to list matches: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list matches: {str(e)}")


@router.get("/audio/match/{match_name}")
async def get_match_files(match_name: str):
    """
    Get all audio files for a specific match

    Args:
        match_name: Name of the debate match

    Returns:
        List of audio files with metadata (including duration)
    """
    try:
        match_dir = AUDIO_SAVE_DIR / match_name

        if not match_dir.exists():
            raise HTTPException(status_code=404, detail=f"Match not found: {match_name}")

        files = []
        for file_path in sorted(match_dir.glob("*.webm")):
            file_info = {
                "filename": file_path.name,
                "size": file_path.stat().st_size,
                "modified": file_path.stat().st_mtime,
                "duration": 0  # Default duration
            }

            # Try to load metadata from JSON file
            metadata_path = file_path.with_suffix('.json')
            if metadata_path.exists():
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                        file_info["duration"] = metadata.get("duration", 0)
                except Exception as e:
                    logger.warning(f"Failed to load metadata for {file_path.name}: {e}")

            files.append(file_info)

        return {
            "success": True,
            "match_name": match_name,
            "files": files
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get match files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get match files: {str(e)}")


@router.get("/audio/match/{match_name}/speech/{speech_index}")
async def get_speech_files(match_name: str, speech_index: int):
    """
    Get all audio files for a specific speech in a match (ordered by sequence)

    Args:
        match_name: Name of the debate match
        speech_index: Index of the speech (0-7)

    Returns:
        List of audio files for the specific speech with metadata (including duration)
    """
    try:
        match_dir = AUDIO_SAVE_DIR / match_name

        if not match_dir.exists():
            raise HTTPException(status_code=404, detail=f"Match not found: {match_name}")

        # Find all files for this speech_index
        files = []
        for file_path in sorted(match_dir.glob(f"{speech_index}_*_*.webm")):
            # Extract sequence number from filename (format: {speech_index}_{speech_name}_{sequence}.webm)
            parts = file_path.stem.split('_')
            if len(parts) >= 3:
                try:
                    sequence = int(parts[-1])
                    file_info = {
                        "filename": file_path.name,
                        "size": file_path.stat().st_size,
                        "modified": file_path.stat().st_mtime,
                        "sequence": sequence,
                        "file_path": str(file_path),
                        "duration": 0  # Default duration
                    }

                    # Try to load metadata from JSON file
                    metadata_path = file_path.with_suffix('.json')
                    if metadata_path.exists():
                        try:
                            with open(metadata_path, 'r') as f:
                                metadata = json.load(f)
                                file_info["duration"] = metadata.get("duration", 0)
                        except Exception as e:
                            logger.warning(f"Failed to load metadata for {file_path.name}: {e}")

                    files.append(file_info)
                except ValueError:
                    logger.warning(f"Skipping file with invalid sequence number: {file_path.name}")

        # Sort by sequence number
        files.sort(key=lambda x: x["sequence"])

        return {
            "success": True,
            "match_name": match_name,
            "speech_index": speech_index,
            "files": files,
            "count": len(files)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get speech files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get speech files: {str(e)}")


@router.get("/audio/file/{match_name}/{filename}")
async def get_audio_file(match_name: str, filename: str):
    """
    Serve an audio file

    Args:
        match_name: Name of the debate match
        filename: Name of the audio file

    Returns:
        Audio file
    """
    try:
        file_path = AUDIO_SAVE_DIR / match_name / filename

        if not file_path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")

        if not file_path.is_file():
            raise HTTPException(status_code=400, detail=f"Not a file: {filename}")

        # Security check: ensure the file is within the audio save directory
        if not str(file_path.resolve()).startswith(str(AUDIO_SAVE_DIR.resolve())):
            raise HTTPException(status_code=403, detail="Access denied")

        return FileResponse(
            path=str(file_path),
            media_type="audio/webm",
            filename=filename
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to serve audio file: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to serve audio file: {str(e)}")
