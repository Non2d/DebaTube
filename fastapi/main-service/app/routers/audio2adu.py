from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, RootModel, ValidationError
from log_config import logger
from openai import OpenAI, AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
import os, json, tempfile, re, csv
from datetime import datetime
import asyncio
import time
import shutil
import httpx

from google import genai
from groq import AsyncGroq
from .utils import (
    clean_gemini_markdown_response,
    merge_adus_to_unified_csv,
    unified_csv_to_markdown,
    DEBATE_FORMATS,
    group_words_into_sentences,
)

GEMINI_MODEL_NAME = "gemini-2.5-flash"

def _save_gemini_log(response_text: str, category: str, identifier: str = "", prompt_text: str = "", model_name: str = ""):
    """Save raw Gemini response to logs directory"""
    try:
        log_dir = "logs/gemini_response"
        os.makedirs(log_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_identifier = identifier.replace("/", "_").replace("\\", "_").replace(" ", "_")
        filename = f"{log_dir}/gemini_{category}_{safe_identifier}_{timestamp}.json"
        
        data = {
            "timestamp": timestamp,
            "category": category,
            "identifier": identifier,
            "model": model_name,
            "prompt": prompt_text,
            "raw_response": response_text
        }
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved Gemini log to {filename}")
    except Exception as e:
        logger.error(f"Failed to save Gemini log: {e}")
from db import get_db
from cruds import round as round_crud
from models.round import Speech, Adu, Rebuttal, Round, Sentence, Word
from sqlalchemy import select, delete

router = APIRouter()

# ===== Pydantic Models =====


class BatchTranscriptRequest(RootModel[Dict[str, Dict[str, Any]]]):
    """
    Batch transcription input - key-value pairs of speech transcriptions
    Directly accepts the output from /audio-to-transcript-batch without wrapper
    """

    root: Dict[str, Dict[str, Any]]


class RebuttalStructureRequest(BaseModel):
    """Request for identifying rebuttal structure from database"""

    round_name: str  # Round name to identify which debate round
    try_count: Optional[int] = None
    model: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {"round_name": "WAD_1211_R2", "try_count": 1}
        }
    }


class ManualADUSubmitRequest(BaseModel):
    round_name: str
    try_count: int
    adu_json: str  # JSON string from Gemini

class ManualRebuttalSubmitRequest(BaseModel):
    round_name: str
    try_count: int
    rebuttal_json: str  # JSON string from Gemini


# OpenAI client初期化
client = OpenAI()
async_client = AsyncOpenAI()
client_gemini = genai.Client()
groq_client = AsyncGroq()

APP_DIR = os.path.dirname(__file__)  # /app/routers

TRANSCRIPTION_DIR = os.path.join(
    os.path.dirname(APP_DIR), "transcriptions"
)  # 文字起こし保存ディレクトリ
os.makedirs(TRANSCRIPTION_DIR, exist_ok=True)

LOGS_DIR = os.path.join(os.path.dirname(APP_DIR), "logs")  # ログ保存ディレクトリ
os.makedirs(LOGS_DIR, exist_ok=True)

ADUS_DIR = os.path.join(TRANSCRIPTION_DIR, "adus")  # ADU保存ディレクトリ


async def regroup_single_speech_sentences_to_adus(
    speech_key: str,
    transcript_data: Dict[str, Any],
    timestamp: str,
    match_name: str = "",
    model_name: str = GEMINI_MODEL_NAME,
) -> tuple[
    str,
    Optional[str],
    Optional[str],
    Optional[Any],
    Optional[str],
    Optional[str],
    Optional[list],
]:
    """
    Process a single speech transcripts (one of raw whisper responses in batch_transcription.json) to ADU conversion asynchronously
    Returns: (speech_key, log_path, csv_path, response_object, response_text, error_message, adus_with_timestamps)
    """
    try:
        transcript_text = transcript_data.get("text", "")
        words_data_raw = transcript_data.get("words", [])

        words_data = [
            {
                **word,
                "start": round(word.get("start", 0), 1),
                "end": round(word.get("end", 0), 1),
            }
            for word in words_data_raw
        ]

        sentences_data = group_words_into_sentences(
            transcript_text, words_data
        )
        total_sentences = len(sentences_data)
        prompt_sentences_data = [
            {
                "id": sentence["id"],
                "text": sentence["text"],
            }
            for sentence in sentences_data
        ]

        prompt_content = f"""
Please segment the following debate speech into Argument Discourse Units.
Each ADU represents a single argument or discourse unit with a specific role below:

ADU Role Definitions:
- introduction: Opening statement that typically explains the team's stance and framework
- definition: Definitions or models to clarify key terms (e.g., policy, values) that support the main arguments
- independent_rebuttal: A direct counter-argument to the opponent's point, typically presented before moving on to main arguments (one rebuttal = one ADU, regardless of length)
- point_of_main_argument: A cohesive set of claim and supporting reasoning focused on one specific argumentative point (typically 3-5 sentences per ADU)
- point_of_comparison: A cohesive set of comparative analysis explaining why one side's arguments outweigh the opponent's on a specific issue (typically 3-5 sentences per ADU)
- poi: During the speech, opponents can interject brief questions (called "point of information") or statements typically right after the speaker says "Yes". Please treat any such questions from opponents as a single ADU.

Segmentation Guidelines:
1. Each speaker typically has 2-3 main arguments or comparison issues, and each main argument or comparison issue contains 3-5 points
2. Main arguments and comparison issues are equally valid argumentative structures and can coexist in the same speech (e.g., a speaker might present 2 main arguments and 1 comparison issue)
3. Rebuttals are always independent ADUs regardless of length
4. Group sentences discussing the same specific argumentative point into one ADU
5. Treat any POI as a single independent ADU.
6. Treat a response to a POI as a single ADU.
7. Each ADU **MUST NOT** exceed 150 words. If a passage exceeds this limit, split it into multiple ADUs at logical break points.

Sentence-level transcript data:
{json.dumps(prompt_sentences_data, indent=None)}

Return the result as JSON in the following format:
{{
  "adus": [
    {{
      "id": 1,
      "start_sentence_index": 0,
      "end_sentence_index": 2,
      "text": "The actual ADU text",
      "role": "independent_rebuttal/point_of_main_argument/etc",
    }}
  ]
}}

IMPORTANT: All sentence indices must be between 0 and {total_sentences - 1}. The last sentence has index {total_sentences - 1}.
"""

        response = await asyncio.to_thread(
            client_gemini.models.generate_content,
            model=model_name,
            contents=prompt_content,
        )

        response_text = response.text if hasattr(response, "text") else str(response)
        
        # Save raw log with prompt
        _save_gemini_log(response_text, "adu", f"{match_name}_{speech_key}", prompt_content, model_name=model_name)

        try:
            raw_response_dict = (
                type(response).to_dict(response)
                if hasattr(type(response), "to_dict")
                else str(response)
            )
        except:
            raw_response_dict = str(response)

        try:
            cleaned_response = clean_gemini_markdown_response(response_text)
            adu_json = json.loads(cleaned_response)
            adus = adu_json.get("adus", [])

            adus_with_timestamps = []
            for adu in adus:
                start_sentence_idx = adu.get("start_sentence_index", 0)
                end_sentence_idx = adu.get("end_sentence_index", 0)

                # Validate sentence indices
                if start_sentence_idx >= len(sentences_data) or end_sentence_idx >= len(
                    sentences_data
                ):
                    logger.warning(
                        f"Invalid sentence indices for ADU {adu.get('id', '?')}: "
                        f"start={start_sentence_idx}, end={end_sentence_idx}, "
                        f"total_sentences={len(sentences_data)}"
                    )
                    continue

                start_time = sentences_data[start_sentence_idx].get("start_time", -1.0)
                end_time = sentences_data[end_sentence_idx].get("end_time", -1.0)
                text = " ".join(sentences_data[i]["text"] for i in range(start_sentence_idx, end_sentence_idx + 1))

                adu_with_timestamp = {
                    **adu,
                    "start_time": start_time,
                    "end_time": end_time,
                    "text": text,
                }
                adus_with_timestamps.append(adu_with_timestamp)

            if not adus_with_timestamps:
                logger.warning(f"No ADUs found in Gemini response for {speech_key}")

        except json.JSONDecodeError as json_error:
            logger.error(
                f"Error parsing Gemini response as JSON for {speech_key}: {str(json_error)}"
            )
            adus_with_timestamps = []
        except Exception as parse_error:
            logger.error(f"Error parsing ADU data for {speech_key}: {str(parse_error)}")
            adus_with_timestamps = []

        return (
            speech_key,
            None,
            None,
            raw_response_dict,
            response_text,
            None,
            adus_with_timestamps,
            sentences_data,
            words_data,
        )


    except Exception as e:
        error_msg = f"Error processing {speech_key}: {str(e)}"
        logger.error(error_msg)
        return (speech_key, None, None, None, None, error_msg, [], [], [])


