from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, RootModel
from log_config import logger
from openai import OpenAI, AsyncOpenAI
import os, json, tempfile, re, csv
from datetime import datetime
import asyncio
import time
import shutil

from google import genai
from .utils import clean_gemini_markdown_response, merge_adus_to_unified_csv, unified_csv_to_markdown, DEBATE_FORMATS, group_words_into_sentences

router = APIRouter()

# ===== Pydantic Models =====

class BatchTranscriptRequest(RootModel[Dict[str, Dict[str, Any]]]):
    """
    Batch transcription input - key-value pairs of speech transcriptions
    Directly accepts the output from /audio-to-transcript-batch without wrapper
    """
    root: Dict[str, Dict[str, Any]]

class RebuttalStructureRequest(BaseModel):
    """Request for identifying rebuttal structure from unified CSV"""
    unified_csv_path: str  # Path to unified CSV file with full ADU data

    model_config = {
        "json_schema_extra": {
            "example": {
                "unified_csv_path": "/path/to/unified_adus_NA_timestamp.csv"
            }
        }
    }

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

async def regroup_single_speech_to_adu(
    speech_key: str,
    transcript_data: Dict[str, Any],
    timestamp: str
) -> tuple[str, Optional[str], Optional[str], Optional[Any], Optional[str], Optional[str]]:
    """
    Process a single speech transcript to ADU conversion asynchronously
    Returns: (speech_key, log_path, csv_path, response_object, response_text, error_message)
    """
    try:
        transcript_text = transcript_data.get("text", "")
        words_data_raw = transcript_data.get("words", [])

        words_data = [
            {
                **word,
                "start": round(word.get("start", 0), 1),
                "end": round(word.get("end", 0), 1)
            }
            for word in words_data_raw
        ]

        sentences_data = group_words_into_sentences(transcript_text, words_data)

        GEMINI_MODEL = "gemini-2.5-pro"

        response = await asyncio.to_thread(
            client_gemini.models.generate_content,
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
- poi: During the speech, opponents can interject brief questions (called "point of information") or statements typically right after the speaker says "Yes". Please treat any such questions from opponents as a single ADU.

Segmentation Guidelines:
1. Each speaker typically has 2-3 main arguments or comparison issues, and each main argument or comparison issue contains 3-5 points
2. Main arguments and comparison issues are equally valid argumentative structures and can coexist in the same speech (e.g., a speaker might present 2 main arguments and 1 comparison issue)
3. Rebuttals are always independent ADUs regardless of length
4. Group sentences discussing the same specific argumentative point into one ADU
5. Treat any POI as a single independent ADU.
6. Treat a response to a POI as a single ADU.

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
      "role": "independent_rebuttal/point_of_main_argument/etc",
      "start_time": 0.0,
      "end_time": 2.5,
    }}
  ]
}}

