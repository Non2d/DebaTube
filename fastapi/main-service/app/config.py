"""
Application configuration constants
"""

import os

# Audio file storage directory
AUDIO_DIR = "/app/tmp-audio-save"

# Ensure directory exists
os.makedirs(AUDIO_DIR, exist_ok=True)
