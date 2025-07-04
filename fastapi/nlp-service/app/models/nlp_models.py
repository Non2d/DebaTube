import torch
from pyannote.audio import Pipeline as PyannotePipeline
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline as transformers_pipeline
from dotenv import load_dotenv
import os
import csv
from typing import List, Dict

# 環境変数の読み込み
load_dotenv(dotenv_path=".env")
PYANNOTE_AUTH_TOKEN = os.getenv("PYANNOTE_AUTH_TOKEN")

class NLPModels:
    def __init__(self):
        self.speech_recognition_model = None
        self.speaker_diarization_model = None
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        
    def load_speech_recognition_model(self):
        """音声認識モデルをロード"""
        if self.speech_recognition_model is None:
            model_id = "openai/whisper-large-v3-turbo"
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id, 
                torch_dtype=self.torch_dtype, 
                low_cpu_mem_usage=True, 
                use_safetensors=True
            )
            model.to(self.device)
            processor = AutoProcessor.from_pretrained(model_id)
            
            self.speech_recognition_model = transformers_pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                max_new_tokens=256,
                chunk_length_s=30,
                batch_size=16,
                return_timestamps="word",
                torch_dtype=self.torch_dtype,
                device=self.device,
            )
        return self.speech_recognition_model
    
    def load_speaker_diarization_model(self):
        """話者分離モデルをロード"""
        if self.speaker_diarization_model is None:
            self.speaker_diarization_model = PyannotePipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=PYANNOTE_AUTH_TOKEN,
            )
            self.speaker_diarization_model.to(torch.device(self.device))
        return self.speaker_diarization_model
    
    def transcribe_audio(self, file_path: str, language: str = "english") -> List[Dict]:
        """
        音声ファイルを文字起こしする
        
        Args:
            file_path: 音声ファイルのパス
            language: 言語設定
            
        Returns:
            List[Dict]: [{start, end, text}] 形式のリスト
        """
        model = self.load_speech_recognition_model()
        
        result = model(file_path, generate_kwargs={"language": language})
        
        transcription = []
        for chunk in result["chunks"]:
            transcription.append({
                "start": chunk["timestamp"][0],
                "end": chunk["timestamp"][1], 
                "text": chunk["text"]
            })
        
        return transcription
    
    def diarize_speakers(self, file_path: str) -> List[Dict]:
        """
        音声ファイルの話者分離を行う
        
        Args:
            file_path: 音声ファイルのパス
            
        Returns:
            List[Dict]: [{start, end, speaker}] 形式のリスト
        """
        model = self.load_speaker_diarization_model()
        
        diarization = model(file_path)
        
        speakers = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speakers.append({
                "start": round(turn.start, 2),
                "end": round(turn.end, 2),
                "speaker": speaker
            })
        
        return speakers

# グローバルインスタンス
nlp_models = NLPModels()