Note: Use start_sentence_index and end_sentence_index instead of word indices.
Focus on semantic units of argumentation. Be precise with sentence indices and timestamps.
"""
        )

        response_text = response.text if hasattr(response, 'text') else str(response)

        try:
            raw_response_dict = type(response).to_dict(response) if hasattr(type(response), 'to_dict') else str(response)
        except:
            raw_response_dict = str(response)

        log_filename = f"adu_conversion_{speech_key}_{timestamp}.json"
        log_path = os.path.join(LOGS_DIR, log_filename)

        log_data = {
            "timestamp": timestamp,
            "speech_key": speech_key,
            "input_transcript": transcript_data,
            "gemini_response": response_text,
            "raw_response": raw_response_dict,
            "model": GEMINI_MODEL
        }

        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)
        logger.info(f"ADU conversion log saved to {log_path}")

        csv_filename = f"{speech_key}_{timestamp}.csv"
        csv_path = os.path.join(ADUS_DIR, csv_filename)

        try:
            cleaned_response = clean_gemini_markdown_response(response_text)
            adu_json = json.loads(cleaned_response)
            adus_list = adu_json.get("adus", [])

            if adus_list:
                fieldnames = ["id", "start_sentence_index", "end_sentence_index", "text", "role", "start_time", "end_time", "confidence"]

                with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames, restval="")
                    writer.writeheader()

                    for adu in adus_list:
                        row = {field: adu.get(field, "") for field in fieldnames}
                        writer.writerow(row)

                logger.info(f"ADU CSV saved to {csv_path}")
            else:
                logger.warning(f"No ADUs found in Gemini response for {speech_key}")
                csv_path = None

        except json.JSONDecodeError as json_error:
            logger.error(f"Error parsing Gemini response as JSON for {speech_key}: {str(json_error)}")
            csv_path = None
        except Exception as csv_error:
            logger.error(f"Error saving CSV file for {speech_key}: {str(csv_error)}")
            csv_path = None

        return (speech_key, log_path, csv_path, raw_response_dict, response_text, None)

    except Exception as e:
        error_msg = f"Error processing {speech_key}: {str(e)}"
        logger.error(error_msg)
        return (speech_key, None, None, None, None, error_msg)

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
    start_time = time.time()
    print(f"[/audio-to-transcript-batch] 処理開始")
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

        elapsed_time = time.time() - start_time
        print(f"[/audio-to-transcript-batch] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "files_processed": len(batch_results),
            "batch_results": batch_results,
            "saved_to": output_path,
            "transcription_dir": TRANSCRIPTION_DIR,
            "file_exists": os.path.exists(output_path),
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/audio-to-transcript-batch] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during batch transcription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch transcription failed: {str(e)}")

@router.post("/transcript-to-adu-batch")
async def transcript_to_adu_batch(
    batch_request: BatchTranscriptRequest,
    debate_format: str = "NA"
):
    """
    Convert multiple speech transcriptions to ADUs in parallel using Gemini API
    - Input: JSON object with speech keys and their transcription data
    - Output: Individual CSV files for each speech + one unified CSV with all ADUs in debate order
    - Processing: Asynchronous parallel processing with Gemini API

    Parameters:
    - batch_request: Dictionary of speech transcriptions (from /audio-to-transcript-batch)
    - debate_format: Debate format to determine speech order ("NA", "ASIAN", or "BP"). Default: "NA"
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
                detail=f"Invalid debate_format. Must be one of: {', '.join(DEBATE_FORMATS.keys())}"
            )

        speech_order = DEBATE_FORMATS[debate_format]

        # Generate a shared timestamp for this batch
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]

        # Create tasks for parallel processing
        tasks = [
            regroup_single_speech_to_adu(speech_key, transcript_data, timestamp)
            for speech_key, transcript_data in transcripts.items()
        ]

        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks)

        # Collect results
        successful_speeches = []
        failed_speeches = []
        csv_files = []
        all_responses = {}
        all_raw_responses = {}
        adus_by_speech = {}

        for speech_key, log_path, csv_path, raw_response, response_text, error_msg in results:
            if error_msg:
                failed_speeches.append({
                    "speech_key": speech_key,
                    "error": error_msg
                })
            else:
                successful_speeches.append({
                    "speech_key": speech_key,
                    "log_path": log_path,
                    "csv_path": csv_path,
                    "csv_exists": os.path.exists(csv_path) if csv_path else False
                })
                if csv_path:
                    csv_files.append(csv_path)
                if response_text:
                    all_responses[speech_key] = response_text
                    # Parse ADUs for unified CSV
                    try:
                        cleaned_response = clean_gemini_markdown_response(response_text)
                        adu_json = json.loads(cleaned_response)
                        adus_by_speech[speech_key] = adu_json.get("adus", [])
                    except (json.JSONDecodeError, Exception) as parse_error:
                        logger.warning(f"Failed to parse ADUs for {speech_key}: {str(parse_error)}")
                if raw_response:
                    all_raw_responses[speech_key] = raw_response

        # Create unified CSV with all ADUs in debate order
        unified_csv_path = None
        unified_md_path = None
        total_adus_written = 0
        if adus_by_speech:
            unified_csv_filename = f"unified_adus_{debate_format}_{timestamp}.csv"
            unified_csv_path = os.path.join(ADUS_DIR, unified_csv_filename)
            try:
                total_adus_written = merge_adus_to_unified_csv(
                    adus_by_speech=adus_by_speech,
                    output_path=unified_csv_path,
                    speech_order=speech_order
                )
                logger.info(f"Unified CSV created: {unified_csv_path} ({total_adus_written} ADUs)")

                # Generate Markdown from unified CSV
                unified_md_filename = f"unified_adus_{debate_format}_{timestamp}.md"
                unified_md_path = os.path.join(ADUS_DIR, unified_md_filename)
                try:
                    total_adus_in_md = unified_csv_to_markdown(
                        csv_path=unified_csv_path,
                        output_path=unified_md_path
                    )
                    logger.info(f"Unified MD created: {unified_md_path} ({total_adus_in_md} ADUs)")
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
            "unified_csv_exists": os.path.exists(unified_csv_path) if unified_csv_path else False,
            "unified_md_path": unified_md_path,
            "unified_md_exists": os.path.exists(unified_md_path) if unified_md_path else False,
            "total_adus_in_unified_csv": total_adus_written,
            "debate_format": debate_format,
            "speech_order": speech_order,
            "adus_dir": ADUS_DIR,
            "logs_dir": LOGS_DIR,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/transcript-to-adu-batch] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during batch ADU conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch ADU conversion failed: {str(e)}")

