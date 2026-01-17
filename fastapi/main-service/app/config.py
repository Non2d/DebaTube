"""
Application configuration constants
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Audio file storage directory
AUDIO_DIR = "/app/tmp-audio-save"

# Ensure directory exists
os.makedirs(AUDIO_DIR, exist_ok=True)

# External Services
TRANSCRIPTION_API_URL = os.getenv("TRANSCRIPTION_API_URL")
