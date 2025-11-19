"""
Utility/Sub APIs - Less essential endpoints for manual verification and debugging
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from log_config import logger
from pydantic import BaseModel
from typing import List, Dict, Any
import os, json, csv, time, re
from datetime import datetime
from google import genai

router = APIRouter()

# Import shared directories
from .audio2adu import ADUS_DIR, LOGS_DIR
from .utils import clean_gemini_markdown_response, DEBATE_FORMATS, group_words_into_sentences

# Initialize Gemini client
client_gemini = genai.Client()

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
    start_word_index: int
    end_word_index: int

class SentenceGroupResponse(BaseModel):
    """Response containing grouped sentences"""
    sentences: List[SentenceInfo]

# ===== Endpoints =====

@router.post("/group-sentences", response_model=SentenceGroupResponse)
async def group_sentences(request: SentenceGroupRequest):
    """
    Group word-level timestamps into sentence-level data.
    Sentences are split by punctuation marks (. ? !)

    Args:
        request: Contains full text with punctuation and word-level timestamp data

    Returns:
        SentenceGroupResponse: List of sentences with timing information
    """
    try:
        text = request.text
        words_data = [word.model_dump() for word in request.words]

        if not words_data:
            return SentenceGroupResponse(sentences=[])

        # Split text into sentences using common punctuation, preserving the punctuation
        sentence_pattern = r'([.!?]+)'
        parts = re.split(sentence_pattern, text)

        # Combine text parts with their punctuation
        sentence_texts = []
        for i in range(0, len(parts) - 1, 2):
            if parts[i].strip():
                # Combine sentence text with its punctuation
                sentence_with_punct = parts[i].strip()
                if i + 1 < len(parts):
                    sentence_with_punct += parts[i + 1]
                sentence_texts.append(sentence_with_punct)

        # Handle last part if it doesn't end with punctuation
        if len(parts) % 2 == 1 and parts[-1].strip():
            sentence_texts.append(parts[-1].strip())

        sentences = []
        current_word_idx = 0

        for sentence_text in sentence_texts:
            # Count words in this sentence (approximate by splitting on whitespace)
            sentence_words = sentence_text.split()
            expected_word_count = len(sentence_words)

            # Find the end index for this sentence
            end_word_idx = min(current_word_idx + expected_word_count, len(words_data))

            # Skip if no words in range
            if current_word_idx >= len(words_data):
                break

            # Get start and end times from the word data
            start_time = words_data[current_word_idx].get("start", 0)
            end_time = words_data[min(end_word_idx - 1, len(words_data) - 1)].get("end", start_time)

            sentences.append(SentenceInfo(
                text=sentence_text,
                start_time=round(start_time, 1),
                end_time=round(end_time, 1),
                start_word_index=current_word_idx,
                end_word_index=end_word_idx - 1
            ))

            current_word_idx = end_word_idx

        return SentenceGroupResponse(sentences=sentences)

    except Exception as e:
        logger.error(f"Error processing sentences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing sentences: {str(e)}")

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
        fieldnames = ["id", "start_sentence_index", "end_sentence_index", "text", "role", "start_time", "end_time", "confidence"]

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

        GEMINI_MODEL = "gemini-2.5-pro"

        # Prepare prompt for Gemini with sentence-level data
        response = client_gemini.models.generate_content(
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
3. Rebuttals are always independent ADUs regardless of length
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
                fieldnames = ["id", "start_sentence_index", "end_sentence_index", "text", "role", "start_time", "end_time", "confidence"]

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