@router.post("/identify-rebuttal-structure")
async def identify_rebuttal_structure(request: RebuttalStructureRequest):
    """
    注意：csvとmdが同じディレクトリにあることを前提としています。
    Identify rebuttal structure from unified CSV file
    - Input: Path to unified CSV file with ADU data
    - Output: {speeches: {...}, rebuttals: [[rebutting_id, rebutted_id], ...]}
    - Uses Gemini API to analyze rebuttal relationships
    - Saves result as JSON file
    """
    start_time = time.time()
    print(f"[/identify-rebuttal-structure] 処理開始")

    try:
        csv_path = request.unified_csv_path

        # Convert relative path to absolute path based on APP_DIR
        if not os.path.isabs(csv_path):
            # If path starts with 'app/', resolve from parent of APP_DIR
            if csv_path.startswith('app/'):
                csv_path = os.path.join(os.path.dirname(APP_DIR), csv_path)
            else:
                # Otherwise, resolve from current working directory
                csv_path = os.path.abspath(csv_path)

        # Validate CSV file exists
        if not os.path.exists(csv_path):
            raise HTTPException(status_code=404, detail=f"CSV file not found: {csv_path}")

        GEMINI_MODEL = "gemini-2.5-pro"

        # Read CSV file to get full ADU data and build markdown for Gemini
        speeches_data = {}
        markdown_lines = []
        current_speech = None
        global_id_counter = 1  # グローバルIDカウンター

        with open(csv_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)

            for row in reader:
                speech_key = row.get("speech_key", "")
                local_adu_id = int(row.get("id", 0))  # CSVのローカルID
                text = row.get("text", "")
                role = row.get("role", "")
                start_time = float(row.get("start_time", 0))

                # Build speeches data structure
                if speech_key not in speeches_data:
                    speeches_data[speech_key] = []

                # Format: {id, type, text, start} - グローバルIDを使用
                adu_data = {
                    "id": global_id_counter,  # グローバルID
                    "type": role,  # role -> type
                    "text": text,
                    "start": start_time  # start_time -> start
                }
                speeches_data[speech_key].append(adu_data)

                # Build markdown for Gemini - グローバルIDを使用
                if speech_key != current_speech:
                    if current_speech is not None:
                        markdown_lines.append("")  # Blank line between speeches
                    markdown_lines.append(f"## {speech_key}")
                    markdown_lines.append("")
                    current_speech = speech_key

                markdown_lines.append(f"id:{global_id_counter}, {text}")
                markdown_lines.append("")

                global_id_counter += 1  # グローバルIDをインクリメント

        transcript = "\n".join(markdown_lines)
        logger.info(f"Loaded {sum(len(v) for v in speeches_data.values())} ADUs from CSV")

        # Prepare prompt for Gemini
        prompt = f"""## Instruction
The following text is a transcript from a parliamentary competitive debate. From this transcript, extract all explicit rebuttal pairs.

## Rebuttal Condition
- A rebuttal must reference the content of an argument made by the opposing team. Expressions like “They said …” are commonly used but not strictly required. The link can also be clear from context or topic.
- A rebuttal must negate, weaken, or challenge the opposing argument. Statements that are too vague or generic can neither serve as rebuttals nor be treated as valid rebuttal targets.
- A rebuttal can only target a statement made previously by the opposing team, and thus Proposition 1st must not rebut at all.

## Transcript
{transcript}

## Output Format
Return ONLY a JSON array of pairs in this exact format.
Example: [[5, 2], [7, 3], [12, 8]]

Do not include any other text, explanation, or formatting."""

        # Call Gemini API
        response = await asyncio.to_thread(
            client_gemini.models.generate_content,
            model=GEMINI_MODEL,
            contents=prompt
        )

        # Extract response text
        response_text = response.text if hasattr(response, 'text') else str(response)

        # Parse the response to extract rebuttal pairs
        try:
            cleaned_response = clean_gemini_markdown_response(response_text)
            rebuttal_pairs = json.loads(cleaned_response)

            if not isinstance(rebuttal_pairs, list):
                raise ValueError("Response is not a list")

            # Validate format
            for pair in rebuttal_pairs:
                if not isinstance(pair, list) or len(pair) != 2:
                    raise ValueError(f"Invalid pair format: {pair}")

        except (json.JSONDecodeError, ValueError) as parse_error:
            logger.error(f"Error parsing rebuttal pairs: {str(parse_error)}")
            logger.error(f"Raw response: {response_text}")
            rebuttal_pairs = []

        # Build result in requested format
        result = {
            "speeches": speeches_data,
            "rebuttals": rebuttal_pairs
        }

        # Save result as JSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
        result_filename = f"rebuttal_graph_{timestamp}.json"
        result_path = os.path.join(ADUS_DIR, result_filename)

        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        logger.info(f"Rebuttal graph saved to {result_path}")

        # Save log
        log_filename = f"rebuttal_structure_{timestamp}.json"
        log_path = os.path.join(LOGS_DIR, log_filename)

        # Convert response object to dict for JSON serialization
        try:
            raw_response_dict = type(response).to_dict(response) if hasattr(type(response), 'to_dict') else str(response)
        except:
            raw_response_dict = str(response)

        log_data = {
            "timestamp": timestamp,
            "csv_path": csv_path,
            "input_transcript_length": len(transcript),
            "gemini_response": response_text,
            "raw_response": raw_response_dict,
            "model": GEMINI_MODEL
        }

        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)
        logger.info(f"Rebuttal structure log saved to {log_path}")

        elapsed_time = time.time() - start_time
        print(f"[/identify-rebuttal-structure] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "speeches": speeches_data,
            "rebuttals": rebuttal_pairs,
            "total_speeches": len(speeches_data),
            "total_adus": sum(len(v) for v in speeches_data.values()),
            "total_rebuttal_pairs": len(rebuttal_pairs),
            "result_saved_to": result_path,
            "result_exists": os.path.exists(result_path),
            "log_saved_to": log_path,
            "log_exists": os.path.exists(log_path),
            "model": GEMINI_MODEL,
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/identify-rebuttal-structure] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during rebuttal structure identification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Rebuttal structure identification failed: {str(e)}")

