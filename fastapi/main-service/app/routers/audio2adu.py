from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from log_config import logger
from openai import OpenAI, AsyncOpenAI
import os, json, tempfile, re, csv
from datetime import datetime
import asyncio

from google import genai

router = APIRouter()

# ===== Pydantic Models =====

class WordInfo(BaseModel):
    """Word-level timing information from Whisper"""
    word: str
    start: float
    end: float

class TranscriptRequest(BaseModel):
    """Transcription input from Whisper API with verbose_json format"""
    text: str
    language: str
    duration: float
    words: List[WordInfo]

# OpenAI client初期化
client = OpenAI()
async_client = AsyncOpenAI()
client_gemini = genai.Client()

APP_DIR = os.path.dirname(__file__)  # /app/routers

TRANSCRIPTION_DIR = os.path.join(os.path.dirname(APP_DIR), "transcriptions")  # 文字起こし保存ディレクトリ
os.makedirs(TRANSCRIPTION_DIR, exist_ok=True)

LOGS_DIR = os.path.join(os.path.dirname(APP_DIR), "logs")  # ログ保存ディレクトリ
os.makedirs(LOGS_DIR, exist_ok=True)

ADUS_DIR = os.path.join(TRANSCRIPTION_DIR, "adus")  # ADU保存ディレクトリ
os.makedirs(ADUS_DIR, exist_ok=True)

async def transcribe_single_audio(file: UploadFile) -> tuple[str, str, Optional[Dict[str, Any]]]:
    """
    1つのファイルを文字起こしする
    返り値: (speech_key, date_transcribed, transcription_dict)
    """
    try:
        filename_without_ext = os.path.splitext(file.filename)[0]
        if "-" not in filename_without_ext:
            logger.warning(f"Invalid filename format: {file.filename}")
            return "", "", None

        parts = filename_without_ext.split("-", 1)  # 最初の"-"で分割
        speech_key = parts[0]
        date_transcribed = parts[1] if len(parts) > 1 else ""

        # 一時ファイルとして保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # AsyncOpenAI APIで文字起こし（非同期実行）
            with open(temp_file_path, "rb") as audio_file:
                transcription = await async_client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-1",
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                    language="en"
                )
        finally:
            os.unlink(temp_file_path)

        trans_dict = transcription.model_dump()
        result = {
            "date_transcribed": date_transcribed,
            "duration": trans_dict.get("duration", 0),
            "language": trans_dict.get("language", ""),
            **trans_dict
        }

        logger.info(f"Transcribed: {speech_key} (from {file.filename})")
        return speech_key, date_transcribed, result

    except Exception as file_error:
        logger.error(f"Error processing file {file.filename}: {str(file_error)}")
        return "", "", None

