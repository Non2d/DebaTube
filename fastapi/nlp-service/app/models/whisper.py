import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline as transformers_pipeline
import librosa
import os
import csv
from dotenv import load_dotenv

# 環境変数の読み込み
load_dotenv(dotenv_path=".env")

# GPU/CPU設定
device = "cuda:0" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

# Whisperモデルの設定
model_id = "openai/whisper-large-v3-turbo"

def load_whisper_model():
    """Whisperモデルとプロセッサーをロードする"""
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id, 
        torch_dtype=torch_dtype, 
        low_cpu_mem_usage=True, 
        use_safetensors=True
    )
    model.to(device)
    
    processor = AutoProcessor.from_pretrained(model_id)
    
    pipe = transformers_pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        max_new_tokens=256,
        batch_size=16,
        return_timestamps="word",
        torch_dtype=torch_dtype,
        device=device,
    )
    
    return pipe

def transcribe_audio_files(input_dir="src", output_dir="dst/speech-recognition", language="english"):
    """指定ディレクトリ内の音声ファイルを文字起こしする"""
    
    # 出力ディレクトリの作成
    os.makedirs(output_dir, exist_ok=True)
    
    # モデルのロード
    print("Loading Whisper model...")
    pipe = load_whisper_model()
    
    # ディレクトリ内のMP3ファイルを処理
    for file_name in os.listdir(input_dir):
        if file_name.endswith(".wav"):
            full_path = os.path.join(input_dir, file_name)
            print(f"Processing: {full_path}")
            
            try:
                # librosaで音声ファイルを読み込み
                audio, sr = librosa.load(full_path, sr=16000)
                
                # 音声認識実行
                result = pipe(audio, generate_kwargs={"language": language})
                
                # CSVファイルに結果を保存
                base_name = os.path.splitext(file_name)[0]
                output_path = os.path.join(output_dir, f"{base_name}.csv")
                
                with open(output_path, "w", encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(["start", "end", "text"])
                    
                    for chunk in result["chunks"]:
                        writer.writerow([
                            chunk["timestamp"][0], 
                            chunk["timestamp"][1], 
                            chunk["text"]
                        ])
                
                print(f"Saved transcription to: {output_path}")
                
                # メモリ解放
                del result
                
            except Exception as e:
                print(f"Error processing {file_name}: {e}")

if __name__ == "__main__":
    transcribe_audio_files()
