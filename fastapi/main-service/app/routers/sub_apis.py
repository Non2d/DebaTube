"""
Utility/Sub APIs - Less essential endpoints for manual verification and debugging
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from log_config import logger
from pydantic import BaseModel
from typing import List, Dict, Any
import os, json, csv, re
from datetime import datetime

router = APIRouter()

# Import shared directories
from .audio2adu import ADUS_DIR
from .utils import clean_gemini_markdown_response

# ===== Pydantic Models for Sentence Grouping =====

class WordInfo(BaseModel):
    """Word-level timing information"""
    word: str
    start: float
    end: float

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
