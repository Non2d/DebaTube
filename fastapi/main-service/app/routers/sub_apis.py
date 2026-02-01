"""
Utility/Sub APIs - Less essential endpoints for manual verification and debugging
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from log_config import logger
from pydantic import BaseModel
from typing import List, Dict, Any
import os, json, csv, time, re, tempfile
from datetime import datetime, timezone, timedelta
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from routers.round import RoundResponse
from typing import Optional

from db import get_db
from models.round import Round, Speech, Word, Sentence, Adu, Rebuttal
from cruds import round as round_crud
from sqlalchemy import delete, select
import shutil
from config import AUDIO_DIR
from services.transcription_service import delete_background_transcription_batch_remote, delete_audio_cache_remote
from clients import client, async_client, groq_client, client_studio_gemini, client_vertex_gemini

router = APIRouter()

# Import shared directories
from .audio2adu import ADUS_DIR, LOGS_DIR
from .utils import clean_gemini_markdown_response, DEBATE_FORMATS, group_words_into_sentences, merge_adus_to_unified_csv, unified_csv_to_markdown

# Define SUB_TRANSCRIPTS directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUB_TRANSCRIPTS_DIR = os.path.join(BASE_DIR, "transcriptions", "sub-transcripts")

# ===== Pydantic Models =====

class WordInfo(BaseModel):
    """Word-level timing information"""
    word: str
    start: float
    end: float

class TranscriptRequest(BaseModel):
    """Transcription input from Whisper API with verbose_json format"""
    text: str
    language: str
    duration: float
    words: List[WordInfo]

class SentenceGroupRequest(BaseModel):
    """Request for grouping words into sentences"""
    text: str
    words: List[WordInfo]

class SentenceInfo(BaseModel):
    """Sentence-level timing information"""
    text: str
    start_time: float
    end_time: float

class SentenceGroupResponse(BaseModel):
    """Response containing grouped sentences"""
    sentences: List[SentenceInfo]

# ===== Helper Functions =====

async def transcribe_single_file(file: UploadFile) -> Dict[str, Any]:
    """
    Transcribe a single audio file asynchronously
    Returns: Dictionary with transcription result or error information
    """
    temp_file_path = None
    try:
        # Save uploaded file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # Call Whisper API for transcription (async version)
            with open(temp_file_path, "rb") as audio_file:
                transcription = await async_client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-1",
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                )
        finally:
            # Clean up temporary file
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)

        # Convert response to dict for JSON serialization
        response_dict = transcription.model_dump() if hasattr(transcription, 'model_dump') else dict(transcription)

        # Save transcription result to sub-transcripts directory
        audio_filename_base = os.path.splitext(file.filename)[0]
        jst = timezone(timedelta(hours=9))
        timestamp = datetime.now(jst).strftime("%Y%m%d_%H%M%S_%f")[:-5]
        json_filename = f"{audio_filename_base}_{timestamp}.json"
        json_path = os.path.join(SUB_TRANSCRIPTS_DIR, json_filename)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(response_dict, f, ensure_ascii=False, indent=2)

        logger.info(f"Transcription saved to: {json_path}")

        return {
            "filename": file.filename,
            "status": "success",
            "transcription": response_dict,
            "saved_to": json_path,
            "file_exists": os.path.exists(json_path)
        }

    except Exception as e:
        logger.error(f"Error during audio transcription for {file.filename}: {str(e)}")
        return {
            "filename": file.filename,
            "status": "failed",
            "error": str(e)
        }

# ===== Endpoints =====

@router.post("/audio-to-transcript")
async def audio_to_transcript(files: List[UploadFile] = File(...)):
    """
    Transcribe multiple audio files in parallel using Whisper API with verbose_json output
    - Input: One or more audio file uploads
    - Output: Array of transcription results with word-level timestamps
    - Saves each result to transcriptions/sub-transcripts/
    - Processing: Asynchronous parallel processing with AsyncOpenAI
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Process all files in parallel using asyncio.gather
    tasks = [transcribe_single_file(file) for file in files]
    results = await asyncio.gather(*tasks)

    # Separate successful and failed results
    successful_results = [r for r in results if r["status"] == "success"]
    failed_results = [r for r in results if r["status"] == "failed"]

    # Return overall status
    overall_status = "success" if len(successful_results) == len(files) else (
        "partial_success" if successful_results else "failed"
    )

    return {
        "status": overall_status,
        "total_files": len(files),
        "successful_count": len(successful_results),
        "failed_count": len(failed_results),
        "successful_results": successful_results,
        "failed_results": failed_results
    }



# @router.post("/group-sentences", response_model=SentenceGroupResponse)
# async def group_sentences(request: SentenceGroupRequest):
#     """
#     Group word-level timestamps into sentence-level data.
#     Sentences are split by punctuation marks (. ? !)

#     Args:
#         request: Contains full text with punctuation and word-level timestamp data

#     Returns:
#         SentenceGroupResponse: List of sentences with timing information
#     """
#     try:
#         text = request.text
#         words_data = [word.model_dump() for word in request.words]

#         if not words_data:
#             return SentenceGroupResponse(sentences=[])

#         # Split text into sentences using common punctuation, preserving the punctuation
#         sentence_pattern = r'([.!?]+)'
#         parts = re.split(sentence_pattern, text)

