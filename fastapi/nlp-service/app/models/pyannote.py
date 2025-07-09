import torch
from pyannote.audio import Pipeline as pyannote_pipeline
from dotenv import load_dotenv
import os
from sqlalchemy import Column, Integer, String, DateTime, Float
from database import Base
from datetime import datetime

load_dotenv(dotenv_path=".env")
PYANNOTE_AUTH_TOKEN = os.getenv("PYANNOTE_AUTH_TOKEN")

_pipeline = None

def get_pipe():
    """Pyannoteの話者分離パイプラインを取得（必要に応じて再ロード）"""
    global _pipeline
    
    # パイプラインが存在しない、または何らかの理由で無効な場合は再ロード
    if _pipeline is None:
        print("Loading Pyannote pipeline...")
        device = "cuda:0"
        _pipeline = pyannote_pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=PYANNOTE_AUTH_TOKEN,
        )
        _pipeline.to(torch.device(device))
    
    return _pipeline

def diarize_audio(input_path="src/audio.wav") -> list[dict[str, float | str]]:
    """音声ファイルに対して話者分離を実行する"""
    pipeline = get_pipe() # 必要に応じてパイプラインを取得
    
    try:
        # 話者分離実行
        diarization = pipeline(input_path)
        
        response = []
        print(f"Starting diarization for {input_path}")
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            print(f"Found speaker: {speaker}, start: {turn.start}, end: {turn.end}")
            response.append({
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
                "speaker": speaker
            })
        
        print(f"Diarization completed. Found {len(response)} segments")
        print(f"Final response: {response}")
        return response
        
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return []

class SpeakerDiarization(Base):
    __tablename__ = 'speaker_diarization'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, nullable=False)
    audio_filename = Column(String(255), nullable=False)
    start = Column(Float)
    end = Column(Float)
    speaker = Column(String(50), nullable=False)
    created_at = Column(DateTime)

if __name__ == "__main__":
    diarize_audio()