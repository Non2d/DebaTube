import torch
from pyannote.audio import Pipeline as PyannotePipeline
from dotenv import load_dotenv
import os
import csv

load_dotenv(dotenv_path=".env")
PYANNOTE_AUTH_TOKEN = os.getenv("PYANNOTE_AUTH_TOKEN")

_pipeline = None

def get_pyannote_pipeline():
    """Pyannoteの話者分離パイプラインを取得（必要に応じて再ロード）"""
    global _pipeline
    
    # パイプラインが存在しない、または何らかの理由で無効な場合は再ロード
    if _pipeline is None:
        print("Loading Pyannote pipeline...")
        device = "cuda:0"
        _pipeline = PyannotePipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=PYANNOTE_AUTH_TOKEN,
        )
        _pipeline.to(torch.device(device))
    
    return _pipeline

def diarize_audio(input_dir="src", output_dir="dst/diarization"):
    """指定ディレクトリ内の音声ファイルに対して話者分離を実行する"""
    
    # 出力ディレクトリの作成
    os.makedirs(output_dir, exist_ok=True)
    
    # 必要に応じてパイプラインを取得
    pipeline = get_pyannote_pipeline()
    
    # ディレクトリ内のWAVファイルを処理
    for file_name in os.listdir(input_dir):
        if file_name.endswith(".wav"):
            file_path = os.path.join(input_dir, file_name)
            print(f"Processing: {file_path}")
            
            try:
                # 話者分離実行
                diarization = pipeline(file_path)
                
                # CSVファイルに結果を保存
                base_name = os.path.splitext(file_name)[0]
                output_path = os.path.join(output_dir, f"{base_name}-asr.csv")
                
                with open(output_path, "w", encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(["start", "end", "speaker"])
                    
                    for turn, _, speaker in diarization.itertracks(yield_label=True):
                        writer.writerow([
                            round(turn.start, 2), 
                            round(turn.end, 2), 
                            speaker
                        ])
                
                print(f"Saved diarization to: {output_path}")
                
            except Exception as e:
                print(f"Error processing {file_name}: {e}")

if __name__ == "__main__":
    diarize_audio()