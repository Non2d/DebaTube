from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional, Dict, Any
from log_config import logger
from openai import OpenAI
import os, json, tempfile, re
from datetime import datetime

from google import genai

router = APIRouter()

# OpenAI client初期化
client = OpenAI()
client_gemini = genai.Client()

# 文字起こし結果の保存先ディレクトリ
# Docker内の /app/transcriptions に保存
# ホストからは ./fastapi/main-service/app/transcriptions でアクセス可能
APP_DIR = os.path.dirname(__file__)  # /app/routers
TRANSCRIPTION_DIR = os.path.join(os.path.dirname(APP_DIR), "transcriptions")  # /app/transcriptions
os.makedirs(TRANSCRIPTION_DIR, exist_ok=True)

# デバッグ用
print(f"Transcription directory: {TRANSCRIPTION_DIR}")

# @router.post("/audio-to-transcript")
# async def audio_to_transcript(file: UploadFile = File(...)):
#     """
#     音声ファイルを文字起こしするエンドポイント
#     - webmなどの音声ファイルを受け取る
#     - OpenAI Whisper APIで文字起こし
#     - 結果をJSON形式で返し、ファイルとしても保存
#     """
#     try:
#         # 一時ファイルとして保存（OpenAI APIはファイルオブジェクトが必要）
#         with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
#             content = await file.read()
#             temp_file.write(content)
#             temp_file_path = temp_file.name

#         # OpenAI Whisper APIで文字起こし
#         with open(temp_file_path, "rb") as audio_file:
#             transcription = client.audio.transcriptions.create(
#                 file=audio_file,
#                 model="whisper-1",
#                 response_format="verbose_json",
#                 timestamp_granularities=["word"],
#                 language="en"
#             )

#         # 一時ファイルを削除
#         os.unlink(temp_file_path)

#         # タイムスタンプ付きファイル名を生成（0.1秒単位）
#         timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]  # マイクロ秒の最後の1桁を除く（0.1秒単位）
#         output_filename = f"transcription_{timestamp}.json"
#         output_path = os.path.join(TRANSCRIPTION_DIR, output_filename)

#         # 結果をJSON形式で保存
#         try:
#             with open(output_path, "w", encoding="utf-8") as f:
#                 json.dump(transcription.model_dump(), f, ensure_ascii=False, indent=2)
#             print(f"File saved successfully: {output_path}")
#             logger.info(f"Transcription saved to {output_path}")
#         except Exception as save_error:
#             print(f"Error saving file to {output_path}: {str(save_error)}")
#             logger.error(f"Error saving file: {str(save_error)}")

#         # 結果を返す
#         return {
#             "status": "success",
#             "transcription": transcription.model_dump(),
#             "saved_to": output_path,
#             "transcription_dir": TRANSCRIPTION_DIR,
#             "file_exists": os.path.exists(output_path)
#         }

#     except Exception as e:
#         logger.error(f"Error during transcription: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.post("/audio-to-transcript-batch")
async def audio_to_transcript_batch(files: List[UploadFile] = File(...)):
    """
    複数の音声ファイルを一度に文字起こしするエンドポイント
    - ファイル名形式: "Proposition_1st-2025-11-16_140426.webm"
    - キー: "-"の前の部分（例：Proposition_1st）
    - date_transcribed: "-"の後の部分（例：2025-11-16_140426）
    - 結果を1つのJSONにまとめて保存
    """
    try:
        batch_results: Dict[str, Any] = {}

        for file in files:
            try:
                filename_without_ext = os.path.splitext(file.filename)[0]
                if "-" not in filename_without_ext:
                    logger.warning(f"Invalid filename format: {file.filename}")
                    continue

                parts = filename_without_ext.split("-", 1)  # 最初の"-"で分割
                speech_key = parts[0]
                date_transcribed = parts[1] if len(parts) > 1 else ""
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
                        timestamp_granularities=["word"],
                        language="en"
                    )

                os.unlink(temp_file_path)
                trans_dict = transcription.model_dump()
                batch_results[speech_key] = {
                    "date_transcribed": date_transcribed,
                    "duration": trans_dict.get("duration", 0),
                    "language": trans_dict.get("language", ""),
                    **trans_dict
                }

                logger.info(f"Transcribed: {speech_key} (from {file.filename})")

            except Exception as file_error:
                logger.error(f"Error processing file {file.filename}: {str(file_error)}")
                continue

        if not batch_results:
            raise HTTPException(status_code=400, detail="No files were successfully processed")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        output_filename = f"batch_transcription_{timestamp}.json"
        output_path = os.path.join(TRANSCRIPTION_DIR, output_filename)

        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(batch_results, f, ensure_ascii=False, indent=2)
            print(f"Batch file saved successfully: {output_path}")
            logger.info(f"Batch transcription saved to {output_path}")
        except Exception as save_error:
            print(f"Error saving batch file to {output_path}: {str(save_error)}")
            logger.error(f"Error saving batch file: {str(save_error)}")

        return {
            "status": "success",
            "files_processed": len(batch_results),
            "batch_results": batch_results,
            "saved_to": output_path,
            "transcription_dir": TRANSCRIPTION_DIR,
            "file_exists": os.path.exists(output_path)
        }

    except Exception as e:
        logger.error(f"Error during batch transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch transcription failed: {str(e)}")

@router.post("/transcript-to-adu")
async def transcript_to_adu(transcript: Dict[str, Any]):
    response = client_gemini.models.generate_content(
        model="gemini-2.5-flash",
        contents="Explain hou WI works in a few words."
    )

    print("Gemini Response:", response)
    return {
        "status": "success",
        "gemini_response": response
    }
