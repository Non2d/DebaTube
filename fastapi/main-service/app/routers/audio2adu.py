from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
from log_config import logger
from openai import OpenAI
import os, json, tempfile
from datetime import datetime

router = APIRouter()

# OpenAI client初期化
client = OpenAI()

# 文字起こし結果の保存先ディレクトリ
TRANSCRIPTION_DIR = os.path.join(os.path.dirname(__file__), "../../transcriptions")
os.makedirs(TRANSCRIPTION_DIR, exist_ok=True)

@router.post("/audio-to-text")
async def audio_to_text(file: UploadFile = File(...)):
    """
    音声ファイルを文字起こしするエンドポイント
    - webmなどの音声ファイルを受け取る
    - OpenAI Whisper APIで文字起こし
    - 結果をJSON形式で返し、ファイルとしても保存
    """
    try:
        # 一時ファイルとして保存（OpenAI APIはファイルオブジェクトが必要）
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # OpenAI Whisper APIで文字起こし
        with open(temp_file_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                response_format="verbose_json",
                timestamp_granularities=["word"]
            )

        # 一時ファイルを削除
        os.unlink(temp_file_path)

        # タイムスタンプ付きファイル名を生成（0.1秒単位）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]  # マイクロ秒の最後の1桁を除く（0.1秒単位）
        output_filename = f"transcription_{timestamp}.json"
        output_path = os.path.join(TRANSCRIPTION_DIR, output_filename)

        # 結果をJSON形式で保存
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(transcription.model_dump(), f, ensure_ascii=False, indent=2)

        logger.info(f"Transcription saved to {output_path}")

        # 結果を返す
        return {
            "status": "success",
            "transcription": transcription.model_dump(),
            "saved_to": output_path
        }

    except Exception as e:
        logger.error(f"Error during transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