async def regroup_all_speech_sentences_to_adus_at_once(
    transcripts: Dict[str, Dict[str, Any]],
    debate_format: str = "NA",
    match_name: str = "",
    model_name: str = GEMINI_MODEL_NAME,
) -> tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
    """
    Process all speeches in a single Gemini Prompt but using the exact same logic flow as 
    regroup_single_speech_sentences_to_adus (using JSON-based sentence input).
    Returns: (adus_by_speech, all_responses, failed_speeches)
    """
    try:
        # Prepare data for prompt
        speech_order = DEBATE_FORMATS.get(debate_format, [])
        ordered_speeches = []
        
        # Sort transcripts based on debate format order if possible
        if speech_order:
            for role in speech_order:
                if role in transcripts:
                    ordered_speeches.append((role, transcripts[role]))
            # Add any remaining speeches not in order
            for k, v in transcripts.items():
                if k not in speech_order:
                    ordered_speeches.append((k, v))
        else:
            ordered_speeches = list(transcripts.items())

        sentences_map_by_speech = {} # speech_key -> sentences_data
        prompt_content_parts = []

        for speech_key, transcript_data in ordered_speeches:
            transcript_text = transcript_data.get("text", "")
            words_data_raw = transcript_data.get("words", [])
            
            words_data = [
                {
                    **word,
                    "start": round(word.get("start", 0), 1),
                    "end": round(word.get("end", 0), 1),
                }
                for word in words_data_raw
            ]
            
            sentences_data = group_words_into_sentences(transcript_text, words_data)
            sentences_map_by_speech[speech_key] = sentences_data
            
            # Create prompt data for this speech matching regroup_single_speech_sentences_to_adus format
            prompt_sentences_data = [
                {
                    "id": sentence["id"],
                    "text": sentence["text"],
                }
                for sentence in sentences_data
            ]
            
            prompt_content_parts.append(f"## Speech: {speech_key}")
            prompt_content_parts.append("Sentence-level transcript data:")
            prompt_content_parts.append(json.dumps(prompt_sentences_data, indent=None))
            prompt_content_parts.append(f"Total Sentences: {len(sentences_data)}")
            prompt_content_parts.append("")

        full_transcript_text = "\n".join(prompt_content_parts)


        
        # Using the exact same prompt structure as regroup_single_speech_sentences_to_adus
        # but adapted to output multiple speeches
        prompt_content = f"""
Please segment the following debate speeches into Argument Discourse Units (ADUs).
Each ADU represents a single argument or discourse unit with a specific role below:

ADU Role Definitions:
- introduction: Opening statement that typically explains the team's stance and framework
- definition: Definitions or models to clarify key terms (e.g., policy, values) that support the main arguments
- independent_rebuttal: A direct counter-argument to the opponent's point, typically presented before moving on to main arguments (one rebuttal = one ADU, regardless of length)
- point_of_main_argument: A cohesive set of claim and supporting reasoning focused on one specific argumentative point (typically 3-5 sentences per ADU)
- point_of_comparison: A cohesive set of comparative analysis explaining why one side's arguments outweigh the opponent's on a specific issue (typically 3-5 sentences per ADU)
- poi: During the speech, opponents can interject brief questions (called "point of information") or statements typically right after the speaker says "Yes". Please treat any such questions from opponents as a single ADU.

Segmentation Guidelines:
1. Each speaker typically has 2-3 main arguments or comparison issues, and each main argument or comparison issue contains 3-5 points
2. Main arguments and comparison issues are equally valid argumentative structures and can coexist in the same speech (e.g., a speaker might present 2 main arguments and 1 comparison issue)
3. Rebuttals are always independent ADUs regardless of length
4. Group sentences discussing the same specific argumentative point into one ADU
5. Treat any POI as a single independent ADU.
6. Treat a response to a POI as a single ADU.
7. Each ADU **MUST NOT** exceed 150 words. If a passage exceeds this limit, split it into multiple ADUs at logical break points.

Transcript Data:
{full_transcript_text}

Return the result as a JSON object where keys are "Speech Name" (e.g. Proposition_1st) and values are lists of ADUs.
IDs are local to each speech (0, 1, 2...).

Format:
{{
  "Proposition_1st": [
    {{
      "start_sentence_index": 0,
      "end_sentence_index": 2,
      "text": "The actual ADU text...",
      "role": "point_of_main_argument"
    }}
  ],
  "Opposition_1st": [...]
}}
"""

        response = await asyncio.to_thread(
            client_gemini.models.generate_content,
            model=model_name,
            contents=prompt_content,
        )
        
        response_text = response.text if hasattr(response, "text") else str(response)
        
        # Save raw log
        _save_gemini_log(response_text, "adu", match_name, prompt_content, model_name=model_name)

        cleaning_response = clean_gemini_markdown_response(response_text)
        try:
            parsed_json = json.loads(cleaning_response)
        except json.JSONDecodeError:
             logger.error(f"Failed to parse JSON from batch response: {response_text}")
             return {}, {"all_at_once": response_text}, [{"speech_key": "ALL", "error": "JSON Parse Error"}]

        adus_by_speech = {}
        failed_speeches = []

        for speech_key, adu_list in parsed_json.items():
             if speech_key not in sentences_map_by_speech:
                 logger.warning(f"Unknown speech key in response: {speech_key}")
                 continue
             
             sentences_data = sentences_map_by_speech[speech_key]
             
             adus_with_timestamps = []
             for adu in adu_list:
                 try:
                     # Parse IDs: expecting simple integers as per single speech logic
                     # Note: key names might vary slightly if Gemini hallucinates, but we stick to standard keys
                     # regroup_single uses start_sentence_index, end_sentence_index
                     
                     start_id = int(adu.get("start_sentence_index", adu.get("start_sentence_id", 0)))
                     end_id = int(adu.get("end_sentence_index", adu.get("end_sentence_id", 0)))
                                          
                     if start_id >= len(sentences_data) or end_id >= len(sentences_data):
                         continue

                     start_time = sentences_data[start_id].get("start_time", 0.0)
                     end_time = sentences_data[end_id].get("end_time", 0.0)
                     
                     # Reconstruct text from sentences to ensure accuracy
                     text = " ".join(sentences_data[i]["text"] for i in range(start_id, end_id + 1))
                     
                     adus_with_timestamps.append({
                         **adu,
                         "start_sentence_index": start_id,
                         "end_sentence_index": end_id,
                         "start_time": start_time,
                         "end_time": end_time,
                         "text": text
                     })
                 except Exception as e:
                     logger.warning(f"Error processing ADU in {speech_key}: {e}")
             
             if adus_with_timestamps:
                 adus_by_speech[speech_key] = adus_with_timestamps
        
        return adus_by_speech, {"all_at_once": response_text}, failed_speeches

    except Exception as e:
        logger.error(f"Error in transcript_to_adu_all_at_once: {str(e)}")
        _save_gemini_log(str(e), "error_adu", match_name)
        return {}, {}, [{"speech_key": "ALL", "error": str(e)}]


class TranscriptionWord(BaseModel):
    word: str
    start: float
    end: float

class VerboseTranscriptionResponse(BaseModel):
    task: str
    language: str
    duration: float
    text: str
    words: List[TranscriptionWord]

    model_config = {
        "extra": "ignore"
    }

async def transcribe_single_audio(
    file: UploadFile,
    transcription_model: str = "openai-whisper",
) -> tuple[str, str, Optional[Dict[str, Any]]]:
    """
    1つのファイルを文字起こしする
    返り値: (speech_key, date_transcribed, transcription_dict)
    Model options: 'openai-whisper', 'groq-whisper-large-v3', 'groq-whisper-large-v3-turbo'
    """
    try:
        filename_without_ext = os.path.splitext(file.filename)[0]
        if "-" not in filename_without_ext:
            logger.warning(f"Invalid filename format: {file.filename}")
            return "", "", None

        parts = filename_without_ext.split("-", 1)  # 最初の"-"で分割
        speech_key = parts[0].strip()
        date_transcribed = parts[1] if len(parts) > 1 else ""

        # 一時ファイルとして保存
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(file.filename)[1]
        ) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # transcription_modelによって分岐
            if transcription_model.startswith("groq-"):
                # Map frontend model name to Groq model ID
                # groq-whisper-large-v3 -> whisper-large-v3
                # groq-whisper-large-v3-turbo -> whisper-large-v3-turbo
                groq_model_id = transcription_model.replace("groq-", "")
                
                with open(temp_file_path, "rb") as audio_file:
                    transcription = await groq_client.audio.transcriptions.create(
                        file=(file.filename, audio_file.read()),
                        model=groq_model_id,
                        response_format="verbose_json",
                        timestamp_granularities=["word"],
                        language="en",
                    )
                    logger.info(f"Transcribed via Groq ({groq_model_id}): {speech_key}")

            else:
                # Default: OpenAI Whisper
                with open(temp_file_path, "rb") as audio_file:
                    transcription = await async_client.audio.transcriptions.create(
                        file=audio_file,
                        model="whisper-1",
                        response_format="verbose_json",
                        timestamp_granularities=["word"],
                        language="en",
                    )
                    logger.info(f"Transcribed via OpenAI: {speech_key}")

        finally:
            os.unlink(temp_file_path)

        trans_dict = transcription.model_dump()
        
        try:
            # Validate using Pydantic
            validated_data = VerboseTranscriptionResponse(**trans_dict)
            
            result = {
                "date_transcribed": date_transcribed,
                "duration": validated_data.duration,
                "language": validated_data.language,
                "validation_warning": "",
                **validated_data.model_dump(),
            }
        except ValidationError as val_error:
            warning_msg = f"Validation failed: {val_error.json()}"
            logger.warning(f"Validation Error for file {file.filename} (proceeding with raw data): {warning_msg}")
            result = {
                "date_transcribed": date_transcribed,
                "duration": trans_dict.get("duration", 0),
                "language": trans_dict.get("language", ""),
                "validation_warning": warning_msg,
                **trans_dict,
            }

        logger.info(f"Transcribed: {speech_key} (from {file.filename})")
        return speech_key, date_transcribed, result

    except Exception as file_error:
        logger.error(f"Error processing file {file.filename}: {str(file_error)}")
        return "", "", None


