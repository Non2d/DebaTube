"""
Shared utility functions for routers
"""
import json
import csv
import re
from typing import Dict, List, Any, Optional

NA_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd", "Opposition_3rd", "Proposition_3rd"]
ASIAN_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd", "Proposition_3rd", "Opposition_3rd", "Opposition_4th", "Proposition_4th"]
BP_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd", "Proposition_3rd", "Opposition_3rd", "Proposition_4th", "Opposition_4th"]
OPENING_HALF_BP_ORDER = ["Proposition_1st", "Opposition_1st", "Proposition_2nd", "Opposition_2nd"]

DEBATE_FORMATS = {
    "NA": NA_ORDER,
    "ASIAN": ASIAN_ORDER,
    "BP": BP_ORDER,
    "OPENING_HALF_BP_ORDER": OPENING_HALF_BP_ORDER
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

def group_words_into_sentences(text: str, words_data: list, debug: bool = False) -> list:
    """
    textをピリオドで分割して、words_dataのタイムスタンプを対応付ける。
    """
    if not words_data:
        return []
    
    # words_dataをクリーンアップ（空や重複を除去）
    cleaned_words = []
    prev_word = None
    prev_start = None
    for w in words_data:
        word = w.get("word", "").strip()
        start = w.get("start", 0)
        if not word:
            continue
        if word == prev_word and start == prev_start:
            continue
        cleaned_words.append(w)
        prev_word = word
        prev_start = start
    
    # textをピリオド(. ! ?)で分割
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # デバッグ：全体の単語数比較
    if debug:
        text_word_count = len(re.findall(r"[a-zA-Z0-9']+", text.lower()))
        print(f"=== DEBUG ===")
        print(f"text単語数: {text_word_count}")
        print(f"words_data単語数（元）: {len(words_data)}")
        print(f"cleaned_words単語数: {len(cleaned_words)}")
        print(f"文の数: {len(sentences)}")
        print()
    
    result = []
    word_idx = 0
    
    for sent_id, sentence in enumerate(sentences):
        sentence_words = re.findall(r"[a-zA-Z0-9']+", sentence.lower())
        word_count = len(sentence_words)
        
        if word_idx >= len(cleaned_words):
            if debug:
                print(f"[!] 文{sent_id}で words が尽きた")
            break
        
        start_time = cleaned_words[word_idx].get("start", 0)
        end_idx = min(word_idx + word_count, len(cleaned_words)) - 1
        end_time = cleaned_words[end_idx].get("end", start_time)
        
        # デバッグ：各文の情報
        if debug:
            actual_start_word = cleaned_words[word_idx].get("word", "")
            actual_end_word = cleaned_words[end_idx].get("word", "")
            expected_start = sentence_words[0] if sentence_words else ""
            expected_end = sentence_words[-1] if sentence_words else ""
            print(f"文{sent_id}: {word_count}単語, idx {word_idx}->{end_idx}")
            print(f"  期待: '{expected_start}' ... '{expected_end}'")
            print(f"  実際: '{actual_start_word}' ... '{actual_end_word}'")
            if expected_start.lower() != actual_start_word.lower():
                print(f"  [!] 開始単語がずれてる！")
            print()
        
        result.append({
            "id": sent_id,
            "text": sentence,
            "start_time": round(start_time, 1),
            "end_time": round(end_time, 1)
        })
        
        word_idx = end_idx + 1
    
    return result

def group_words_into_sentences_old(text: str, words_data: List[Dict[str, Any]], debug: bool = False) -> List[Dict[str, Any]]:
    """
    Group word-level timestamps into sentence-level data to reduce token usage.
    Sentences are split by punctuation marks (. ? !)
    Args:
        text: Full transcript text with punctuation
        words_data: List of word-level timestamp data
        debug: Enable debug output
    Returns:
        List of sentence objects with id, text, start_time, end_time
    """
    if not words_data:
        return []
    
    # Split text into sentences using common punctuation, preserving the punctuation
    sentence_pattern = r'([.!?]+)'
    parts = re.split(sentence_pattern, text)
    
    # Combine text parts with their punctuation
    sentence_texts = []
    for i in range(0, len(parts) - 1, 2):
        if parts[i].strip():
            sentence_with_punct = parts[i].strip()
            if i + 1 < len(parts):
                sentence_with_punct += parts[i + 1]
            sentence_texts.append(sentence_with_punct)
    
    # Handle last part if it doesn't end with punctuation
    if len(parts) % 2 == 1 and parts[-1].strip():
        sentence_texts.append(parts[-1].strip())
    
    # デバッグ：全体の情報
    if debug:
        text_word_count = len(text.split())
        print(f"=== DEBUG (old) ===")
        print(f"text単語数 (split): {text_word_count}")
        print(f"words_data単語数: {len(words_data)}")
        print(f"文の数: {len(sentence_texts)}")
        print()
    
    sentences = []
    current_word_idx = 0
    
    for sentence_idx, sentence_text in enumerate(sentence_texts):
        sentence_words = sentence_text.split()
        expected_word_count = len(sentence_words)
        end_word_idx = min(current_word_idx + expected_word_count, len(words_data))
        
        if current_word_idx >= len(words_data):
            if debug:
                print(f"[!] 文{sentence_idx}で words が尽きた")
            break
        
        start_time = words_data[current_word_idx].get("start", 0)
        end_time = words_data[min(end_word_idx - 1, len(words_data) - 1)].get("end", start_time)
        
        # デバッグ：各文の情報
        if debug:
            actual_start_word = words_data[current_word_idx].get("word", "")
            actual_end_word = words_data[min(end_word_idx - 1, len(words_data) - 1)].get("word", "")
            expected_start = sentence_words[0] if sentence_words else ""
            expected_end = sentence_words[-1] if sentence_words else ""
            print(f"文{sentence_idx}: {expected_word_count}単語, idx {current_word_idx}->{end_word_idx - 1}")
            print(f"  期待: '{expected_start}' ... '{expected_end}'")
            print(f"  実際: '{actual_start_word}' ... '{actual_end_word}'")
            if expected_start.lower().strip('.,!?') != actual_start_word.lower().strip('.,!?'):
                print(f"  [!] 開始単語がずれてる！")
            if expected_end.lower().strip('.,!?') != actual_end_word.lower().strip('.,!?'):
                print(f"  [!] 終了単語がずれてる！")
            print()
        
        sentences.append({
            "id": sentence_idx,
            "text": sentence_text,
            "start_time": round(start_time, 1),
            "end_time": round(end_time, 1),
        })
        
        current_word_idx = end_word_idx
    
    return sentences

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
    speech_order: List[str]
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
    fieldnames = ["speech_key", "id", "start_sentence_index", "end_sentence_index", "text", "role", "start_time", "end_time"]

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
                        **{field: adu.get(field, "") for field in fieldnames if field != "speech_key"}
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