#         # Combine text parts with their punctuation
#         sentence_texts = []
#         for i in range(0, len(parts) - 1, 2):
#             if parts[i].strip():
#                 # Combine sentence text with its punctuation
#                 sentence_with_punct = parts[i].strip()
#                 if i + 1 < len(parts):
#                     sentence_with_punct += parts[i + 1]
#                 sentence_texts.append(sentence_with_punct)

#         # Handle last part if it doesn't end with punctuation
#         if len(parts) % 2 == 1 and parts[-1].strip():
#             sentence_texts.append(parts[-1].strip())

#         sentences = []
#         current_word_idx = 0

#         for sentence_text in sentence_texts:
#             # Count words in this sentence (approximate by splitting on whitespace)
#             sentence_words = sentence_text.split()
#             expected_word_count = len(sentence_words)

#             # Find the end index for this sentence
#             end_word_idx = min(current_word_idx + expected_word_count, len(words_data))

#             # Skip if no words in range
#             if current_word_idx >= len(words_data):
#                 break

#             # Get start and end times from the word data
#             start_time = words_data[current_word_idx].get("start", 0)
#             end_time = words_data[min(end_word_idx - 1, len(words_data) - 1)].get("end", start_time)

#             sentences.append(SentenceInfo(
#                 text=sentence_text,
#                 start_time=round(start_time, 1),
#                 end_time=round(end_time, 1),
#                 start_word_index=current_word_idx,
#                 end_word_index=end_word_idx - 1
#             ))

#             current_word_idx = end_word_idx

#         return SentenceGroupResponse(sentences=sentences)

#     except Exception as e:
#         logger.error(f"Error processing sentences: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"Error processing sentences: {str(e)}")

