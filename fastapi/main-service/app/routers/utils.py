"""
Shared utility functions for routers
"""

import json
import csv
import re
from typing import Dict, List, Any, Optional

NA_ORDER = [
    "Proposition_1st",
    "Opposition_1st",
    "Proposition_2nd",
    "Opposition_2nd",
    "Opposition_3rd",
    "Proposition_3rd",
]
ASIAN_ORDER = [
    "Proposition_1st",
    "Opposition_1st",
    "Proposition_2nd",
    "Opposition_2nd",
    "Proposition_3rd",
    "Opposition_3rd",
    "Opposition_4th",
    "Proposition_4th",
]
BP_ORDER = [
    "Proposition_1st",
    "Opposition_1st",
    "Proposition_2nd",
    "Opposition_2nd",
    "Proposition_3rd",
    "Opposition_3rd",
    "Proposition_4th",
    "Opposition_4th",
]
OPENING_HALF_BP_ORDER = [
    "Proposition_1st",
    "Opposition_1st",
    "Proposition_2nd",
    "Opposition_2nd",
]

DEBATE_FORMATS = {
    "NA": NA_ORDER,
    "ASIAN": ASIAN_ORDER,
    "BP": BP_ORDER,
    "OPENING_HALF_BP_ORDER": OPENING_HALF_BP_ORDER,
}


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


def group_words_into_sentences(
    text: str, words_data: list, max_words: int = 70, min_words: int = 5
) -> list:
    """
    textをピリオドで分割して、words_dataのタイムスタンプを対応付ける。
    文が max_words 単語以上になったら、次のカンマまたは接続詞で強制的に区切る。
    文が min_words 単語以下なら前の文に統合する。
    """
    conjunctions = {
        "however", "therefore", "moreover", "furthermore", "while",
        "otherwise", "thus", "hence", "accordingly", "consequently", "instead",
    }
    
    # 区切り位置を決定
    split_positions = []  # (char_index, word_count_at_split)
    word_count = 0
    
    for i, char in enumerate(text):
        if char.isalnum() or char == "'":
            if i == 0 or not (text[i - 1].isalnum() or text[i - 1] == "'"):
                word_count += 1
        
        starts_conjunction = False
        if char == " ":
            for conj in conjunctions:
                if text[i + 1 : i + 1 + len(conj)].lower() == conj:
                    end_pos = i + 1 + len(conj)
                    if end_pos >= len(text) or not (text[end_pos].isalnum() or text[end_pos] == "'"):
                        starts_conjunction = True
                        break
        
        is_split = char in ".!?" or (word_count >= max_words and (char == "," or starts_conjunction))
        
        if is_split and word_count > 0:
            split_positions.append((i, word_count))
            word_count = 0
    
    # 最後に残りがあれば追加
    if word_count > 0:
        split_positions.append((len(text) - 1, word_count))
    
    # 短いセグメントを前に統合
    merged_positions = []
    for pos, wc in split_positions:
        if wc <= min_words and merged_positions:
            prev_pos, prev_wc = merged_positions.pop()
            merged_positions.append((pos, prev_wc + wc))
        else:
            merged_positions.append((pos, wc))
    
    # 区切り位置が確定，セグメントを生成
    segments = []
    segment_start = 0
    word_idx = 0
    for pos, wc in merged_positions:
        sent = text[segment_start : pos + 1].strip()
        if sent:
            segments.append((sent, word_idx, wc))
            word_idx += wc
        segment_start = pos + 1
    
    # result生成
    result = []
    for idx, (sent, w_idx, w_count) in enumerate(segments):
        if w_idx >= len(words_data):
            break
        end_idx = min(w_idx + w_count, len(words_data)) - 1
        result.append({
            "id": idx,
            "text": sent,
            "start_time": round(words_data[w_idx].get("start", 0), 1),
            "end_time": round(words_data[end_idx].get("end", 0), 1),
        })
    return result


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


def merge_adus_to_unified_csv(
    adus_by_speech: Dict[str, List[Dict[str, Any]]],
    output_path: str,
    speech_order: List[str],
) -> int:
    """
    Merge ADUs from multiple speeches into a single unified CSV file

    Args:
        adus_by_speech: Dictionary mapping speech_key to list of ADUs
        output_path: Path where the unified CSV will be saved
        speech_order: Ordered list of speech keys (e.g., NA_ORDER, ASIAN_ORDER, BP_ORDER)

    Returns:
        Total number of ADUs written to the CSV
    """
    fieldnames = [
        "speech_key",
        "id",
        "start_sentence_index",
        "end_sentence_index",
        "text",
        "role",
        "start_time",
        "end_time",
    ]

    total_adus = 0

    with open(output_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, restval="")
        writer.writeheader()

        # Write ADUs in the specified order
        for speech_key in speech_order:
            if speech_key in adus_by_speech:
                adus_list = adus_by_speech[speech_key]
                for adu in adus_list:
                    row = {
                        "speech_key": speech_key,
                        **{
                            field: adu.get(field, "")
                            for field in fieldnames
                            if field != "speech_key"
                        },
                    }
                    writer.writerow(row)
                    total_adus += 1

    return total_adus


def unified_csv_to_markdown(csv_path: str, output_path: str) -> int:
    """
    Convert unified CSV to Markdown format with sequential numbering

    Format:
    ## Proposition_1st
    id:1, text content...
    id:2, text content...

    ## Opposition_1st
    id:3, text content...

    Args:
        csv_path: Path to the unified CSV file
        output_path: Path where the markdown file will be saved

    Returns:
        Total number of ADUs written
    """
    total_adus = 0
    current_speech = None
    markdown_lines = []

    with open(csv_path, "r", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)

        for row in reader:
            speech_key = row.get("speech_key", "")
            text = row.get("text", "")

            # Add speech header when speech changes
            if speech_key != current_speech:
                if current_speech is not None:
                    markdown_lines.append("")  # Add blank line between speeches
                markdown_lines.append(f"## {speech_key}")
                markdown_lines.append("")
                current_speech = speech_key

            # Add ADU with sequential numbering (total_adus + 1)
            total_adus += 1
            markdown_lines.append(f"id:{total_adus}, {text}")
            markdown_lines.append("")

    # Write to markdown file
    with open(output_path, "w", encoding="utf-8") as mdfile:
        mdfile.write("\n".join(markdown_lines))

    return total_adus
