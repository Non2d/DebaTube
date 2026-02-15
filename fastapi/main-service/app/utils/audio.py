"""
Audio file utilities
"""

import os
from config import AUDIO_DIR


def get_audio_path(video_id: str) -> str:
    """
    Get the path to the audio file for a given video_id.
    
    Args:
        video_id: YouTube video ID
    
    Returns:
        Full path to audio file if exists, empty string otherwise
    """
    target_dir = os.path.join(AUDIO_DIR, video_id)
    target_path = os.path.join(target_dir, "full_audio.m4a")
    
    if os.path.exists(target_path):
        return target_path
        
    return ""
