"""
Shared utility functions for routers
"""
import json
from typing import Dict, List, Any, Optional


def clean_gemini_markdown_response(response_text: str) -> str:
    """
    Remove markdown code block formatting from Gemini response
    Handles formats like:
    - ```json ... ```
    - ``` ... ```

    Args:
        response_text: Raw response text from Gemini API

    Returns:
        Cleaned response text without markdown formatting
    """
    cleaned_response = response_text.strip()

    # Remove leading ```json or ```
    if cleaned_response.startswith("```json"):
        cleaned_response = cleaned_response[7:]  # Remove ```json
    elif cleaned_response.startswith("```"):
        cleaned_response = cleaned_response[3:]  # Remove ```

    # Remove trailing ```
    if cleaned_response.endswith("```"):
        cleaned_response = cleaned_response[:-3]

    # Strip whitespace and newlines
    return cleaned_response.strip()


def parse_gemini_adu_response(response_text: str) -> Optional[List[Dict[str, Any]]]:
    """
    Parse Gemini ADU response and extract ADUs list

    Args:
        response_text: Raw response text from Gemini API

    Returns:
        List of ADU dictionaries, or None if parsing fails
    """
    try:
        cleaned_response = clean_gemini_markdown_response(response_text)
        adu_json = json.loads(cleaned_response)
        return adu_json.get("adus", []) if isinstance(adu_json, dict) else []
    except (json.JSONDecodeError, AttributeError) as e:
        return None
