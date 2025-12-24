from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, RootModel
from log_config import logger
from openai import OpenAI, AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
import os, json, tempfile, re, csv
from datetime import datetime
import asyncio
import time
import shutil

from google import genai
from .utils import (
    clean_gemini_markdown_response,
    merge_adus_to_unified_csv,
    unified_csv_to_markdown,
    DEBATE_FORMATS,
    group_words_into_sentences,
)
from db import get_db
from cruds import round as round_crud

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

    model_config = {
        "json_schema_extra": {
            "example": {"round_name": "WAD_1211_R2", "try_count": 1}
        }
    }


# OpenAI client初期化
client = OpenAI()
async_client = AsyncOpenAI()
client_gemini = genai.Client()

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

        GEMINI_MODEL = "gemini-2.5-flash"

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
""",
        )

        response_text = response.text if hasattr(response, "text") else str(response)

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


async def transcribe_single_audio(
    file: UploadFile,
) -> tuple[str, str, Optional[Dict[str, Any]]]:
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
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=os.path.splitext(file.filename)[1]
        ) as temp_file:
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
                    language="en",
                )
        finally:
            os.unlink(temp_file_path)

        trans_dict = transcription.model_dump()
        result = {
            "date_transcribed": date_transcribed,
            "duration": trans_dict.get("duration", 0),
            "language": trans_dict.get("language", ""),
            **trans_dict,
        }

        logger.info(f"Transcribed: {speech_key} (from {file.filename})")
        return speech_key, date_transcribed, result

    except Exception as file_error:
        logger.error(f"Error processing file {file.filename}: {str(file_error)}")
        return "", "", None


@router.post("/audio-to-transcript-batch")
async def audio_to_transcript_batch(
    files: List[UploadFile] = File(...), match_name: str = Form("default")
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
        tasks = [transcribe_single_audio(file) for file in files]
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


@router.post("/identify-rebuttal-structure")
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

        # DBからスピーチとADUを取得
        speeches = await round_crud.get_speeches_by_round(db, round_name, try_count=try_count)
        if not speeches:
            raise HTTPException(
                status_code=404, detail=f"No speeches found for round {round_name}"
            )

        GEMINI_MODEL = "gemini-2.5-flash"

        # Build speeches data structure and markdown for Gemini
        speeches_data = {}
        markdown_lines = []
        position_order = []  # スピーチの順序を保持
        
        # Mapping for sequential ID (1-based) to DB ID
        local_id_to_db_id = {}
        global_adu_index = 0

        for speech in speeches:
            speech_key = speech.position
            position_order.append(speech_key)
            speeches_data[speech_key] = []

            # そのスピーチのADU、文、単語を取得
            adus = await round_crud.get_adus_by_speech(db, speech.id)
            sentences = await round_crud.get_sentences_by_speech(db, speech.id)
            words = await round_crud.get_words_by_speech(db, speech.id)

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
                    "id": adu.id,  # DBの自動生成ID (Client/API still sees DB ID)
                    "type": adu.role,
                    "text": adu.text,
                    "start": round(start_time, 1),  # 小数第1位に丸める
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

        # Call Gemini API
        response = await asyncio.to_thread(
            client_gemini.models.generate_content, model=GEMINI_MODEL, contents=prompt
        )

        # Extract response text
        response_text = response.text if hasattr(response, "text") else str(response)

        # Parse the response to extract rebuttal pairs
        rebuttal_pairs = [] # Final list with DB IDs
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
                     rebuttal_pairs.append([db_src, db_tgt])
                     formatted_pairs.append(f"{local_src}->{local_tgt}({db_src}->{db_tgt})")
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
        result = {"speeches": speeches_data, "rebuttals": rebuttal_pairs}

        elapsed_time = time.time() - start_time
        print(
            f"[/identify-rebuttal-structure] 処理完了 - 処理時間: {elapsed_time:.2f}秒"
        )

        return {
            "status": "success",
            "round_name": round_name,
            "speeches": speeches_data,
            "rebuttals": rebuttal_pairs,
            "total_speeches": len(speeches_data),
            "total_adus": total_adus,
            "total_rebuttal_pairs": len(rebuttal_pairs),
            "model": GEMINI_MODEL,
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


class AudioToDebateGraphRequest(BaseModel):
    """Request for converting audio to debate graph"""

    debate_format: str = "NA"


@router.post("/audio-to-debate-graph-batch")
async def audio_to_debate_graph_batch(
    files: List[UploadFile] = File(...),
    debate_format: str = Form("NA"),
    round_name: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    統合エンドポイント: 音声ファイルをディベートグラフに変換（DB保存版）
    - 入力: 複数の音声ファイル
    - 処理:
      1. ラウンドを作成
      2. 音声を文字起こし → DBに保存
      3. ADUに変換 → DBに保存
      4. 反論構造を抽出 → DBに保存
    - 出力: すべてデータベースに保存
    """
    start_time = time.time()
    print(f"[/audio-to-debate-graph-batch] 処理開始 - name: {round_name}, format: {debate_format}")

    try:
        # Validate debate format
        if debate_format not in DEBATE_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid debate_format. Must be one of: {', '.join(DEBATE_FORMATS.keys())}",
            )

        speech_order = DEBATE_FORMATS[debate_format]

        # Step 1: ラウンドを作成
        print("[Step 1/5] ラウンドを作成...")
        round_obj = await round_crud.create_round(db, name=round_name)
        logger.info(f"Created round with name '{round_name}'")

        # Step 2: 音声を文字起こし
        print("[Step 2/5] 音声の文字起こしを開始...")
        tasks = [transcribe_single_audio(file) for file in files]
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
        for speech_key, trans_data in batch_results.items():
            # audio_pathを設定（audio-save/{round_name}/{speech_key}.webm）
            audio_path = f"{round_name}/{speech_key}.webm"

            speech_obj = await round_crud.create_speech(
                db,
                round_name=round_name,
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

        # 各スピーチのADUを生成（並列処理）
        tasks = [
            regroup_single_speech_sentences_to_adus(k, v, timestamp, round_name)
            for k, v in batch_results.items()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # ADUをDBに保存
        total_adus_saved = 0
        for (speech_key, log_path, csv_path, raw_response, response_text, error_msg, adus_with_timestamps, sentences_data, words_data) in results:
            if error_msg:
                logger.error(f"Failed to process {speech_key}: {error_msg}")
                continue

            if not adus_with_timestamps:
                logger.warning(f"No ADUs generated for {speech_key}")
                continue

            speech_id = speech_id_map.get(speech_key)
            if not speech_id:
                logger.error(f"No speech_id found for {speech_key}")
                continue

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

            # Save ADUs
            adus_data = [
                {
                    "speech_id": speech_id,
                    "start_sentence_index": adu.get("start_sentence_index"),
                    "end_sentence_index": adu.get("end_sentence_index"),
                    "text": adu.get("text"),
                    "role": adu.get("role")
                }
                for adu in adus_with_timestamps
            ]

            # バッチでDB保存
            saved_adus = await round_crud.create_adus_batch(db, adus_data)
            total_adus_saved += len(saved_adus)
            logger.info(f"Saved {len(words_to_create)} words, {len(sentences_to_create)} sentences, {len(saved_adus)} ADUs for {speech_key}")

        print(f"[Step 4/5] ADU変換完了: {total_adus_saved} ADUs")

        # Step 5: 反論構造を抽出してDBに保存
        print("[Step 5/5] 反論構造の抽出を開始...")
        rebuttal_request = RebuttalStructureRequest(round_name=round_name, try_count=round_obj.try_count)
        rebuttal_response = await identify_rebuttal_structure(rebuttal_request, db)

        if rebuttal_response["status"] != "success":
            raise Exception(f"Rebuttal structure identification failed: {rebuttal_response}")

        print(f"[Step 5/5] 反論構造抽出完了: {rebuttal_response['total_rebuttal_pairs']} rebuttal pairs")

        elapsed_time = time.time() - start_time
        print(f"[/audio-to-debate-graph-batch] 処理完了 - 処理時間: {elapsed_time:.2f}秒")

        return {
            "status": "success",
            "round_name": round_name,
            "try_count": round_obj.try_count,
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
