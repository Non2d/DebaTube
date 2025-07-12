import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
from transformers.pipelines import pipeline as transformers_pipeline
from sqlalchemy import Column, Integer, Text, DateTime, Float
from sqlalchemy.orm import Mapped, mapped_column
from database import Base
from datetime import datetime
import gc

# グローバル変数
_pipeline = None
_transcription_count = 0

def get_pipe():
    """パイプラインを取得（必要に応じて再ロード）"""
    global _pipeline
    
    # モデルが存在しない、または何らかの理由で無効な場合は再ロード
    if _pipeline is None:
        print("Loading Whisper model...")
        model_id = "openai/whisper-large-v3-turbo"
        device = "cuda:0" if torch.cuda.is_available() else "cpu"
        torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id, 
            torch_dtype=torch_dtype,
            low_cpu_mem_usage=True, 
            use_safetensors=True
        )
        model.to(device)
        model.eval()  # 評価モードに設定
        
        processor = AutoProcessor.from_pretrained(model_id)
        
        _pipeline = transformers_pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            max_new_tokens=128,
            chunk_length_s=30,
            batch_size=1,
            return_timestamps="word",
            torch_dtype=torch_dtype,
            device=device,
        )
        print("Model loaded successfully!")
    
    return _pipeline

def cleanup_pipeline():
    """パイプラインを明示的にクリーンアップ"""
    global _pipeline
    
    if _pipeline is not None:
        # パイプラインの内部モデルとプロセッサを削除
        if hasattr(_pipeline, 'model'):
            del _pipeline.model
        if hasattr(_pipeline, 'tokenizer'):
            del _pipeline.tokenizer
        if hasattr(_pipeline, 'feature_extractor'):
            del _pipeline.feature_extractor
        
        del _pipeline
        _pipeline = None
    
    # ガベージコレクションを強制実行
    gc.collect()
    
    # CUDAメモリをクリア
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()

def transcribe_audio(input_path="src/audio.wav", language="english") -> list:
    """音声ファイルを文字起こしする"""
    global _transcription_count
    
    pipe = get_pipe()  # 必要に応じてモデルをロード
    
    try:
        response = []
        
        # 勾配計算を無効化して推論
        with torch.no_grad():
            result = pipe(input_path, generate_kwargs={"language": language}, return_timestamps="word")
        
        result_dict = result[0] if isinstance(result, list) else result
        for chunk in result_dict["chunks"]:
            response.append({
                "start": chunk["timestamp"][0], 
                "end": chunk["timestamp"][1], 
                "text": chunk["text"]
            })
        
        # カウンターを増やす
        _transcription_count += 1
        
        # 10回ごとにパイプラインをリセット（メモリリーク対策）
        if _transcription_count % 10 == 0:
            print(f"Resetting pipeline after {_transcription_count} transcriptions...")
            cleanup_pipeline()
            # 次回使用時に自動的に再ロードされる
        
        # CUDAメモリの定期的なクリア（毎回実行）
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return response
        
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        # エラー時もメモリをクリア
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
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

if __name__ == "__main__":
    # テスト実行
    result = transcribe_audio()
    print(f"Transcription result: {result}")
    
    # 手動でクリーンアップ（オプション）
    # cleanup_pipeline()