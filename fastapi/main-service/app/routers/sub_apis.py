"""
Utility/Sub APIs - Less essential endpoints for manual verification and debugging
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from log_config import logger
import os, json, csv
from datetime import datetime

router = APIRouter()

# Import shared directories
from .audio2adu import ADUS_DIR
from .utils import clean_gemini_markdown_response

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
        fieldnames = ["id", "start_word_index", "end_word_index", "text", "role", "start_time", "end_time", "confidence"]

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