@router.post("/adu-jsonlog-to-csv")
async def adu_json_to_csv(file: UploadFile = File(...)):
    """
    Convert ADU JSON file to CSV format for manual verification
    - Input: ADU JSON file (adu_conversion_*.json from logs or direct ADU JSON)
    - Output: CSV file download

    Handles:
    1. Log file format: {timestamp, input_transcript, gemini_response, model}
    2. Direct ADU response: {adus: [...], ...}
    3. Direct ADU array: [...]
    """
    try:
        # Read JSON file
        content = await file.read()
        adu_data = json.loads(content.decode('utf-8'))

        # Extract adus array from different formats
        adus_list = None

        # Case 1: Log file format with gemini_response field
        if isinstance(adu_data, dict) and "gemini_response" in adu_data:
            try:
                gemini_response_str = adu_data["gemini_response"]

                # Remove markdown code block formatting (```json ... ```)
                if isinstance(gemini_response_str, str):
                    cleaned_response = clean_gemini_markdown_response(gemini_response_str)
                    gemini_response = json.loads(cleaned_response)
                else:
                    gemini_response = gemini_response_str

                adus_list = gemini_response.get("adus", []) if isinstance(gemini_response, dict) else []
                logger.info(f"Extracted {len(adus_list)} ADUs from log file format")
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing gemini_response as JSON: {str(e)}")
                # Try to continue with other formats
                pass

        # Case 2: Direct ADU JSON with adus array
        if not adus_list and isinstance(adu_data, dict) and "adus" in adu_data:
            adus_list = adu_data["adus"]
            logger.info(f"Extracted {len(adus_list)} ADUs from direct JSON format")

        # Case 3: Direct ADU array
        if not adus_list and isinstance(adu_data, list):
            adus_list = adu_data
            logger.info(f"Extracted {len(adus_list)} ADUs from array format")

        # No valid format found
        if not adus_list:
            raise ValueError("JSON must be: log file with 'gemini_response', or direct ADU JSON with 'adus' array, or array of ADUs")

        # Generate CSV file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        csv_filename = f"adu_converted_{timestamp}.csv"
        csv_path = os.path.join(ADUS_DIR, csv_filename)

        # Define CSV columns
        fieldnames = ["id", "start_sentence_index", "end_sentence_index", "text", "role", "start_time", "end_time"]

        # Write CSV
        with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, restval="")
            writer.writeheader()

            for adu in adus_list:
                if isinstance(adu, dict):
                    # Ensure all required fields exist
                    row = {field: adu.get(field, "") for field in fieldnames}
                    writer.writerow(row)

        logger.info(f"ADU JSON converted to CSV: {csv_path}")

        # Return the CSV file
        return FileResponse(
            path=csv_path,
            media_type="text/csv",
            filename=csv_filename
        )

    except json.JSONDecodeError as json_error:
        logger.error(f"Error parsing JSON file: {str(json_error)}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(json_error)}")
    except Exception as e:
        logger.error(f"Error converting JSON to CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=f"JSON to CSV conversion failed: {str(e)}")

# ===== Pydantic Models for CSV Merging =====

class MergeADUsRequest(BaseModel):
    """Request for merging existing ADU CSV files"""
    csv_directory: str  # Directory containing individual ADU CSV files
    debate_format: str = "NA"  # Debate format ("NA", "ASIAN", or "BP")

    model_config = {
        "json_schema_extra": {
            "example": {
                "csv_directory": "/app/transcriptions/adus",
                "debate_format": "NA"
            }
        }
    }

@router.post("/merge-aducsvs-to-unifiedcsv")
async def merge_adus_to_csv(request: MergeADUsRequest):
    """
    Manually merge existing ADU CSV files into a single unified CSV
    - Automatically finds all CSV files for speeches in the debate format
    - Merges them in the order specified by debate_format
    - Outputs: unified_{Proposition_1st_timestamp}.csv

    Use this endpoint when you already have individual ADU CSV files and want to combine them
    """
    start_time = datetime.now().timestamp()
    print(f"[/merge-aducsvs-to-unifiedcsv] 処理開始 - Debate format: {request.debate_format}")

    try:
        # Validate debate format
        if request.debate_format not in DEBATE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid debate_format. Must be one of: {', '.join(DEBATE_FORMATS.keys())}"
            )

        speech_order = DEBATE_FORMATS[request.debate_format]

        # Verify directory exists
        if not os.path.exists(request.csv_directory):
            raise HTTPException(
                status_code=404,
                detail=f"Directory not found: {request.csv_directory}"
            )

        # Read CSV files for each speech in the debate format
        adus_by_speech = {}
        missing_speeches = []
        proposition_1st_timestamp = None

        for speech_key in speech_order:
            # Find CSV file matching the speech_key pattern
            csv_files = [
                f for f in os.listdir(request.csv_directory)
                if f.startswith(speech_key + "_") and f.endswith(".csv") and not f.startswith("unified_")
            ]

            if not csv_files:
                missing_speeches.append(speech_key)
                logger.warning(f"No CSV file found for {speech_key} in {request.csv_directory}")
                continue

            # Use the most recent file if multiple matches
            csv_file = sorted(csv_files)[-1]
            csv_path = os.path.join(request.csv_directory, csv_file)

            # Extract timestamp from Proposition_1st filename
            if speech_key == "Proposition_1st" and proposition_1st_timestamp is None:
                # Extract timestamp from filename like "Proposition_1st_20251116_055828_7.csv"
                match = re.search(r'Proposition_1st_(.+)\.csv$', csv_file)
                if match:
                    proposition_1st_timestamp = match.group(1)

            # Read ADUs from CSV
            try:
                adus = []
                with open(csv_path, "r", encoding="utf-8") as csvfile:
                    reader = csv.DictReader(csvfile)
                    for row in reader:
                        adus.append(row)

                adus_by_speech[speech_key] = adus
                logger.info(f"Loaded {len(adus)} ADUs from {csv_file}")

            except Exception as read_error:
                logger.error(f"Failed to read {csv_path}: {str(read_error)}")
                missing_speeches.append(speech_key)

        if not adus_by_speech:
            raise HTTPException(
                status_code=404,
                detail="No valid CSV files found for any speech in the debate format"
            )

        # Generate output filename using Proposition_1st timestamp
        if proposition_1st_timestamp:
            unified_csv_filename = f"unified_{proposition_1st_timestamp}.csv"
        else:
            # Fallback to current timestamp if Proposition_1st not found
            fallback_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
            unified_csv_filename = f"unified_{fallback_timestamp}.csv"
            logger.warning("Proposition_1st timestamp not found, using current timestamp")

        unified_csv_path = os.path.join(ADUS_DIR, unified_csv_filename)

        # Merge ADUs into unified CSV
        total_adus_written = merge_adus_to_unified_csv(
            adus_by_speech=adus_by_speech,
            output_path=unified_csv_path,
            speech_order=speech_order
        )

        elapsed_time = datetime.now().timestamp() - start_time
        print(f"[/merge-aducsvs-to-unifiedcsv] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "unified_csv_path": unified_csv_path,
            "unified_csv_exists": os.path.exists(unified_csv_path),
            "total_adus": total_adus_written,
            "speeches_merged": list(adus_by_speech.keys()),
            "missing_speeches": missing_speeches,
            "debate_format": request.debate_format,
            "speech_order": speech_order,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except HTTPException:
        raise
    except Exception as e:
        elapsed_time = datetime.now().timestamp() - start_time
        print(f"[/merge-aducsvs-to-unifiedcsv] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during CSV merging: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CSV merging failed: {str(e)}")

# ===== Pydantic Models for CSV to MD Conversion =====

class UnifiedCSVToMDRequest(BaseModel):
    """Request for converting unified CSV to Markdown"""
    csv_path: str  # Path to the unified CSV file

    model_config = {
        "json_schema_extra": {
            "example": {
                "csv_path": "/app/transcriptions/adus/unified_20251116_055828_7.csv"
            }
        }
    }

@router.post("/unified-csv-to-md")
async def unified_csv_to_md(request: UnifiedCSVToMDRequest):
    """
    Convert a unified CSV file to Markdown format
    - Input: Path to unified CSV file
    - Output: Markdown file with format:
      ## Speech_Key
      id:1, text content...
      id:2, text content...

    The markdown file will be saved in the same directory as the CSV with .md extension
    """
    start_time = datetime.now().timestamp()
    print(f"[/unified-csv-to-md] 処理開始")

    try:
        # Verify CSV file exists
        if not os.path.exists(request.csv_path):
            raise HTTPException(
                status_code=404,
                detail=f"CSV file not found: {request.csv_path}"
            )

        # Verify it's a CSV file
        if not request.csv_path.endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail="File must be a CSV file"
            )

        # Generate MD file path (same name, different extension)
        md_path = request.csv_path.rsplit(".", 1)[0] + ".md"

        # Convert to Markdown
        total_adus = unified_csv_to_markdown(
            csv_path=request.csv_path,
            output_path=md_path
        )

        elapsed_time = datetime.now().timestamp() - start_time
        print(f"[/unified-csv-to-md] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "csv_path": request.csv_path,
            "md_path": md_path,
            "md_exists": os.path.exists(md_path),
            "total_adus": total_adus,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except HTTPException:
        raise
    except Exception as e:
        elapsed_time = datetime.now().timestamp() - start_time
        print(f"[/unified-csv-to-md] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during CSV to MD conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"CSV to MD conversion failed: {str(e)}")

@router.post("/transcript-to-adu")
async def transcript_to_adu(transcript: TranscriptRequest):
    """
    Convert a single speech transcription to Argument Discourse Units (ADUs)
    - Input: Transcription JSON from Whisper API (verbose_json format)
    - Output: ADU segmentation with roles and timestamps
    """
    start_time = time.time()
    print(f"[/transcript-to-adu] 処理開始")
    try:
        # Extract text and word data from transcript
        transcript_text = transcript.text
        # Round timestamps to 0.1 second precision
        words_data = [
            {
                **word.model_dump(),
                "start": round(word.start, 1),
                "end": round(word.end, 1)
            }
            for word in transcript.words
        ]

        # Group words into sentences to reduce token usage
        sentences_data = group_words_into_sentences(transcript_text, words_data)

        GEMINI_MODEL = "gemini-2.5-flash"

        # Prepare prompt for Gemini with sentence-level data
        response = client_studio_gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=f"""
Please segment the following debate speech into Argument Discourse Units.
Each ADU represents a single argument or discourse unit with a specific role below:

ADU Role Definitions:
- introduction: Opening statement that typically explains the team's stance and framework
- definition: Definitions or models to clarify key terms (e.g., policy, values) that support the main arguments
- independent_rebuttal: A direct counter-argument to the opponent's point, typically presented before moving on to main arguments (one rebuttal = one ADU, regardless of length)
- point_of_main_argument: A cohesive set of claim and supporting reasoning focused on one specific argumentative point (typically 3-5 sentences per ADU)
- point_of_comparison: A cohesive set of comparative analysis explaining why one side's arguments outweigh the opponent's on a specific issue (typically 3-5 sentences per ADU)

Segmentation Guidelines:
1. Each speaker typically has 2-3 main arguments or comparison issues, and each main argument or comparison issue contains 3-5 points
2. Main arguments and comparison issues are equally valid argumentative structures and can coexist in the same speech (e.g., a speaker might present 2 main arguments and 1 comparison issue)
3. One rebuttal is always an considered as one independent ADU regardless of length
4. Group sentences discussing the same specific argumentative point into one ADU

Speech transcription:
{transcript_text}

Sentence-level timestamps (for reference):
{json.dumps(sentences_data, indent=2)}

Return the result as JSON in the following format:
{{
  "adus": [
    {{
      "id": 1,
      "start_sentence_index": 0,
      "end_sentence_index": 2,
      "text": "The actual ADU text",
      "role": "independent_rebuttal/point_of_main_argument/etc"
    }}
  ]
}}

Note:
Focus on semantic units of argumentation. Be precise with sentence indices and timestamps.
"""
        )

        # Save response to log file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        log_filename = f"adu_conversion_{timestamp}.json"
        log_path = os.path.join(LOGS_DIR, log_filename)

        # Extract response text
        response_text = response.text if hasattr(response, 'text') else str(response)

        # Convert response object to dict for JSON serialization
        try:
            raw_response_dict = type(response).to_dict(response) if hasattr(type(response), 'to_dict') else str(response)
        except:
            raw_response_dict = str(response)

        log_data = {
            "timestamp": timestamp,
            "input_transcript": transcript.model_dump(),
            "gemini_response": response_text,
            "raw_response": raw_response_dict,
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
            # Remove markdown code block formatting (```json ... ```)
            cleaned_response = clean_gemini_markdown_response(response_text)
            adu_json = json.loads(cleaned_response)
            adus_list = adu_json.get("adus", [])

            # Write to CSV
            if adus_list:
                fieldnames = ["id", "start_sentence_index", "end_sentence_index", "text", "role", "start_time", "end_time"]

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
        elapsed_time = time.time() - start_time
        print(f"[/transcript-to-adu] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "adu_response": response_text,
            "raw_response": raw_response_dict,
            "log_saved_to": log_path,
            "csv_saved_to": csv_path,
            "adus_dir": ADUS_DIR,
            "files_exist": {
                "log": os.path.exists(log_path),
                "csv": os.path.exists(csv_path) if csv_path else False
            },
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/transcript-to-adu] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during ADU conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"ADU conversion failed: {str(e)}")

@router.post("/group_words_into_sentences")
def group_sentences(request: SentenceGroupRequest):
    """
    Group word-level timestamps into sentence-level data usin group_words_into_sentences().
    Sentences are split by punctuation marks (. ? !)

    Args:
        request: Contains full text with punctuation and word-level timestamp data

    Returns:
        List of sentences with timing information
    """
    text = request.text
    words_data = [word.model_dump() for word in request.words]

    return sentences


@router.post("/rebuttal-graph-from-jsons")
async def create_round_from_jsons(
    rebuttal_file: UploadFile = File(...),
    transcript_file: UploadFile = File(...),
    round_name: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    rebuttal_graph.jsonとbatch_transcription.jsonからラウンド情報を作成するAPI
    - SentencesのみWordデータから再構築する
    - ADUのIDは振り直す（相対関係は保持）
    - すでに同名のラウンドがある場合はエラーになる可能性あり（DB制約による）
    """
    try:
        # 1. ファイル読み込み
        rebuttal_content = await rebuttal_file.read()
        transcript_content = await transcript_file.read()

        rebuttal_data = json.loads(rebuttal_content.decode('utf-8'))
        transcript_data = json.loads(transcript_content.decode('utf-8'))

        # 2. Round作成
        # round_crudを使用することでtry_countの自動インクリメントを行う
        new_round = await round_crud.create_round(db, name=round_name)
        current_round_id = new_round.id
        current_try_count = new_round.try_count
        
        logger.info(f"Created Round: {new_round.name} (id={current_round_id}, try_count={current_try_count})")

        # IDマッピング用辞書 (old_adu_id -> new_adu_id)
        # rebuttal_graph内のIDは整数だが、一意性はSpeech内のみか全体かを確認する必要がある
        # ファイルを見る限り、全体で連番になっているように見える (id: 1, 2, ..., 53)
        old_to_new_adu_id_map = {}

        # 3. Speech, Word, Sentence, ADUの作成
        # rebuttal_graph["speeches"] あるいは transcript_data のキーでループ
        
        # transcript_dataのキー (Proposition_1st, ...) をベースにする
        # transcript_dataのキー (Proposition_1st, ...) をベースにする
        for position, speech_content in transcript_data.items():
            # Speech作成
            duration = speech_content.get("duration", 0.0)
            
            new_speech = Speech(
                round_id=current_round_id,
                position=position,
                duration=duration,
                raw_transcription=speech_content # 全体を保存しておく
            )
            db.add(new_speech)
            await db.commit()
            await db.refresh(new_speech)
            
            speech_id = new_speech.id
            logger.info(f"Created Speech: {position} (id={speech_id})")

            # Words作成
            words_list = speech_content.get("words", [])
            db_words = []
            for idx, w in enumerate(words_list):
                # Wordモデルに合わせてデータを作成
                # { "start": ..., "end": ..., "word": ... }
                db_word = Word(
                    speech_id=speech_id,
                    index=idx,
                    text=w.get("word", ""),
                    start_time=w.get("start", 0.0),
                    end_time=w.get("end", 0.0),
                    confidence=w.get("confidence", 1.0) # ない場合に備えて
                )
                db_words.append(db_word)
            
            if db_words:
                db.add_all(db_words)
                await db.commit() # wordのIDは後で使わないのでまとめてコミット

            # Sentences再構築
            # group_words_into_sentencesを使用
            full_text = speech_content.get("text", "")
            # words_data format need to be dicts, which they are
            sentences_struct = group_words_into_sentences(full_text, words_list)


            db_sentences = []
            for s_data in sentences_struct:
                # { "id": 0, "text": "...", "start_time": ..., "end_time": ..., "start_word_index": ..., "end_word_index": ... }
                db_sent = Sentence(
                    speech_id=speech_id,
                    index=s_data["id"],
                    text=s_data["text"],
                    start_word_index=s_data["start_word_index"],
                    end_word_index=s_data["end_word_index"]
                )
                db_sentences.append(db_sent)
            
            if db_sentences:
                db.add_all(db_sentences)
                await db.commit() 

            # ADU作成
            # rebuttal_graphから該当スピーチのADUを取得
            if "speeches" in rebuttal_data and position in rebuttal_data["speeches"]:
                adus_list = rebuttal_data["speeches"][position]
                
                # ADUの開始・終了文インデックスを決定するために、一度全ADUの開始時間をリスト化してソートする
                sorted_adus = sorted(adus_list, key=lambda x: x.get("start", 0.0))
                
                for i, adu_item in enumerate(sorted_adus):

                    adu_start_time = adu_item.get("start", 0.0)
                    
                    # 開始文を見つける
                    # sentence.start_time <= adu_start_time となる最後の文、あるいは
                    # 最も近い文を探す。
                    # 通常、ADU start timeは文のstart timeとほぼ一致するはず
                    
                    start_sent_idx = 0
                    min_diff = float("inf")
                    
                    # 線形探索で十分 (文数は多くて100程度)
                    # sentences_struct is list of dicts
                    for s_data in sentences_struct:
                        diff = abs(s_data["start_time"] - adu_start_time)
                        if diff < min_diff:
                            min_diff = diff
                            start_sent_idx = s_data["id"]
                    
                    # 終了文を見つける
                    # 次のADUの開始文の前まで。最後のADUなら最後の文まで。
                    if i < len(sorted_adus) - 1:
                        next_adu_start = sorted_adus[i+1].get("start", 0.0)
                        
                        # 次のADUの開始文を探す
                        next_start_sent_idx = 0
                        min_diff_next = float("inf")
                        for s_data in sentences_struct:
                            diff = abs(s_data["start_time"] - next_adu_start)
                            if diff < min_diff_next:
                                min_diff_next = diff
                                next_start_sent_idx = s_data["id"]
                        
                        # その1つ前までがこのADUの範囲
                        end_sent_idx = max(start_sent_idx, next_start_sent_idx - 1)
                    else:
                        # 最後のADU
                        end_sent_idx = sentences_struct[-1]["id"] if sentences_struct else 0

                    
                    # ADU作成
                    new_adu = Adu(
                        speech_id=speech_id,
                        start_sentence_index=start_sent_idx,
                        end_sentence_index=end_sent_idx,
                        text=adu_item.get("text", ""),
                        role=adu_item.get("type", "unknown"),
                    )
                    db.add(new_adu)
                    await db.commit()
                    await db.refresh(new_adu)
                    
                    # IDマッピング保存
                    old_id = adu_item.get("id")
                    if old_id is not None:
                        old_to_new_adu_id_map[old_id] = new_adu.id

        # 4. Rebuttals作成
        rebuttals_list = rebuttal_data.get("rebuttals", [])
        # [[src_id, tgt_id], ...] の形式であることをファイルから確認済み
        
        db_rebuttals = []
        for pair in rebuttals_list:
            if len(pair) >= 2:
                old_src = pair[0]
                old_tgt = pair[1]
                
                new_src = old_to_new_adu_id_map.get(old_src)
                new_tgt = old_to_new_adu_id_map.get(old_tgt)
                
                if new_src and new_tgt:
                    db_reb = Rebuttal(
                        src_adu_id=new_src,
                        tgt_adu_id=new_tgt
                    )
                    db_rebuttals.append(db_reb)
                else:
                    logger.warning(f"Skipping rebuttal pair {old_src}->{old_tgt}: ID not found in mapping")

        if db_rebuttals:
            db.add_all(db_rebuttals)
            await db.commit()

        return {
            "status": "success",
            "round_id": current_round_id,
            "round_name": round_name,
            "try_count": current_try_count,
            "speeches_count": len(transcript_data),
            "rebuttals_count": len(db_rebuttals)
        }

    except Exception as e:
        logger.error(f"Error in create_round_from_jsons: {str(e)}")
        # 必要に応じてロールバックなど検討
        raise HTTPException(status_code=500, detail=str(e))


# ===== Gemini Text Generation Endpoints =====

class GeminiTextRequest(BaseModel):
    """Request for Gemini text generation"""
    text: str
    model: str = "gemini-2.5-flash"

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "How does AI work?",
                "model": "gemini-2.5-flash"
            }
        }
    }

@router.post("/gemini-studio-generate")
async def gemini_studio_generate(request: GeminiTextRequest):
    """
    Google AI Studio Gemini APIでテキスト生成
    - Input: text (prompt), model (optional, default: gemini-2.5-flash)
    - Output: 生のresponseとresponse.text
    """
    start_time = time.time()
    print(f"[/gemini-studio-generate] 処理開始 - Provider: Google AI Studio, Model: {request.model}")

    try:
        response = client_studio_gemini.models.generate_content(
            model=request.model,
            contents=request.text,
        )

        # Extract response text
        response_text = response.text if hasattr(response, 'text') else str(response)

        # Convert response to dict for raw response
        try:
            raw_response_dict = type(response).to_dict(response) if hasattr(type(response), 'to_dict') else str(response)
        except:
            raw_response_dict = str(response)

        elapsed_time = time.time() - start_time
        print(f"[/gemini-studio-generate] 処理完了 - Provider: Google AI Studio, 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "model": request.model,
            "provider": "google_ai_studio",
            "response_text": response_text,
            "raw_response": raw_response_dict,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/gemini-studio-generate] エラーで終了 - Provider: Google AI Studio, 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during Google AI Studio Gemini generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Google AI Studio Gemini generation failed: {str(e)}")


@router.post("/gemini-vertex-generate")
async def gemini_vertex_generate(request: GeminiTextRequest):
    """
    Vertex AI Gemini APIでテキスト生成
    - Input: text (prompt), model (optional, default: gemini-2.5-flash)
    - Output: 生のresponseとresponse.text
    """
    start_time = time.time()
    print(f"[/gemini-vertex-generate] 処理開始 - Provider: Vertex AI, Model: {request.model}")

    try:
        response = client_vertex_gemini.models.generate_content(
            model=request.model,
            contents=request.text,
        )

        # Extract response text
        response_text = response.text if hasattr(response, 'text') else str(response)

        # Convert response to dict for raw response
        try:
            raw_response_dict = type(response).to_dict(response) if hasattr(type(response), 'to_dict') else str(response)
        except:
            raw_response_dict = str(response)

        elapsed_time = time.time() - start_time
        print(f"[/gemini-vertex-generate] 処理完了 - Provider: Vertex AI, 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "model": request.model,
            "provider": "vertex_ai",
            "response_text": response_text,
            "raw_response": raw_response_dict,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/gemini-vertex-generate] エラーで終了 - Provider: Vertex AI, 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during Vertex AI Gemini generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Vertex AI Gemini generation failed: {str(e)}")


@router.post("/groq-transcribe")
async def groq_transcribe(file: UploadFile = File(...)):
    """
    Groqを使って音声ファイルを文字起こしするAPI
    - Input: 音声ファイル (m4a, mp3, wav, etc.)
    - Output: Whisper transcription with word-level timestamps (verbose_json format)
    - Model: whisper-large-v3
    """
    start_time = time.time()
    print(f"[/groq-transcribe] 処理開始 - ファイル名: {file.filename}")
    
    temp_file_path = None
    try:
        # 一時ファイルとして保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Groq Whisper APIで文字起こし
            with open(temp_file_path, "rb") as audio_file:
                transcription = groq_client.audio.transcriptions.create(
                    file=(file.filename, audio_file.read()),
                    model="whisper-large-v3",
                    temperature=0,
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                )
            
            logger.info(f"Groq transcription completed for {file.filename}")
        
        finally:
            # 一時ファイルを削除
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        
        # レスポンスをdictに変換
        response_dict = transcription.model_dump() if hasattr(transcription, 'model_dump') else dict(transcription)
        
        # 結果をsub-transcriptsディレクトリに保存
        os.makedirs(SUB_TRANSCRIPTS_DIR, exist_ok=True)
        audio_filename_base = os.path.splitext(file.filename)[0]
        jst = timezone(timedelta(hours=9))
        timestamp = datetime.now(jst).strftime("%Y%m%d_%H%M%S_%f")[:-5]
        json_filename = f"{audio_filename_base}_groq_{timestamp}.json"
        json_path = os.path.join(SUB_TRANSCRIPTS_DIR, json_filename)
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(response_dict, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Groq transcription saved to: {json_path}")
        
        elapsed_time = time.time() - start_time
        print(f"[/groq-transcribe] 処理完了 - 処理時間: {elapsed_time:.2f}秒")
        
        return {
            "status": "success",
            "filename": file.filename,
            "transcription": response_dict,
            "saved_to": json_path,
            "file_exists": os.path.exists(json_path),
            "processing_time_seconds": round(elapsed_time, 2)
        }
    
    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/groq-transcribe] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during Groq transcription for {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq transcription failed: {str(e)}")

@router.delete("/reset-progress/{round_id}")
async def reset_progress(
    round_id: int,
    start_step: str = "1-a",
    db: AsyncSession = Depends(get_db)
):
    """
    Reset processing progress for a given round starting from a specific step.
    Deletes all data associated with the start_step and all subsequent steps.
    
    Steps:
    - 1-a: Audio Download (Deletes local audio file + all below)
    - 1-b: Transcription (Clears Round.raw_transcription + all below)
    - 1-c: Word Extraction (Deletes Words + all below)
    - 1-d: Sentence Grouping (Deletes Sentences + all below)
    - 2: Speaker Diarization (Deletes Speeches + all below)
    - 3: ADU Segmentation (Deletes ADUs + all below)
    - 4: Rebuttal Detection (Deletes Rebuttals)
    """
    
    # Normalize start_step
    step_map = {
        "1-a": 0,
        "1-b": 1,
        "1-c": 2,
        "1-d": 3,
        "2": 4,
        "3": 5,
        "4": 6
    }
    
    target_level = step_map.get(start_step.lower())
    if target_level is None:
        raise HTTPException(status_code=400, detail=f"Invalid start_step. Must be one of: {list(step_map.keys())}")
        
    try:
        # Get Round to find video_id for Step 1-a
        round_obj = await round_crud.get_round_by_id(db, round_id)
        if not round_obj:
            raise HTTPException(status_code=404, detail=f"Round {round_id} not found")
        
        # Determine cascading deletions
        # Order is important: delete children first if not using CASCADE logic in Python, 
        # but SQLAlchemy usually handles foreign keys if ON DELETE CASCADE is set in DB.
        # However, to be thorough and explicit:
        
        # Step 4: Rebuttal Detection (Deletes Rebuttals)
        if target_level <= 6:
            stmt = delete(Rebuttal).where(
                (Rebuttal.src_adu_id.in_(
                    select(Adu.id).join(Speech).where(Speech.round_id == round_id)
                )) | 
                (Rebuttal.tgt_adu_id.in_(
                    select(Adu.id).join(Speech).where(Speech.round_id == round_id)
                ))
            )
            await db.execute(stmt)
            logger.info(f"Reset Step 4: Deleted Rebuttals for Round {round_id}")

        # Step 3: ADU Segmentation (Deletes ADUs)
        if target_level <= 5:
            stmt = delete(Adu).where(Adu.speech_id.in_(
                select(Speech.id).where(Speech.round_id == round_id)
            ))
            await db.execute(stmt)
            logger.info(f"Reset Step 3: Deleted ADUs for Round {round_id}")
            
        # Step 2: Speaker Diarization (Deletes Speeches)
        if target_level <= 4:
            stmt = delete(Speech).where(Speech.round_id == round_id)
            await db.execute(stmt)
            logger.info(f"Reset Step 2: Deleted Speeches for Round {round_id}")
            
        # Step 1-d: Sentence Grouping (Deletes Sentences)
        if target_level <= 3:
            stmt = delete(Sentence).where(Sentence.round_id == round_id)
            await db.execute(stmt)
            logger.info(f"Reset Step 1-d: Deleted Sentences for Round {round_id}")
            
        # Step 1-c: Word Extraction (Deletes Words)
        if target_level <= 2:
            stmt = delete(Word).where(Word.round_id == round_id)
            await db.execute(stmt)
            logger.info(f"Reset Step 1-c: Deleted Words for Round {round_id}")
            
        # Step 1-b: Transcription (Clears Round.raw_transcription)
        if target_level <= 1:
            round_obj.raw_transcription = None
            db.add(round_obj) # Mark for update
            
            # Reset remote background transcription status
            await delete_background_transcription_batch_remote(round_ids=[round_id])
            logger.info(f"Reset Step 1-b: Deleted remote background job for Round {round_id}")

            logger.info(f"Reset Step 1-b: Cleared raw_transcription for Round {round_id}")
            
        # Step 1-a: Audio Download (Deletes local audio file)
        if target_level <= 0:
            if round_obj.video_id:
                video_id = round_obj.video_id
                
                # 1. Delete local directory: AUDIO_DIR/video_id
                target_dir = os.path.join(AUDIO_DIR, video_id)
                if os.path.exists(target_dir):
                    shutil.rmtree(target_dir)
                    logger.info(f"Reset Step 1-a: Deleted local audio directory {target_dir}")
                else:
                    logger.info(f"Reset Step 1-a: Local audio directory {target_dir} not found")
                
                # 2. Delete cache from external GPU server
                await delete_audio_cache_remote(video_id)
                logger.info(f"Reset Step 1-a: Deleted external audio cache for {video_id}")

                # 3. Clear video_id from Round -> REMOVED
                # round_obj.video_id = None
                # db.add(round_obj)
                    
            else:
                logger.warning(f"Reset Step 1-a: Round {round_id} has no video_id")

        await db.commit()
        return {"status": "success", "message": f"Reset progress from step {start_step} for round {round_id}"}
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error resetting progress: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reset progress: {str(e)}")


# ===== Detailed Round Data Endpoint (Debug/Sub API) =====

class WordResponse(BaseModel):
    id: int
    text: str
    start_time: float
    end_time: float
    confidence: Optional[float] = None
    
    class Config:
        from_attributes = True

class SentenceDetailResponse(BaseModel):
    id: int
    text: str
    start_word_id: Optional[int] = None
    end_word_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class RebuttalDetailResponse(BaseModel):
    id: int
    src_adu_id: int
    tgt_adu_id: int
    
    class Config:
        from_attributes = True

class AduDetailResponse(BaseModel):
    id: int
    text: str
    role: str
    rebuttals_as_source: List[RebuttalDetailResponse] = []
    
    class Config:
        from_attributes = True

class SpeechDetailResponse(BaseModel):
    id: int
    position: str
    adus: List[AduDetailResponse] = []
    
    class Config:
        from_attributes = True

class RoundDetailAllResponse(RoundResponse):
    words: List[WordResponse] = []
    sentences: List[SentenceDetailResponse] = []
    speeches: List[SpeechDetailResponse] = []


@router.get("/rounds/detail/{round_id}", response_model=RoundDetailAllResponse)
async def get_round_detail(round_id: int, db: AsyncSession = Depends(get_db)):
    """
    ラウンドの詳細情報（全関連データ）を取得
    Words, Sentences, Speeches, ADUs, Rebuttals をすべて含む。
    
    DEBUG用途のため、Words と Sentences は最大100件に制限されています。
    """
    # 1. Fetch Round with Speeches hierarchy
    stmt = (
        select(Round)
        .options(
            selectinload(Round.speeches).selectinload(Speech.adus).selectinload(Adu.rebuttals_as_source)
        )
        .where(Round.id == round_id)
    )
    result = await db.execute(stmt)
    r = result.scalar_one_or_none()
    
    if not r:
        raise HTTPException(status_code=404, detail="Round not found")

    # 3. Fetch Words (Limit 100)
    words_stmt = select(Word).where(Word.round_id == round_id).order_by(Word.id).limit(100)
    words_result = await db.execute(words_stmt)
    words = words_result.scalars().all()
    
    # 4. Fetch Sentences (Limit 100)
    sentences_stmt = select(Sentence).where(Sentence.round_id == round_id).order_by(Sentence.id).limit(100)
    sentences_result = await db.execute(sentences_stmt)
    sentences = sentences_result.scalars().all()

    # Construct response
    # Map speeches
    speeches_resp = []
    for s in r.speeches:
        adus_resp = []
        for a in s.adus:
            # Rebuttals
            rebuttals_resp = [
                RebuttalDetailResponse(
                    id=reb.id, src_adu_id=reb.src_adu_id, tgt_adu_id=reb.tgt_adu_id
                ) for reb in a.rebuttals_as_source
            ]
            
            # ADUs
            adus_resp.append(AduDetailResponse(
                id=a.id, text=a.text, role=a.role, rebuttals_as_source=rebuttals_resp
            ))
        
        # Speeches
        speeches_resp.append(SpeechDetailResponse(
            id=s.id, position=s.position, adus=adus_resp
        ))
        
    return RoundDetailAllResponse(
        id=r.id,
        name=r.name,
        try_count=r.try_count,
        type=r.type,
        note=r.note,
        style=r.style,
        motion=r.motion,
        video_id=r.video_id,
        created_at=r.created_at.isoformat(),
        words=words,
        sentences=sentences,
        speeches=speeches_resp
    )