@router.post("/audio-to-transcript-batch")
async def audio_to_transcript_batch(files: List[UploadFile] = File(...)):
    """
    複数の音声ファイルを非同期で並列に文字起こしするエンドポイント
    - ファイル名形式: "Proposition_1st-2025-11-16_140426.webm"
    - キー: "-"の前の部分（例：Proposition_1st）
    - date_transcribed: "-"の後の部分（例：2025-11-16_140426）
    - 結果を1つのJSONにまとめて保存
    """
    try:
        # 複数ファイルを非同期で並列処理
        tasks = [transcribe_single_audio(file) for file in files]
        results = await asyncio.gather(*tasks)

        batch_results: Dict[str, Any] = {}
        for speech_key, date_transcribed, trans_dict in results:
            if trans_dict is not None and speech_key:
                batch_results[speech_key] = trans_dict

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
async def transcript_to_adu(transcript: TranscriptRequest):
    """
    Convert a single speech transcription to Argument Discourse Units (ADUs)
    - Input: Transcription JSON from Whisper API (verbose_json format)
    - Output: ADU segmentation with roles and timestamps
    """
    try:
        # Extract text and word data from transcript
        transcript_text = transcript.text
        words_data = [word.model_dump() for word in transcript.words]
        GEMINI_MODEL = "gemini-2.5-pro"

        # Prepare prompt for Gemini
        response = client_gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"""
Please segment the following debate speech into Argument Discourse Units (ADUs).
Each ADU represents a single argument or discourse unit with a specific role (claim, premise, rebuttal, counterargument, etc.).

Speech transcription:
{transcript_text}

Word-level timestamps:
{json.dumps(words_data, indent=2)}

Return the result as JSON in the following format:
{{
  "adus": [
    {{
      "id": 1,
      "start_word_index": 0,
      "end_word_index": 5,
      "text": "The actual ADU text",
      "role": "claim",
      "start_time": 0.0,
      "end_time": 2.5,
    }}
  ]
}}

Focus on semantic units of argumentation. Be precise with word indices and timestamps.
"""
        )

        # Save response to log file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        log_filename = f"adu_conversion_{timestamp}.json"
        log_path = os.path.join(LOGS_DIR, log_filename)

        # Extract response text
        response_text = response.text if hasattr(response, 'text') else str(response)

        log_data = {
            "timestamp": timestamp,
            "input_transcript": transcript.model_dump(),
            "gemini_response": response_text,
            "model": GEMINI_MODEL
        }

        try:
            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(log_data, f, ensure_ascii=False, indent=2)
            print(f"ADU conversion log saved to: {log_path}")
            logger.info(f"ADU conversion log saved to {log_path}")
        except Exception as save_error:
            print(f"Error saving log file to {log_path}: {str(save_error)}")
            logger.error(f"Error saving log file: {str(save_error)}")

        # Convert ADU response to CSV format
        csv_filename = f"adu_conversion_{timestamp}.csv"
        csv_path = os.path.join(ADUS_DIR, csv_filename)

        try:
            # Parse Gemini response as JSON
            adu_json = json.loads(response_text)
            adus_list = adu_json.get("adus", [])

            # Write to CSV
            if adus_list:
                fieldnames = ["id", "start_word_index", "end_word_index", "text", "role", "start_time", "end_time", "confidence"]

                with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames, restval="")
                    writer.writeheader()

                    for adu in adus_list:
                        # Ensure all required fields exist, use empty string as default
                        row = {field: adu.get(field, "") for field in fieldnames}
                        writer.writerow(row)

                print(f"ADU CSV saved to: {csv_path}")
                logger.info(f"ADU CSV saved to {csv_path}")
            else:
                print(f"No ADUs found in Gemini response")
                logger.warning(f"No ADUs found in Gemini response")

        except json.JSONDecodeError as json_error:
            print(f"Error parsing Gemini response as JSON: {str(json_error)}")
            logger.error(f"Error parsing Gemini response as JSON: {str(json_error)}")
            csv_path = None
        except Exception as csv_error:
            print(f"Error saving CSV file to {csv_path}: {str(csv_error)}")
            logger.error(f"Error saving CSV file: {str(csv_error)}")
            csv_path = None

        # Return results
        return {
            "status": "success",
            "adu_response": response_text,
            "log_saved_to": log_path,
            "csv_saved_to": csv_path,
            "adus_dir": ADUS_DIR,
            "files_exist": {
                "log": os.path.exists(log_path),
                "csv": os.path.exists(csv_path) if csv_path else False
            }
        }

    except Exception as e:
        logger.error(f"Error during ADU conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"ADU conversion failed: {str(e)}")

# @router.post("/transcript-to-adu-batch")
# async def transcript_to_adu_batch(file: UploadFile = File(...)):
#     """
#     batch_transcription JSONファイルをADUに変換するエンドポイント
#     - ファイル形式: batch_transcription_*.json
#     - 複数のスピーチの文字起こしを一度に処理
#     - 各スピーチをADUに変換し、結果をまとめてログに保存
#     """
#     try:
#         # JSONファイルを読み込む
#         content = await file.read()
#         batch_transcript = json.loads(content.decode('utf-8'))

#         # 変換結果を格納
#         adu_results: Dict[str, Any] = {}
#         GEMINI_MODEL = "gemini-2.5-pro"

#         # 各スピーチに対してADU変換を実行
#         for speech_key, transcript_data in batch_transcript.items():
#             try:
#                 # 文字起こしテキストを準備
#                 transcript_text = json.dumps(transcript_data, ensure_ascii=False, indent=2)

#                 # Gemini APIを呼び出し
#                 response = client_gemini.models.generate_content(
#                     model=GEMINI_MODEL,
#                     contents=f"""
# 以下の議論のスピーチ "{speech_key}" の文字起こし結果をArgument Discourse Units (ADU)に変換してください。
# 各ADUは論証の単位であり、claim、premise、rebuttal などの役割を持ちます。

# 文字起こし結果：
# {transcript_text}

# JSON形式で以下の構造で出力してください：
# {{
#   "speech_key": "{speech_key}",
#   "adus": [
#     {{
#       "id": 1,
#       "text": "ADUのテキスト",
#       "role": "claim/premise/rebuttal/etc",
#       "start_time": 0.0,
#       "end_time": 1.5
#     }}
#   ],
#   "summary": "このスピーチの要約"
# }}
# """
#                 )

#                 response_text = response.text if hasattr(response, 'text') else str(response)
#                 adu_results[speech_key] = {
#                     "input_transcript": transcript_data,
#                     "gemini_response": response_text
#                 }

#                 logger.info(f"ADU conversion completed for {speech_key}")

#             except Exception as speech_error:
#                 logger.error(f"Error processing {speech_key}: {str(speech_error)}")
#                 adu_results[speech_key] = {
#                     "input_transcript": transcript_data,
#                     "error": str(speech_error)
#                 }
#                 continue

#         # ログファイルに保存
#         timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
#         log_filename = f"adu_batch_conversion_{timestamp}.json"
#         log_path = os.path.join(LOGS_DIR, log_filename)

#         log_data = {
#             "timestamp": timestamp,
#             "input_filename": file.filename,
#             "model": GEMINI_MODEL,
#             "speeches_processed": len(adu_results),
#             "adu_results": adu_results
#         }

#         try:
#             with open(log_path, "w", encoding="utf-8") as f:
#                 json.dump(log_data, f, ensure_ascii=False, indent=2)
#             print(f"ADU batch conversion log saved to: {log_path}")
#             logger.info(f"ADU batch conversion log saved to {log_path}")
#         except Exception as save_error:
#             print(f"Error saving log file to {log_path}: {str(save_error)}")
#             logger.error(f"Error saving log file: {str(save_error)}")

#         # 結果を返す
#         return {
#             "status": "success",
#             "speeches_processed": len(adu_results),
#             "adu_results": adu_results,
#             "saved_to": log_path,
#             "logs_dir": LOGS_DIR,
#             "file_exists": os.path.exists(log_path)
#         }

#     except Exception as e:
#         logger.error(f"Error during batch ADU conversion: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Batch ADU conversion failed: {str(e)}")
