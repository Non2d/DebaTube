import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
from transformers.pipelines import pipeline as transformers_pipeline
from sqlalchemy import Column, Integer, Text, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from datetime import datetime

# グローバル変数
_pipeline = None

def get_pipe():
    """パイプラインを取得（必要に応じて再ロード）"""
    global _pipeline
    
    # モデルが存在しない、または何らかの理由で無効な場合は再ロード
    if _pipeline is None:
        print("Loading Whisper model...")
        model_id = "openai/whisper-large-v3-turbo"
        torch_dtype = torch.float16
        
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id, 
            torch_dtype=torch_dtype,
            low_cpu_mem_usage=True, 
            use_safetensors=True,
            device_map="cuda:0"
        )
        
        processor = AutoProcessor.from_pretrained(model_id)
        
        _pipeline = transformers_pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            max_new_tokens=256,
            chunk_length_s=30,
            batch_size=16,
            return_timestamps="word",
            torch_dtype=torch_dtype,
        )
        print("Model loaded successfully!")
    
    return _pipeline

def transcribe_audio(input_path="src/audio.wav", language="english") -> list: # [{start, end, text}]
    """音声ファイルを文字起こしする"""
    pipe = get_pipe() # 必要に応じてモデルをロード
    
    try:
        response = []
        result = pipe(input_path, generate_kwargs={"language": language}, return_timestamps="word")
        
        result_dict = result[0] if isinstance(result, list) else result
        for chunk in result_dict["chunks"]:
            response.append({
                "start": chunk["timestamp"][0], 
                "end": chunk["timestamp"][1], 
                "text": chunk["text"]
            })
        
        return response
        
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return []

class SpeechRecognition(Base):
    __tablename__ = 'speech_recognition'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(Integer, nullable=False)
    audio_filename: Mapped[str] = mapped_column(Text, nullable=False)
    start: Mapped[float] = mapped_column(Float)
    end: Mapped[float] = mapped_column(Float)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)