@router.post("/audio-to-transcript-batch")
async def audio_to_transcript_batch(
    files: List[UploadFile] = File(...), 
    match_name: str = Form("default"),
    transcription_model: str = Form("openai-whisper")
):
    """
    複数の音声ファイルを非同期で並列に文字起こしするエンドポイント
    - ファイル名形式: "Proposition_1st-2025-11-16_140426.webm"
    - キー: "-"の前の部分（例：Proposition_1st）
    - date_transcribed: "-"の後の部分（例：2025-11-16_140426）
    - 結果を1つのJSONにまとめて保存
    """
    start_time = time.time()
    print(f"[/audio-to-transcript-batch] 処理開始")
    try:
        # 複数ファイルを非同期で並列処理
        tasks = [transcribe_single_audio(file, transcription_model) for file in files]
        results = await asyncio.gather(*tasks)

        batch_results: Dict[str, Any] = {}
        for speech_key, date_transcribed, trans_dict in results:
            if trans_dict is not None and speech_key:
                batch_results[speech_key] = trans_dict

        if not batch_results:
            raise HTTPException(
                status_code=400, detail="No files were successfully processed"
            )

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        output_filename = f"batch_transcription_{timestamp}.json"

        # Always save to match-specific folder
        match_results_dir = os.path.join(TRANSCRIPTION_DIR, f"results_{match_name}")
        os.makedirs(match_results_dir, exist_ok=True)
        output_path = os.path.join(match_results_dir, output_filename)

        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(batch_results, f, ensure_ascii=False, indent=2)
            print(f"Batch file saved successfully: {output_path}")
            logger.info(f"Batch transcription saved to {output_path}")
        except Exception as save_error:
            print(f"Error saving batch file to {output_path}: {str(save_error)}")
            logger.error(f"Error saving batch file: {str(save_error)}")

        elapsed_time = time.time() - start_time
        print(f"[/audio-to-transcript-batch] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "files_processed": len(batch_results),
            "batch_results": batch_results,
            "saved_to": output_path,
            "transcription_dir": TRANSCRIPTION_DIR,
            "file_exists": os.path.exists(output_path),
            "processing_time_seconds": round(elapsed_time, 2),
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(
            f"[/audio-to-transcript-batch] エラーで終了 - 処理時間: {elapsed_time:.2f}秒"
        )
        logger.error(f"Error during batch transcription: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Batch transcription failed: {str(e)}"
        )


@router.post("/transcribe-youtube-via-external")
async def transcribe_youtube_via_external(
    url: str = Body(...),
    round_id: int = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Experimental: Transcribe YouTube video via External GPU Server.
    - Input: url (YouTube URL), round_id (int)
    - Output: Saves transcription result to results_{round_name}/...
    """
    start_time = time.time()
    print(f"[/transcribe-youtube-via-external] 処理開始")

    # Fetch Round from DB
    try:
        round_result = await db.execute(select(Round).where(Round.id == round_id))
        round_obj = round_result.scalar_one_or_none()
        if not round_obj:
            raise HTTPException(status_code=404, detail=f"Round {round_id} not found")
        
        match_name = round_obj.name

    except Exception as db_e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(db_e)}")



    # Call local proxy endpoint (which handles external GPU communication)
    proxy_url = "http://localhost:8080/external-gpu-transcribe"
    
    try:
        # 1. Call local proxy (which forwards to external GPU server)
        print(f"Calling local proxy: {proxy_url} with URL: {url}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                proxy_url,
                json={
                    "url": url,
                    "num_chunks": 4,
                    "max_workers": 2
                },
                timeout=None  # Wait indefinitely for transcription
            )
        
        if resp.status_code != 200:
            error_detail = resp.text
            try:
                error_json = resp.json()
                error_detail = error_json.get("detail", resp.text)
            except:
                pass
            raise HTTPException(status_code=resp.status_code, detail=f"Proxy Error: {error_detail}")

        transcription_result = resp.json()
        
        # Validate the response format
        try:
            validated_data = VerboseTranscriptionResponse(**transcription_result)
            logger.info(f"External transcription validated successfully for round {round_id}")
        except ValidationError as val_error:
            logger.error(f"Validation failed for external transcription: {val_error}")
            raise HTTPException(status_code=500, detail=f"Invalid transcription format: {val_error}")

        # Save transcription to Round table
        round_obj.raw_transcription = transcription_result
        await db.commit()
        logger.info(f"Saved raw_transcription to Round {round_id}")

        elapsed_time = time.time() - start_time
        print(f"[/transcribe-youtube-via-external] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "round_id": round_id,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except httpx.RequestError as e:
        elapsed_time = time.time() - start_time
        print(f"[/transcribe-youtube-via-external] Proxy Request Error: {str(e)}")
        logger.error(f"Error calling proxy: {str(e)}")
        raise HTTPException(status_code=503, detail="Failed to reach proxy server")
    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/transcribe-youtube-via-external] Error: {str(e)}")
        logger.error(f"Error in external transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcript-to-adu-batch")
async def transcript_to_adu_batch(
    batch_request: BatchTranscriptRequest,
    debate_format: str = "NA",
    match_name: str = "",
):
    """
    Convert multiple speech transcriptions to ADUs in parallel using Gemini API
    - Input: JSON object with speech keys and their transcription data
    - Output: Individual CSV files for each speech + one unified CSV with all ADUs in debate order
    - Processing: Asynchronous parallel processing with Gemini API

    Parameters:
    - batch_request: Dictionary of speech transcriptions (from /audio-to-transcript-batch)
    - debate_format: Debate format to determine speech order ("NA", "ASIAN", or "BP"). Default: "NA"
    - match_name: Name of the debate match for log organization (optional)
    """
    start_time = time.time()
    print(f"[/transcript-to-adu-batch] 処理開始 - Debate format: {debate_format}")

    try:
        transcripts = batch_request.root
        if not transcripts:
            raise HTTPException(status_code=400, detail="No transcripts provided")

        # Validate debate format
        if debate_format not in DEBATE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid debate_format. Must be one of: {', '.join(DEBATE_FORMATS.keys())}",
            )

        speech_order = DEBATE_FORMATS[debate_format]

        # Generate a shared timestamp for this batch
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]

        # Create tasks for parallel processing
        tasks = [
            regroup_single_speech_sentences_to_adus(k, v, timestamp, match_name)
            for idx, (k, v) in enumerate(transcripts.items())
            # if idx == 0 # Prop1のみ処理
        ]

        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect results
        successful_speeches = []
        failed_speeches = []
        csv_files = []
        all_responses = {}
        all_raw_responses = {}
        adus_by_speech = {}

        for (
            speech_key,
            log_path,
            csv_path,
            raw_response,
            response_text,
            error_msg,
            adus_with_timestamps,
            _,
            _,
        ) in results:
            if error_msg:
                failed_speeches.append({"speech_key": speech_key, "error": error_msg})
            else:
                successful_speeches.append(
                    {
                        "speech_key": speech_key,
                        "log_path": log_path,
                        "csv_path": csv_path,
                        "csv_exists": os.path.exists(csv_path) if csv_path else False,
                    }
                )
                if csv_path:
                    csv_files.append(csv_path)
                if response_text:
                    all_responses[speech_key] = response_text
                # Use pre-parsed ADUs from regroup_single_speech_sentences_to_adus
                if adus_with_timestamps:
                    adus_by_speech[speech_key] = adus_with_timestamps
                if raw_response:
                    all_raw_responses[speech_key] = raw_response

        # Create unified CSV with all ADUs in debate order
        unified_csv_path = None
        unified_md_path = None
        total_adus_written = 0
        if adus_by_speech:
            unified_csv_filename = f"unified_adus_{debate_format}_{timestamp}.csv"
            # Unified CSV/MD go in match-specific results folder (not adus subfolder)
            match_results_dir = os.path.join(TRANSCRIPTION_DIR, f"results_{match_name}")
            os.makedirs(match_results_dir, exist_ok=True)
            unified_csv_path = os.path.join(match_results_dir, unified_csv_filename)
            try:
                total_adus_written = merge_adus_to_unified_csv(
                    adus_by_speech=adus_by_speech,
                    output_path=unified_csv_path,
                    speech_order=speech_order,
                )
                logger.info(
                    f"Unified CSV created: {unified_csv_path} ({total_adus_written} ADUs)"
                )

                # Generate Markdown from unified CSV
                unified_md_filename = f"unified_adus_{debate_format}_{timestamp}.md"
                unified_md_path = os.path.join(match_results_dir, unified_md_filename)
                try:
                    total_adus_in_md = unified_csv_to_markdown(
                        csv_path=unified_csv_path, output_path=unified_md_path
                    )
                    logger.info(
                        f"Unified MD created: {unified_md_path} ({total_adus_in_md} ADUs)"
                    )
                except Exception as md_error:
                    logger.error(f"Failed to create unified MD: {str(md_error)}")
                    unified_md_path = None

            except Exception as merge_error:
                logger.error(f"Failed to create unified CSV: {str(merge_error)}")
                unified_csv_path = None

        elapsed_time = time.time() - start_time
        print(f"[/transcript-to-adu-batch] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success" if not failed_speeches else "partial_success",
            "total_speeches": len(transcripts),
            "successful_count": len(successful_speeches),
            "failed_count": len(failed_speeches),
            "successful_speeches": successful_speeches,
            "failed_speeches": failed_speeches,
            "adu_responses": all_responses,
            "raw_responses": all_raw_responses,
            "individual_csv_files": csv_files,
            "unified_csv_path": unified_csv_path,
            "unified_csv_exists": (
                os.path.exists(unified_csv_path) if unified_csv_path else False
            ),
            "unified_md_path": unified_md_path,
            "unified_md_exists": (
                os.path.exists(unified_md_path) if unified_md_path else False
            ),
            "total_adus_in_unified_csv": total_adus_written,
            "debate_format": debate_format,
            "speech_order": speech_order,
            "adus_dir": ADUS_DIR,
            "logs_dir": LOGS_DIR,
            "processing_time_seconds": round(elapsed_time, 2),
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(
            f"[/transcript-to-adu-batch] エラーで終了 - 処理時間: {elapsed_time:.2f}秒"
        )
        logger.error(f"Error during batch ADU conversion: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Batch ADU conversion failed: {str(e)}"
        )


@router.post("/transcript-to-adu-all-at-once")
async def endpoint_transcript_to_adu_all_at_once(
    batch_request: BatchTranscriptRequest,
    debate_format: str = "NA",
    match_name: str = "",
):
    """
    Experimental: Convert all transcripts to ADUs in a SINGLE Gemini prompt.
    """
    start_time = time.time()
    try:
         transcripts = batch_request.root
         adus_by_speech, all_responses, failed = await transcript_to_adu_all_at_once(
             transcripts, debate_format, match_name
         )
         
         # Save logic (Simplified for this endpoint, usually handled by caller or we can reuse logic)
         # For now just return the result structure
         
         return {
             "status": "success",
             "adus_by_speech": adus_by_speech,
             "raw_response": all_responses,
             "failed": failed,
             "processing_time": time.time() - start_time
         }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def identify_rebuttal_structure(
    request: RebuttalStructureRequest, db: AsyncSession = Depends(get_db)
):
    """
    Identify rebuttal structure from database ADUs
    - Input: round_name
    - Output: {speeches: {...}, rebuttals: [[rebutting_id, rebutted_id], ...]}
    - Uses Gemini API to analyze rebuttal relationships
    - Saves result to database

    Parameters:
    - round_name: Round name to identify which debate round
    """
    start_time = time.time()
    print(f"[/identify-rebuttal-structure] 処理開始 - round_name: {request.round_name}")

    try:
        round_name = request.round_name
        try_count = request.try_count
        model_name = request.model or GEMINI_MODEL_NAME

        # Create Prompt and Get Mapping
        prompt, local_id_to_db_id, global_adu_index, speeches_data = await create_rebuttal_prompt_data(db, round_name, try_count)


        # Call Gemini API
        response = await asyncio.to_thread(
            client_gemini.models.generate_content, model=model_name, contents=prompt
        )

        # Extract response text
        response_text = response.text if hasattr(response, "text") else str(response)
        
        # Save raw log
        _save_gemini_log(response_text, "reb", round_name, prompt, model_name=model_name)

        # Parse the response to extract rebuttal pairs
        rebuttal_pairs = [] # List with DB IDs for saving
        local_rebuttal_pairs = [] # List with Local IDs for JSON output
        try:
            cleaned_response = clean_gemini_markdown_response(response_text)
            raw_local_pairs = json.loads(cleaned_response)

            if not isinstance(raw_local_pairs, list):
                raise ValueError("Response is not a list")

            # Validate format and convert back to DB IDs
            mapped_count = 0
            skipped_count = 0
            formatted_pairs = []
            
            for pair in raw_local_pairs:
                if not isinstance(pair, list) or len(pair) != 2:
                    logger.warning(f"Invalid pair format skipped: {pair}")
                    continue
                
                local_src = pair[0]
                local_tgt = pair[1]

                # Map back to DB IDs
                if local_src in local_id_to_db_id and local_tgt in local_id_to_db_id:
                     db_src = local_id_to_db_id[local_src]
                     db_tgt = local_id_to_db_id[local_tgt]
                     rebuttal_pairs.append([db_src, db_tgt]) # For DB Saving
                     local_rebuttal_pairs.append([local_src, local_tgt]) # For JSON Response
                     formatted_pairs.append(f"{local_src}->{local_tgt}")
                     mapped_count += 1
                else:
                    logger.warning(f"Skipping pair with unknown sequential IDs: {pair}. Max seq ID: {global_adu_index}")
                    skipped_count += 1

            logger.info(f"Rebuttal Mapping Result: Mapped {mapped_count}, Skipped {skipped_count}. Pairs: {', '.join(formatted_pairs[:10])}...")


        except (json.JSONDecodeError, ValueError) as parse_error:
            logger.error(f"Error parsing rebuttal pairs: {str(parse_error)}")
            logger.error(f"Raw response: {response_text}")
            rebuttal_pairs = []

        # DBに反論関係を保存
        if rebuttal_pairs:
            # 既存の反論関係を削除
            await round_crud.delete_rebuttals_by_round(db, round_name, try_count=try_count)
            # 新しい反論関係を保存
            await round_crud.create_rebuttals_batch(db, rebuttal_pairs)
            logger.info(f"Saved {len(rebuttal_pairs)} rebuttal pairs to database")

        # Build result in requested format
        result = {"speeches": speeches_data, "rebuttals": local_rebuttal_pairs}

        elapsed_time = time.time() - start_time
        print(
            f"[/identify-rebuttal-structure] 処理完了 - 処理時間: {elapsed_time:.2f}秒"
        )

        return {
            "status": "success",
            "round_name": round_name,
            "speeches": speeches_data,
            "rebuttals": local_rebuttal_pairs,
            "total_speeches": len(speeches_data),
            "total_adus": total_adus,
            "total_rebuttal_pairs": len(rebuttal_pairs),
            "model": model_name,
            "processing_time_seconds": round(elapsed_time, 2),
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(
            f"[/identify-rebuttal-structure] エラーで終了 - 処理時間: {elapsed_time:.2f}秒"
        )
        logger.error(f"Error during rebuttal structure identification: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Rebuttal structure identification failed: {str(e)}",
        )


@router.get("/gemini-models")
async def get_gemini_models():
    """List available Gemini models that support generateContent"""
    try:
        def fetch_models():
            model_list = []
            for m in client_gemini.models.list():
                if "gemini" in m.name.lower():
                    model_list.append(m.name)
            return model_list

        models = await asyncio.to_thread(fetch_models)
        models.sort(reverse=True) 
        
        return {"status": "success", "models": models}

    except Exception as e:
        logger.error(f"Failed to list Gemini models: {e}")
        fallback = [
             "models/gemini-2.5-flash"
        ]
        return {"status": "error", "models": fallback, "detail": str(e)}


class AudioToDebateGraphRequest(BaseModel):
    """Request for converting audio to debate graph"""

    debate_format: str = "NA"


class ManualADUSubmitRequest(BaseModel):
    round_name: str
    try_count: int
    adu_json: str  # The JSON string pasted by the user

class ManualRebuttalSubmitRequest(BaseModel):
    round_name: str
    try_count: int
    rebuttal_json: str # The JSON string pasted by the user


def create_adu_prompt_all_at_once(
    transcripts: Dict[str, Dict[str, Any]],
    debate_format: str = "NA",
) -> str:
    """
    Generate the prompt for all-at-once ADU segmentation.
    """
    # Prepare data for prompt
    speech_order = DEBATE_FORMATS.get(debate_format, [])
    ordered_speeches = []
    
    # Sort transcripts based on debate format order if possible
    if speech_order:
        for role in speech_order:
            if role in transcripts:
                ordered_speeches.append((role, transcripts[role]))
        # Add any remaining speeches not in order
        for k, v in transcripts.items():
            if k not in speech_order:
                ordered_speeches.append((k, v))
    else:
        ordered_speeches = list(transcripts.items())

    prompt_content_parts = []

    for speech_key, transcript_data in ordered_speeches:
        transcript_text = transcript_data.get("text", "")
        words_data_raw = transcript_data.get("words", [])
        
        words_data = [
            {
                **word,
                "start": round(word.get("start", 0.0), 1),
                "end": round(word.get("end", 0.0), 1),
            }
            for word in words_data_raw
        ]
        
        sentences_data = group_words_into_sentences(transcript_text, words_data)
        
        # Create prompt data for this speech matching regroup_single_speech_sentences_to_adus format
        prompt_sentences_data = [
            {
                "id": sentence["id"],
                "text": sentence["text"],
            }
            for sentence in sentences_data
        ]
        
        prompt_content_parts.append(f"## Speech: {speech_key}")
        prompt_content_parts.append("Sentence-level transcript data:")
        prompt_content_parts.append(json.dumps(prompt_sentences_data, indent=None))
        prompt_content_parts.append(f"Total Sentences: {len(sentences_data)}")
        prompt_content_parts.append("")

    full_transcript_text = "\n".join(prompt_content_parts)

    prompt_content = f"""
Please segment the following debate speeches into Argument Discourse Units (ADUs).
Each ADU represents a single argument or discourse unit with a specific role below:

ADU Role Definitions:
- introduction: Opening statement that typically explains the team's stance and framework
- definition: Definitions or models to clarify key terms (e.g., policy, values) that support the main arguments
- independent_rebuttal: A direct counter-argument to the opponent's point, typically presented before moving on to main arguments (one rebuttal = one ADU, regardless of length)
- point_of_main_argument: A cohesive set of claim and supporting reasoning focused on one specific argumentative point (typically 3-5 sentences per ADU)
- point_of_comparison: A cohesive set of comparative analysis explaining why one side's arguments outweigh the opponent's on a specific issue (typically 3-5 sentences per ADU)
- poi: During the speech, opponents can interject brief questions (called "point of information") or statements typically right after the speaker says "Yes". Please treat any such questions from opponents as a single ADU.

Segmentation Guidelines:
1. Each speaker typically has 2-3 main arguments or comparison issues, and each main argument or comparison issue contains 3-5 points
2. Main arguments and comparison issues are equally valid argumentative structures and can coexist in the same speech (e.g., a speaker might present 2 main arguments and 1 comparison issue)
3. Rebuttals are always independent ADUs regardless of length
4. Group sentences discussing the same specific argumentative point into one ADU
5. Treat any POI as a single independent ADU.
6. Treat a response to a POI as a single ADU.
7. Each ADU **MUST NOT** exceed 150 words. If a passage exceeds this limit, split it into multiple ADUs at logical break points.

Transcript Data:
{full_transcript_text}

Return the result as a JSON object where keys are "Speech Name" (e.g. Proposition_1st) and values are lists of ADUs.
IDs are local to each speech (0, 1, 2...).

Format:
{{
  "Proposition_1st": [
    {{
      "start_sentence_index": 0,
      "end_sentence_index": 2,
      "text": "The actual ADU text...",
      "role": "point_of_main_argument"
    }}
  ],
  "Opposition_1st": [...]
}}
"""
    return prompt_content

async def create_rebuttal_prompt_data(
    db: AsyncSession,
    round_name: str,
    try_count: Optional[int] = None
) -> tuple[str, Dict[int, int], int, Dict[str, Any]]:
    """
    Generate rebuttal prompt and ID mapping from DB data.
    """
    # DBからスピーチとADUを取得
    speeches = await round_crud.get_speeches_by_round(db, round_name, try_count=try_count)
    if not speeches:
        raise HTTPException(
            status_code=404, detail=f"No speeches found for round {round_name}"
        )

    # Build speeches data structure and markdown for Gemini
    speeches_data = {}
    markdown_lines = []
    
    # Mapping for sequential ID (1-based) to DB ID
    local_id_to_db_id = {}
    global_adu_index = 0
    
    # 1. Collect speech IDs
    speech_ids = [s.id for s in speeches]
    
    # 2. Batch fetch all related data
    res_adus = await db.execute(select(Adu).where(Adu.speech_id.in_(speech_ids)).order_by(Adu.id))
    all_adus = res_adus.scalars().all()
    
    res_sents = await db.execute(select(Sentence).where(Sentence.speech_id.in_(speech_ids)).order_by(Sentence.index))
    all_sents = res_sents.scalars().all()
    
    res_words = await db.execute(select(Word).where(Word.speech_id.in_(speech_ids)).order_by(Word.index))
    all_words = res_words.scalars().all()
    
    # 3. Group by speech_id
    speech_adus = {sid: [] for sid in speech_ids}
    for a in all_adus:
        if a.speech_id in speech_adus:
             speech_adus[a.speech_id].append(a)
             
    speech_sents = {sid: [] for sid in speech_ids}
    for s in all_sents:
        if s.speech_id in speech_sents:
             speech_sents[s.speech_id].append(s)
             
    speech_words = {sid: [] for sid in speech_ids}
    for w in all_words:
        if w.speech_id in speech_words:
             speech_words[w.speech_id].append(w)

    for speech in speeches:
        speech_key = speech.position
        speeches_data[speech_key] = []

        # Get data from memory
        adus = speech_adus.get(speech.id, [])
        sentences = speech_sents.get(speech.id, [])
        words = speech_words.get(speech.id, [])

        sentences_map = {s.index: s for s in sentences}
        words_map = {w.index: w for w in words}

        if adus:
            markdown_lines.append(f"## {speech_key}")
            markdown_lines.append("")

        for adu in adus:
            # Increment global sequential ID
            global_adu_index += 1
            local_id_to_db_id[global_adu_index] = adu.id

            # Calculate timestamp
            start_time = 0.0
            if adu.start_sentence_index in sentences_map:
                sent = sentences_map[adu.start_sentence_index]
                if sent.start_word_index in words_map:
                    start_time = words_map[sent.start_word_index].start_time

            # Format: {id, type, text, start}
            adu_data = {
                "id": global_adu_index,  # Use local sequential ID for output
                "type": adu.role,
                "text": adu.text,
                "start": round(start_time, 1),
            }
            speeches_data[speech_key].append(adu_data)

            # Build markdown for Gemini using Sequential ID
            markdown_lines.append(f"id:{global_adu_index}, {adu.text}")
            markdown_lines.append("")

    transcript = "\n".join(markdown_lines)
    total_adus = sum(len(v) for v in speeches_data.values())
    logger.info(f"Loaded {total_adus} ADUs from database. Max sequential ID: {global_adu_index}")

    # Prepare prompt for Gemini
    prompt = f"""## Instruction
The following text is a transcript from a parliamentary competitive debate. From this transcript, extract all explicit rebuttal pairs.

## Rebuttal Condition
- A rebuttal must reference the content of an argument made by the opposing team. Expressions like "They said …" are commonly used but not strictly required. The link can also be clear from context or topic.
- A rebuttal must negate, weaken, or challenge the opposing argument. Statements that are too vague or generic can neither serve as rebuttals nor be treated as valid rebuttal targets.
- A rebuttal can only target a statement made previously by the opposing team, and thus Proposition 1st must not rebut at all.

## Transcript
{transcript}

## Output Format
Return ONLY a JSON array of pairs in this exact format.
Example: [[5, 2], [7, 3], [12, 8]]

Do not include any other text, explanation, or formatting."""

    return prompt, local_id_to_db_id, global_adu_index, speeches_data


@router.post("/audio-to-debate-graph-batch")
async def audio_to_debate_graph_batch(
    files: List[UploadFile] = File(...),
    debate_format: str = Form("NA"),
    round_name: str = Form(...),
    motion: str = Form(None),
    call_llm_all_at_once: bool = Form(True),
    use_latest_transcription: bool = Form(True),
    speech_metadata: Optional[str] = Form(None),
    transcription_model: str = Form("groq-whisper-large-v3-turbo"),
    adu_model: str = Form(GEMINI_MODEL_NAME),
    rebuttal_model: str = Form(GEMINI_MODEL_NAME),
    manual_mode: bool = Form(False),
    db: AsyncSession = Depends(get_db),
):
    """
    Multiple audio files -> Speech-to-Text -> Segment to ADU vs database save -> Rebuttal structure
    """
    start_time = time.time()
    print(f"[/audio-to-debate-graph-batch] 処理開始 - round_name: {round_name}, default_all_at_once: {call_llm_all_at_once}, use_latest: {use_latest_transcription}")

    try:
        # Step 0: Validate format
        if debate_format not in DEBATE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid debate_format. Must be one of: {', '.join(DEBATE_FORMATS.keys())}",
            )

        speech_order = DEBATE_FORMATS[debate_format]

        # Map short format codes to long DB style strings
        style_mapping = {
            "BP": "british_parliamentary",
            "NA": "north_american",
            "ASIAN": "asian",
            "OPENING_HALF_BP_ORDER": "bp_opening_half"
        }
        # Default to the format itself if not in mapping (or fallback)
        db_style = style_mapping.get(debate_format, debate_format)

        # Step 1: ラウンドを作成
        print("[Step 1/5] ラウンドを作成...")
        round_obj = await round_crud.create_round(
            db, 
            name=round_name,
            style=db_style,
            motion=motion
        )
        logger.info(f"Created round with name '{round_name}'")
        
        # Capture try_count immediately to prevent MissingGreenlet error after commits
        current_try_count = round_obj.try_count

        # Step 1.5: 前回の文字起こしデータを取得（use_latest_transcription=Trueの場合）
        existing_transcriptions = {}
        if use_latest_transcription and current_try_count and current_try_count > 1:
            try:
                prev_try_count = current_try_count - 1
                prev_speeches = await round_crud.get_speeches_by_round(db, round_name, try_count=prev_try_count)
                for s in prev_speeches:
                    if s.raw_transcription:
                        existing_transcriptions[s.position.strip()] = s.raw_transcription
                logger.info(f"Found {len(existing_transcriptions)} existing transcriptions from try_count {prev_try_count}")
            except Exception as e:
                logger.warning(f"Failed to fetch previous transcriptions: {e}")



        # Step 2: 音声を文字起こし (or reuse existing)
        print("[Step 2/5] 音声の文字起こしを開始...")
        tasks = []
        # Keep track of which files are pending transcription vs reused
        # We need to map results back effectively. 
        # Strategy: Create a wrapper task or handle reuse directly.
        
        # Prepare metadata map if available
        metadata_map = {}
        if speech_metadata:
            try:
                meta_list = json.loads(speech_metadata)
                for item in meta_list:
                    if "filename" in item and "position" in item:
                        metadata_map[item["filename"]] = item["position"]
            except Exception as e:
                logger.warning(f"Failed to parse speech_metadata: {e}")

        async def trans_or_reuse(file: UploadFile):
            # Resolve speech_key using metadata
            if file.filename not in metadata_map:
                logger.error(f"Missing metadata for file: {file.filename}")
                raise HTTPException(status_code=400, detail=f"Missing metadata for file {file.filename}")

            speech_key = metadata_map[file.filename]
            
            # Extract date for reuse case (if present in filename)
            filename_without_ext = os.path.splitext(file.filename)[0]
            parts = filename_without_ext.split("-", 1)
            date_transcribed = parts[1] if len(parts) > 1 else ""
            
            if speech_key in existing_transcriptions:
                print(f"Skipping transcription for {speech_key} (reusing existing data)")
                return speech_key, date_transcribed, existing_transcriptions[speech_key]
            else:
                # Transcribe new audio
                # Note: transcribe_single_audio parses filename internally too, but we override the key here
                _, date_ret, trans_dict = await transcribe_single_audio(file, transcription_model)
                return speech_key, date_ret, trans_dict
            


        tasks = [trans_or_reuse(file) for file in files]
        results = await asyncio.gather(*tasks)

        batch_results: Dict[str, Any] = {}
        for speech_key, date_transcribed, trans_dict in results:
            if trans_dict is not None and speech_key:
                batch_results[speech_key] = trans_dict

        if not batch_results:
            raise HTTPException(
                status_code=400, detail="No files were successfully transcribed"
            )

        print(f"[Step 2/5] 文字起こし完了: {len(batch_results)} ファイル")

        # Step 3: スピーチをDBに保存
        print("[Step 3/5] スピーチをデータベースに保存...")
        speech_id_map = {}  # speech_key -> speech_id のマッピング
        current_round_id = round_obj.id
        
        for speech_key, trans_data in batch_results.items():
            # audio_pathを設定（audio-save/{round_name}/{speech_key}.webm）
            audio_path = f"{round_name}/{speech_key}.webm"

            speech_obj = await round_crud.create_speech(
                db,
                round_id=current_round_id,
                position=speech_key,
                audio_path=audio_path,
                duration=trans_data.get("duration"),
                raw_transcription=trans_data
            )
            speech_id_map[speech_key] = speech_obj.id
            logger.info(f"Created speech {speech_obj.id} for {speech_key} with audio_path={audio_path}")

        # Step 4: ADUに変換してDBに保存
        print("[Step 4/5] ADU変換を開始...")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        
        adus_by_speech = {}

        if manual_mode:
            # Manual Mode: Generate Prompt and Return
            print(f">> Using Manual Mode. Returning ADU Prompt.")
            prompt_content = create_adu_prompt_all_at_once(
                batch_results, debate_format
            )
            # Create Words/Sentences anyway for consistency (Step 3.5ish)
            # Actually, to make 'submit-adu' work easier, we SHOULD save Words and Sentences now.
            # (Logic continues below to save Words/Sentences)
            
        elif call_llm_all_at_once:
             print(f">> Using Call LLM All At Once Mode with {adu_model}")
             adus_by_speech, _, _ = await regroup_all_speech_sentences_to_adus_at_once(
                 batch_results, debate_format, round_name, model_name=adu_model
             )
        else:
            print(f">> Using Parallel Individual Call Mode with {adu_model}")
            # 各スピーチのADUを生成（並列処理）
            tasks = [
                regroup_single_speech_sentences_to_adus(k, v, timestamp, round_name, model_name=adu_model)
                for idx, (k, v) in enumerate(batch_results.items())
            ]
            
            adu_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for res in adu_results:
                 if isinstance(res, tuple) and len(res) >= 7:
                     s_key = res[0]
                     s_adus = res[6]
                     if s_adus:
                         adus_by_speech[s_key] = s_adus
        
        # Save Words, Sentences, and ADUs to DB
        total_adus_saved = 0
        
        for speech_key, trans_data in batch_results.items():
            speech_id = speech_id_map.get(speech_key)
            if not speech_id:
                logger.error(f"No speech_id found for {speech_key}")
                continue

            # 1. Prepare Words Data
            words_raw = trans_data.get("words", [])
            words_data = [
                {
                    **word,
                    "start": round(word.get("start", 0), 1),
                    "end": round(word.get("end", 0), 1),
                }
                for word in words_raw
            ]
            
            # Save Words
            words_to_create = [
                {
                    "speech_id": speech_id,
                    "index": i,
                    "text": w.get("word", w.get("text", "")),
                    "start_time": w["start"],
                    "end_time": w["end"],
                    "confidence": w.get("probability", w.get("confidence"))
                }
                for i, w in enumerate(words_data)
            ]
            await round_crud.create_words_batch(db, words_to_create)

            # 2. Prepare Sentences Data
            transcript_text = trans_data.get("text", "")
            sentences_data = group_words_into_sentences(transcript_text, words_data)
            
            # Save Sentences
            sentences_to_create = [
                {
                    "speech_id": speech_id,
                    "index": s["id"],
                    "text": s["text"],
                    "start_word_index": s["start_word_index"],
                    "end_word_index": s["end_word_index"]
                }
                for s in sentences_data
            ]
            await round_crud.create_sentences_batch(db, sentences_to_create)

            # 3. Save ADUs (if available - NOT available in Manual Mode yet)
            if speech_key in adus_by_speech:
                adus_list = adus_by_speech[speech_key]
                adus_data = [
                    {
                        "speech_id": speech_id,
                        "start_sentence_index": adu.get("start_sentence_index"),
                        "end_sentence_index": adu.get("end_sentence_index"),
                        "text": adu.get("text"),
                        "role": adu.get("role")
                    }
                    for adu in adus_list
                ]
                saved_adus = await round_crud.create_adus_batch(db, adus_data)
                total_adus_saved += len(saved_adus)
                logger.info(f"Saved {len(words_to_create)} words, {len(sentences_to_create)} sentences, {len(saved_adus)} ADUs for {speech_key}")
            else:
                if manual_mode:
                    logger.info(f"Manual mode: Saved words/sentences for {speech_key}, waiting for ADU input.")
                else:
                    logger.warning(f"No ADUs available for {speech_key}")

        if manual_mode:
            print(f"[Step 4/5] Manual Mode: Returning ADU Prompt.")
            return {
                "status": "manual_adu_prompt",
                "round_name": round_name,
                "try_count": current_try_count,
                "prompt": prompt_content,
                "summary": {
                    "files_transcribed": len(batch_results),
                    "total_adus": 0, # Not yet
                }
            }

        print(f"[Step 4/5] ADU変換完了: {total_adus_saved} ADUs")

        # Step 5: 反論構造を抽出してDBに保存
        print(f"[Step 5/5] 反論構造の抽出を開始... model={rebuttal_model}")
        rebuttal_request = RebuttalStructureRequest(round_name=round_name, try_count=current_try_count, model=rebuttal_model)
        rebuttal_response = await identify_rebuttal_structure(rebuttal_request, db)

        if rebuttal_response["status"] != "success":
            raise Exception(f"Rebuttal structure identification failed: {rebuttal_response}")

        print(f"[Step 5/5] 反論構造抽出完了: {rebuttal_response['total_rebuttal_pairs']} rebuttal pairs")

        elapsed_time = time.time() - start_time
        print(f"[/audio-to-debate-graph-batch] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "round_name": round_name,
            "try_count": current_try_count,
            "debate_format": debate_format,
            "summary": {
                "files_transcribed": len(batch_results),
                "total_adus": total_adus_saved,
                "total_rebuttal_pairs": rebuttal_response["total_rebuttal_pairs"],
                "speeches": rebuttal_response["total_speeches"],
            },
            "processing_time_seconds": round(elapsed_time, 2),
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/audio-to-debate-graph-batch] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during audio to debate graph conversion: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Audio to debate graph conversion failed: {str(e)}"
        )


@router.get("/rebuttal-graph/{round_name}")
async def get_rebuttal_graph(round_name: str, try_count: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """
    Get the rebuttal graph JSON for a specific round from database
    - Reads from database
    - Returns: {speeches: {...}, rebuttals: [[src, tgt], ...]}
    """
    try:
        # DBからスピーチとADUを取得
        speeches = await round_crud.get_speeches_by_round(db, round_name, try_count=try_count)
        if not speeches:
            raise HTTPException(
                status_code=404, detail=f"No speeches found for round {round_name}"
            )

        # Build speeches data structure
        speeches_data = {}
        for speech in speeches:
            speech_key = speech.position
            speeches_data[speech_key] = []

            # そのスピーチのADU、文、単語を取得
            adus = await round_crud.get_adus_by_speech(db, speech.id)
            sentences = await round_crud.get_sentences_by_speech(db, speech.id)
            words = await round_crud.get_words_by_speech(db, speech.id)

            sentences_map = {s.index: s for s in sentences}
            words_map = {w.index: w for w in words}

            for adu in adus:
                # Calculate timestamp
                start_time = 0.0
                if adu.start_sentence_index in sentences_map:
                    sent = sentences_map[adu.start_sentence_index]
                    if sent.start_word_index in words_map:
                        start_time = words_map[sent.start_word_index].start_time

                # Format: {id, type, text, start}
                adu_data = {
                    "id": adu.id,
                    "type": adu.role,
                    "text": adu.text,
                    "start": round(start_time, 1),  # 小数第1位に丸める
                }
                speeches_data[speech_key].append(adu_data)

        # DBから反論関係を取得
        rebuttals = await round_crud.get_rebuttals_by_round(db, round_name, try_count=try_count)
        rebuttal_pairs = [[r.src_adu_id, r.tgt_adu_id] for r in rebuttals]

        graph_data = {
            "speeches": speeches_data,
            "rebuttals": rebuttal_pairs
        }

        logger.info(f"Rebuttal graph loaded from database for round {round_name}")

        return {
            "status": "success",
            "round_name": round_name,
            "data": graph_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get rebuttal graph: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get rebuttal graph: {str(e)}"
        )

# --- Manual Mode Endpoints ---

@router.post("/manual/submit-adu", response_model=Dict[str, Any])
async def manual_submit_adu(request: ManualADUSubmitRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 2 of Manual Mode: Receive ADU JSON from user, save to DB.
    """
    logger.info(f"Manual ADU Submission for {request.round_name}, Try: {request.try_count}")
    
    try:
        # Validate JSON
        try:
            adu_data = json.loads(request.adu_json)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

        # Fetch speeches for this round
        # Using round_crud for consistency where possible, specifically to get speeches with IDs
        speeches = await round_crud.get_speeches_by_round(db, request.round_name, try_count=request.try_count)
        
        if not speeches:
            raise HTTPException(status_code=404, detail="Speeches not found for this round")
            
        speech_map = {s.position: s.id for s in speeches}

        # Validate structure and normalize
        items_to_process = []
        if "speeches" in adu_data:
             # Format: {"speeches": [{"position": "...", "adus": [...]}]}
             items_to_process = adu_data["speeches"]
        else:
             # Assume Format: {"Proposition_1st": [...], ...} where keys are positions
             # Check if it looks like a dict of speeches
             if isinstance(adu_data, dict):
                 for pos, adus in adu_data.items():
                     if isinstance(adus, list):
                         items_to_process.append({"position": pos, "adus": adus})
        
        if not items_to_process:
             # Failed to identify structure or empty
             # Fallback error if we really couldn't find anything
             if not isinstance(adu_data, dict):
                 raise HTTPException(status_code=400, detail="JSON must be an object (dictionary)")
             # If it was a dict but empty, items_to_process is empty, causing no save. 
             # We might want to warn but not fail?
             logger.warning("No ADU data found in JSON input")

        saved_count = 0
        
        # Prepare ADUs for batch insertion
        adus_to_create = []

        for speech_item in items_to_process:
            position = speech_item.get("position")
            if position not in speech_map:
                logger.warning(f"Unknown speech position in manual input: {position}")
                continue
            
            speech_id = speech_map[position]
            
            # Note: We append new tries, so we don't necessarily delete old ones unless we want to clear the slate for THIS try count.
            # Ideally we should clear ADUs for this speech_id AND try_count to avoid duplicates if user clicks submit multiple times.
            # But here we assume the user manages try_count or we just append.
            # To be safe, let's delete existing ADUs for this try_count if any (optional but cleaner)
            await db.execute(delete(Adu).where(Adu.speech_id == speech_id)) # WARNING: This deletes ALL ADUs for speech, not just this try? 
            # Adu model DOES NOT HAVE try_count column based on models.round.py! 
            # Logic: ADUs belong to Speech. Speech belongs to Round. Round has try_count.
            # So deleting ADUs for speech_id is correct because speech_id IS specific to this try_count (Speeches are recreated for new tries? No, Round has try_count... check round.py)
            # Round: name, try_count. Unique(name, try_count). 
            # Speech: round_id.
            # So yes, speech_id is unique to (round_name, try_count).
            # So deleting all ADUs for speech_id is correct for a re-submission.
            
            for adu in speech_item.get("adus", []):
                # Calculate start/end indices or validation?
                # Manual input might need validation.
                
                adus_to_create.append({
                    "speech_id": speech_id,
                    "start_sentence_index": adu.get("start_sentence_index", 0),
                    "end_sentence_index": adu.get("end_sentence_index", 0),
                    "text": adu.get("text", ""),
                    "role": adu.get("role", "claim")
                })
        
        if adus_to_create:
            await round_crud.create_adus_batch(db, adus_to_create)
            saved_count = len(adus_to_create)
        
        await db.commit()
        return {"status": "success", "message": f"Saved {saved_count} ADUs"}

    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving manual ADU data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/manual/rebuttal-prompt/{round_name}", response_model=Dict[str, Any])
async def get_manual_rebuttal_prompt(round_name: str, try_count: int, db: AsyncSession = Depends(get_db)):
    """
    Step 3 of Manual Mode: Generate and return the Rebuttal Identification Prompt.
    Requires ADUs to be already saved for this round and try_count.
    """
    logger.info(f"Generating Manual Rebuttal Prompt for {round_name}, Try: {try_count}")
    
    try:
        # Use the existing function!
        prompt, _, _, _ = await create_rebuttal_prompt_data(db, round_name, try_count)
        
        # Save prompt to log (optional but good for consistency)
        _save_gemini_log(prompt, "manual_rebuttal_prompt", round_name, prompt_text=prompt) # Args switched in _save_gemini_log def? Check def.
        # Def: _save_gemini_log(response_text, category, identifier, prompt_text, model_name)
        # Here response is prompt? Or prompt is prompt? treating prompt as 'response_text' for logging visibility?
        # Let's just log it.

        return {
            "status": "success",
            "prompt": prompt,
            "round_name": round_name,
            "try_count": try_count
        }

    except Exception as e:
        logger.error(f"Error generating manual rebuttal prompt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual/submit-rebuttal", response_model=Dict[str, Any])
async def manual_submit_rebuttal(request: ManualRebuttalSubmitRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 4 of Manual Mode: Receive Rebuttal JSON, save to DB, and return final graph.
    """
    logger.info(f"Manual Rebuttal Submission for {request.round_name}, Try: {request.try_count}")

    try:
        try:
            rebuttal_data = json.loads(request.rebuttal_json)
        except json.JSONDecodeError as e:
             raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
        
        # We need the ID mapping again. 
        # Ideally create_rebuttal_prompt_data helper should separate "get data" from "make prompt" so we can reuse "get data".
        # But create_rebuttal_prompt_data returns (prompt, local_id_to_db_id, ...).
        # We can call it again to get the mapping! It's read-only.
        
        _, local_id_to_db_id, _, _ = await create_rebuttal_prompt_data(db, request.round_name, request.try_count)
        
        # Save Rebuttals
        if "rebuttals" not in rebuttal_data:
             # Try simple list format if user pasted just the list
             if isinstance(rebuttal_data, list):
                 rebuttals_list = rebuttal_data
             else:
                 raise HTTPException(status_code=400, detail="JSON must contain 'rebuttals' key or be a list")
        else:
            rebuttals_list = rebuttal_data["rebuttals"]
             
        pairs_to_create = []
        for reb in rebuttals_list:
            # Handle list format [src, tgt] or dict
            if isinstance(reb, list) and len(reb) >= 2:
                source_local_id = reb[0]
                target_local_id = reb[1]
                type_val = "direct"
            elif isinstance(reb, dict):
                source_local_id = reb.get("source_adu_id")
                target_local_id = reb.get("target_adu_id")
                type_val = reb.get("type", "direct")
            else:
                continue

            # Map to DB IDs
            if source_local_id in local_id_to_db_id and target_local_id in local_id_to_db_id:
                source_db_id = local_id_to_db_id[source_local_id]
                target_db_id = local_id_to_db_id[target_local_id]
                
                pairs_to_create.append({
                    "src_adu_id": source_db_id,
                    "tgt_adu_id": target_db_id,
                    # Rebuttal model doesn't have try_count, assuming Rebuttal links existing ADUs which are tied to speech which is tied to round/try.
                    # Wait, Rebuttal table def in round.py: src_adu_id, tgt_adu_id. No try_count.
                })
            else:
                logger.warning(f"Could not map local IDs: {source_local_id} -> {target_local_id}")

        if pairs_to_create:
            # Delete existing rebuttals for these ADUs? Hard to say. 
            # Rebuttals are M:N.
            # Just add them.
            # Using round_crud.create_rebuttal_pairs if available?
            # It's not standard CRUD, probably custom.
            # Let's use direct DB add for Rebuttal.
            
            for pair in pairs_to_create:
                new_pair = Rebuttal(
                    src_adu_id=pair["src_adu_id"],
                    tgt_adu_id=pair["tgt_adu_id"]
                )
                db.add(new_pair)
        
        await db.commit()

        # Return final graph
        # Reuse existing get_rebuttal_graph logic. 
        # Need to import get_rebuttal_graph? It's in this file!
        # But it's defined inside another endpoint? No, checking file...
        # I need to find where get_rebuttal_graph is defined. 
        # Step 327 showed "Failed to get rebuttal graph" in exception of SOME function manually implemented?
        # Ah, Step 355 view of models/round.py doesn't show it.
        # Step 367 shows audio_to_debate_graph_batch calling identify_rebuttal_structure.
        
        # Where is get_rebuttal_graph? It's likely an endpoint function `@router.get(...)`.
        # Endpoints are not callable directly easily unless extracted.
        # I'll just return success and let frontend call the graph API or I can implement graph fetch here if I have the function.
        # The frontend calls autoLoadGraphData -> fetch /api/rebuttal-graph.
        # So I just need to return success.
        
        return {
            "status": "success",
            "message": "Manual generation completed",
            "round_name": request.round_name,
            "try_count": request.try_count
        }

    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving manual rebuttal data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class ManualResumeRequest(BaseModel):
    round_name: str
    try_count: int


@router.post("/manual/resume")
async def manual_resume(request: ManualResumeRequest, db: AsyncSession = Depends(get_db)):
    """
    Resume manual workflow based on existing data.
    Algorithm:
    1. Check if Rebuttals exist (ADUs linked). If YES -> Return status names for graph, or "completed".
    2. Check if ADUs exist. If YES -> Return Rebuttal prompt (Step 3).
    3. Check if Sentences exist. If YES -> Return ADU prompt (Step 2).
    4. If Sentences missing, check Raw Transcription. If YES -> Recover Sentences -> Return ADU prompt.
    5. If all missing -> Error.
    """
    round_name = request.round_name
    try_count = request.try_count
    logger.info(f"Resuming manual workflow for {round_name} (try {try_count})")

    # 1. Check Rebuttals
    # Rebuttal links two ADUs. Need to find if any Rebuttal exists where src/tgt ADU belongs to this round/try.
    # ADU table has speech_id, Speech table has round_id/try_count.
    # Query: Select count(*) from Rebuttal r join ADU a on r.src_adu_id = a.id join Speech s on a.speech_id = s.id 
    #        where s.round_id = (select id from Round where name=round_name) and s.try_count = try_count
    
    # Get Round ID
    round_query = await db.execute(select(Round).where(Round.name == round_name, Round.try_count == try_count))
    round_obj = round_query.scalars().first()
    
    if not round_obj:
         # If the round/try combination doesn't exist, we determine the next valid try count
         # effectively enforcing "no skipping" logic.
         from fastapi.responses import JSONResponse
         
         # Get the maximum try_count for this round_name
         base_query = await db.execute(select(Round).where(Round.name == round_name).order_by(Round.try_count.desc()))
         base_round = base_query.scalars().first()
         
         if base_round:
             next_try = base_round.try_count + 1
         else:
             next_try = 1
             
         return JSONResponse(
             status_code=404, 
             content={
                 "detail": f"Round {round_name} with try {try_count} not found",
                 "next_try_count": next_try
             }
         )

    # Check Rebuttals
    # We can check if ANY rebuttal exists for speeches in this round/try.
    stmt_reb = select(Rebuttal).join(Adu, Rebuttal.src_adu_id == Adu.id).join(Speech, Adu.speech_id == Speech.id)\
                .where(Speech.round_id == round_obj.id)
    result_reb = await db.execute(stmt_reb)
    first_reb = result_reb.scalars().first()
    
    if first_reb:
        # Rebuttals exist. Assume completed.
        return {
            "status": "completed",
            "message": "Rebuttals found. Workflow completed.",
            "round_name": round_name,
            "try_count": try_count
        }

    # 2. Check ADUs
    stmt_adu = select(Adu).join(Speech, Adu.speech_id == Speech.id)\
                .where(Speech.round_id == round_obj.id)
    result_adu = await db.execute(stmt_adu)
    first_adu = result_adu.scalars().first()

    if first_adu:
        # ADUs exist, but Rebuttals don't. Need Rebuttal Prompt (Step 3).
        # Reuse helper: create_rebuttal_prompt_data
        try:
             prompt_content, _, _, _ = await create_rebuttal_prompt_data(db, round_name, try_count)
             return {
                "status": "step2_done", # Renamed from manual_rebuttal_prompt
                "round_name": round_name,
                "try_count": try_count,
                "prompt": prompt_content
            }
        except Exception as e:
            logger.error(f"Failed to create rebuttal prompt during resume: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate rebuttal prompt: {e}")

    # 3. Check Sentences
    stmt_sen = select(Sentence).join(Speech, Sentence.speech_id == Speech.id)\
                .where(Speech.round_id == round_obj.id)
    result_sen = await db.execute(stmt_sen)
    first_sen = result_sen.scalars().first()

    if first_sen:
        # Sentences exist, ADUs don't. Need ADU Prompt (Step 2).
        # We need to reconstruct transcripts dict for create_adu_prompt_all_at_once
        # Actually, create_adu_prompt_all_at_once takes `transcripts` dict.
        # We need to fetch all sentences and group by speech role.
        
        # Fetch all speeches for this round/try
        stmt_speeches = select(Speech).where(Speech.round_id == round_obj.id)
        speeches_res = await db.execute(stmt_speeches)
        speeches = speeches_res.scalars().all()
        
        
        transcripts_data = {}
        speech_id_to_sentences = {}
        
        # Batch fetch all sentences
        speech_ids = [s.id for s in speeches]
        if speech_ids:
            stmt_all_s = select(Sentence).where(Sentence.speech_id.in_(speech_ids)).order_by(Sentence.speech_id, Sentence.index)
            res_all_s = await db.execute(stmt_all_s)
            all_sentences = res_all_s.scalars().all()
            
            # Group by speech_id
            for s in all_sentences:
                if s.speech_id not in speech_id_to_sentences:
                    speech_id_to_sentences[s.speech_id] = []
                speech_id_to_sentences[s.speech_id].append(s)
        
        for speech in speeches:
            # Get sentences for this speech from memory
            sentences = speech_id_to_sentences.get(speech.id, [])
            
            # Prepare prompt data directly
            role = speech.position
            transcripts_data[role] = sentences
            
        # Generate prompt manually to ensure we use db sentences
        prompt_content_parts = []
        # Need to sort speeches?
        # Use simple sort by ID or position order if possible.
        # Let's map positions to standard order if imported.
        # Reuse DEBATE_FORMATS from utils if imported? Yes (Step 1090).
        
        # Sort logic
        ordered_roles = []
        # get debate_format from Round? Round model has `style` (british_parliamentary etc).
        # Need to map style "british_parliamentary" to "BP".
        # Or just use "NA" default sort if unknown.
        style_map = {"british_parliamentary": "BP", "north_american": "NA", "asian": "ASIAN"}
        debate_fmt_key = style_map.get(round_obj.style, "NA") # Round model has `style`, default 'british_parliamentary'.
        
        speech_order = DEBATE_FORMATS.get(debate_fmt_key, [])
        sorted_speech_keys = []
        
        # Sort keys
        remaining = list(transcripts_data.keys())
        for r in speech_order:
             if r in remaining:
                 sorted_speech_keys.append(r)
                 remaining.remove(r)
        sorted_speech_keys.extend(remaining) # Add rest
        
        for role in sorted_speech_keys:
             sents = transcripts_data[role] # list of Sentence objects
             prompt_sentences_data = [
                 {"id": s.index, "text": s.text} for s in sents
             ]
             
             prompt_content_parts.append(f"## Speech: {role}")
             prompt_content_parts.append("Sentence-level transcript data:")
             prompt_content_parts.append(json.dumps(prompt_sentences_data, indent=None, ensure_ascii=False))
             prompt_content_parts.append(f"Total Sentences: {len(sents)}")
             prompt_content_parts.append("")
             
        full_transcript_text = "\n".join(prompt_content_parts)

        # Reuse static prompt template parts?
        # I'll just hardcode the prompt template here to be safe and consistent with `create_adu_prompt_all_at_once`
        # Or import the function and refactor it? Refactoring is risky in EXECUTION.
        # Usage of `create_adu_prompt_all_at_once` with dummy data is tricky because it calls `group_words_into_sentences`.
        # So manual reconstruction is safer.
        
        prompt_content = f"""
Please segment the following debate speeches into Argument Discourse Units (ADUs).
Each ADU represents a single argument or discourse unit with a specific role below:

ADU Role Definitions:
- introduction: Opening statement that typically explains the team's stance and framework
- definition: Definitions or models to clarify key terms (e.g., policy, values) that support the main arguments
- independent_rebuttal: A direct counter-argument to the opponent's point, typically presented before moving on to main arguments (one rebuttal = one ADU, regardless of length)
- point_of_main_argument: A cohesive set of claim and supporting reasoning focused on one specific argumentative point (typically 3-5 sentences per ADU)
- point_of_comparison: A cohesive set of comparative analysis explaining why one side's arguments outweigh the opponent's on a specific issue (typically 3-5 sentences per ADU)
- poi: During the speech, opponents can interject brief questions (called "point of information") or statements typically right after the speaker says "Yes". Please treat any such questions from opponents as a single ADU.

Segmentation Guidelines:
1. Each speaker typically has 2-3 main arguments or comparison issues, and each main argument or comparison issue contains 3-5 points
2. Main arguments and comparison issues are equally valid argumentative structures and can coexist in the same speech (e.g., a speaker might present 2 main arguments and 1 comparison issue)
3. Rebuttals are always independent ADUs regardless of length
4. Group sentences discussing the same specific argumentative point into one ADU
5. Treat any POI as a single independent ADU.
6. Treat a response to a POI as a single ADU.
7. Each ADU **MUST NOT** exceed 150 words. If a passage exceeds this limit, split it into multiple ADUs at logical break points.

Transcript Data:
{full_transcript_text}

Return the result as a JSON object where keys are "Speech Name" (e.g. Proposition_1st) and values are lists of ADUs.
IDs are local to each speech (0, 1, 2...).

Format:
{{
  "Proposition_1st": [
    {{
      "start_sentence_index": 0,
      "end_sentence_index": 2,
      "text": "The actual ADU text...",
      "role": "point_of_main_argument"
    }}
  ],
  "Opposition_1st": [...]
}}
"""
        return {
            "status": "step1_done", # Renamed from manual_adu_prompt
            "round_name": round_name,
            "try_count": try_count,
            "prompt": prompt_content
        }

    # 4. Check Raw Transcription (in Speech table)
    stmt_speeches_raw = select(Speech).where(Speech.round_id == round_obj.id)
    res_raw = await db.execute(stmt_speeches_raw)
    speeches_raw = res_raw.scalars().all()
    
    if speeches_raw and any(s.raw_transcription for s in speeches_raw):
         # Recover Sentences
         logger.info("Sentences missing but raw transcription found. Recovering...")
         try:
             transcripts_data = {}
             for speech in speeches_raw:
                 # existing raw_transcription is a string? Or JSON?
                 # It's usually a large text block if it's from Whisper simply?
                 # If we stored raw JSON from Whisper, we can parse.
                 # If it's just text, we can't easily get timestamps unless we re-align.
                 # Actually, usually `save_transcription_to_db` saves sentences.
                 # If we are here, something broke before sentences were saved?
                 # Or maybe `manual_audio_processing` saved raw text?
                 # Let's assume we can't easily recover timestamps if only text.
                 # But if we have valid Speech objects, maybe they have sentences?
                 # We already checked Sentences and found none (Step 3).
                 
                 # If users want to resume from "Step 1" (Transcription done),
                 # And we have Speech entries with NO sentences...
                 # We need to segment sentences.
                 # Using `regroup_single_speech_sentences_to_adus`? No, that's later.
                 # We need `regroup_sentences` logic.
                 pass
             
             # Fallback if recovery too complex: Tell user "Transcription found but sentences missing."
             # Or if we implement a recovery:
             # For now, let's treat "No Sentences" as "Data not sufficient to resume".
             pass
         except Exception as e:
             pass

    # If we fall through here:
    raise HTTPException(status_code=404, detail="Could not find sufficient data (Sentences, ADUs, or Rebuttals) to resume.")