class AudioToDebateGraphRequest(BaseModel):
    """Request for converting audio to debate graph"""
    match_name: str
    debate_format: str = "NA"

@router.post("/audio-to-debate-graph-batch")
async def audio_to_debate_graph_batch(
    files: List[UploadFile] = File(...),
    match_name: str = Form("default"),
    debate_format: str = Form("NA")
):
    """
    統合エンドポイント: 音声ファイルをディベートグラフに変換
    - 入力: 複数の音声ファイル
    - 処理:
      1. 音声を文字起こし
      2. ADUに変換
      3. 反論構造を抽出
    - 出力: audio-save/{match_name}/results/ に全ての結果を保存
    """
    start_time = time.time()
    print(f"[/audio-to-debate-graph-batch] 処理開始 - match_name: {match_name}, format: {debate_format}")

    # 出力ディレクトリの作成
    RESULTS_DIR = os.path.join(TRANSCRIPTION_DIR, f"results_{match_name}")
    os.makedirs(RESULTS_DIR, exist_ok=True)
    logger.info(f"Results directory: {RESULTS_DIR}")

    try:
        # Step 1: 音声を文字起こし
        print("[Step 1/3] 音声の文字起こしを開始...")
        transcription_response = await audio_to_transcript_batch(files)

        if transcription_response["status"] != "success":
            raise Exception(f"Transcription failed: {transcription_response}")

        batch_results = transcription_response["batch_results"]
        print(f"[Step 1/3] 文字起こし完了: {len(batch_results)} ファイル")

        # 文字起こし結果をファイルに保存
        transcript_filename = f"batch_transcription_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-5]}.json"
        transcript_path = os.path.join(RESULTS_DIR, transcript_filename)
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(batch_results, f, ensure_ascii=False, indent=2)
        logger.info(f"Transcription results saved to {transcript_path}")

        # Step 2: ADUに変換
        print("[Step 2/3] ADU変換を開始...")
        adu_request = BatchTranscriptRequest(root=batch_results)
        adu_response = await transcript_to_adu_batch(adu_request, debate_format)

        if adu_response["status"] not in ["success", "partial_success"]:
            raise Exception(f"ADU conversion failed: {adu_response}")

        print(f"[Step 2/3] ADU変換完了: {adu_response['total_adus_in_unified_csv']} ADUs")

        # ADU結果をコピーして結果ディレクトリに配置
        unified_csv_path = adu_response["unified_csv_path"]
        unified_md_path = adu_response["unified_md_path"]

        if unified_csv_path and os.path.exists(unified_csv_path):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-5]
            csv_filename = f"unified_adus_{debate_format}_{timestamp}.csv"
            csv_dest = os.path.join(RESULTS_DIR, csv_filename)
            shutil.copy(unified_csv_path, csv_dest)
            logger.info(f"Unified CSV copied to {csv_dest}")
            unified_csv_path = csv_dest

        if unified_md_path and os.path.exists(unified_md_path):
            md_filename = f"unified_adus_{debate_format}_{timestamp}.md"
            md_dest = os.path.join(RESULTS_DIR, md_filename)
            shutil.copy(unified_md_path, md_dest)
            logger.info(f"Unified MD copied to {md_dest}")
            unified_md_path = md_dest

        # Step 3: 反論構造を抽出
        print("[Step 3/3] 反論構造の抽出を開始...")
        if not unified_csv_path or not os.path.exists(unified_csv_path):
            raise Exception(f"Unified CSV not found: {unified_csv_path}")

        rebuttal_request = RebuttalStructureRequest(unified_csv_path=unified_csv_path)
        rebuttal_response = await identify_rebuttal_structure(rebuttal_request)

        if rebuttal_response["status"] != "success":
            raise Exception(f"Rebuttal structure identification failed: {rebuttal_response}")

        print(f"[Step 3/3] 反論構造抽出完了: {rebuttal_response['total_rebuttal_pairs']} rebuttal pairs")

        # 反論構造グラフを結果ディレクトリにコピー
        rebuttal_graph_path = rebuttal_response["result_saved_to"]
        if rebuttal_graph_path and os.path.exists(rebuttal_graph_path):
            graph_filename = f"rebuttal_graph_{timestamp}.json"
            graph_dest = os.path.join(RESULTS_DIR, graph_filename)
            shutil.copy(rebuttal_graph_path, graph_dest)
            logger.info(f"Rebuttal graph copied to {graph_dest}")
            rebuttal_graph_path = graph_dest

        elapsed_time = time.time() - start_time
        print(f"[/audio-to-debate-graph-batch] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "match_name": match_name,
            "debate_format": debate_format,
            "results_directory": RESULTS_DIR,
            "transcription_file": transcript_path,
            "unified_csv_file": unified_csv_path,
            "unified_md_file": unified_md_path,
            "rebuttal_graph_file": rebuttal_graph_path,
            "summary": {
                "files_transcribed": len(batch_results),
                "total_adus": adu_response["total_adus_in_unified_csv"],
                "total_rebuttal_pairs": rebuttal_response["total_rebuttal_pairs"],
                "speeches": rebuttal_response["total_speeches"]
            },
            "processing_time_seconds": round(elapsed_time, 2)
        }

    except Exception as e:
        elapsed_time = time.time() - start_time
        print(f"[/audio-to-debate-graph-batch] エラーで終了 - 処理時間: {elapsed_time:.2f}秒")
        logger.error(f"Error during audio to debate graph conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio to debate graph conversion failed: {str(e)}")

