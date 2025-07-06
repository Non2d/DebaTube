import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor
from transformers.pipelines import pipeline as transformers_pipeline
import os
import csv
import gc

# グローバル変数
_pipe = None

def get_pipe():
    """パイプラインを取得（必要に応じて再ロード）"""
    global _pipe
    
    # モデルが存在しない、または何らかの理由で無効な場合は再ロード
    if _pipe is None:
        print("Loading Whisper model...")
        model_id = "openai/whisper-large-v3-turbo"
        device = "cuda:0"
        torch_dtype = torch.float16
        
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id, 
            torch_dtype=torch_dtype,
            low_cpu_mem_usage=True, 
            use_safetensors=True
        )
        model.to(device)
        
        processor = AutoProcessor.from_pretrained(model_id)
        
        _pipe = transformers_pipeline(
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
        print("Model loaded successfully!")
    
    return _pipe

def transcribe_audio(input_dir="src", output_dir="dst/speech-recognition", language="english"):
    """指定ディレクトリ内の音声ファイルを文字起こしする"""
    
    # 出力ディレクトリの作成
    os.makedirs(output_dir, exist_ok=True)
    
    # 必要に応じてモデルを取得
    pipe = get_pipe()
    
    for file_name in os.listdir(input_dir):
        if file_name.endswith(".wav"):
            full_path = os.path.join(input_dir, file_name)
            print(f"Processing: {full_path}")
            
            try:
                result = pipe(full_path, generate_kwargs={"language": language}, return_timestamps="word")
                base_name = os.path.splitext(file_name)[0]
                output_path = os.path.join(output_dir, f"{base_name}.csv")
                
                with open(output_path, "w", encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(["start", "end", "text"])
                    
                    result_dict = result[0] if isinstance(result, list) else result
                    for chunk in result_dict["chunks"]:
                        writer.writerow([
                            chunk["timestamp"][0], 
                            chunk["timestamp"][1], 
                            chunk["text"]
                        ])
                
                print(f"Saved transcription to: {output_path}")
                
                del result
                gc.collect()
                
            except Exception as e:
                print(f"Error processing {file_name}: {e}")

if __name__ == "__main__":
    transcribe_audio()