@router.get("/rebuttal-graph/{match_name}")
async def get_rebuttal_graph(match_name: str):
    """
    Get the rebuttal graph JSON for a specific match
    - Reads from audio-save/{match_name}/ directory (primary)
    - Falls back to transcriptions/results_{match_name}/ or transcriptions/adus/
    - Returns the latest rebuttal_graph_*.json file
    """
    try:
        graph_files = []
        graph_path = None

        # Search order:
        # 1. audio-save/{match_name}/
        # Docker: /app/audio-save, Local: ../audio-save
        audio_save_dir = os.path.join(os.path.dirname(APP_DIR), "audio-save", match_name)
        if os.path.exists(audio_save_dir):
            graph_files = sorted([f for f in os.listdir(audio_save_dir) if f.startswith('rebuttal_graph_') and f.endswith('.json')], reverse=True)
            if graph_files:
                graph_path = os.path.join(audio_save_dir, graph_files[0])

        # 2. transcriptions/results_{match_name}/
        if not graph_path:
            results_dir = os.path.join(TRANSCRIPTION_DIR, f"results_{match_name}")
            if os.path.exists(results_dir):
                graph_files = sorted([f for f in os.listdir(results_dir) if f.startswith('rebuttal_graph_') and f.endswith('.json')], reverse=True)
                if graph_files:
                    graph_path = os.path.join(results_dir, graph_files[0])

        # # 3. transcriptions/adus/ (latest)
        # if not graph_path:
        #     adus_dir = ADUS_DIR
        #     if os.path.exists(adus_dir):
        #         all_graph_files = sorted([f for f in os.listdir(adus_dir) if f.startswith('rebuttal_graph_') and f.endswith('.json')], reverse=True)
        #         if all_graph_files:
        #             graph_path = os.path.join(adus_dir, all_graph_files[0])

        if not graph_path:
            raise HTTPException(status_code=404, detail=f"No rebuttal graph found for match: {match_name}")

        with open(graph_path, 'r', encoding='utf-8') as f:
            graph_data = json.load(f)

        logger.info(f"Rebuttal graph loaded from {graph_path}")

        return {
            "status": "success",
            "match_name": match_name,
            "graph_file": os.path.basename(graph_path),
            "data": graph_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get rebuttal graph: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get rebuttal graph: {str(e)}")
