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

import re

def group_words_into_sentences(text: str, words_data: list) -> list:
    """
    textの句読点情報とwords_dataのタイムスタンプを組み合わせて分割する。
    """
    if not words_data:
        return []
    
    # 設定
    MIN_WORDS_PER_SEGMENT = 8
    MAX_WORDS_PER_SEGMENT = 40
    PAUSE_THRESHOLD = 0.8
    
    # textから単語と句読点の情報を抽出
    # 例: "Hello, world." -> [("Hello", ","), ("world", ".")]
    token_pattern = r"(\S+?)([.,!?;:]*)\s*"
    text_tokens = []
    for match in re.finditer(token_pattern, text):
        word = match.group(1)
        punctuation = match.group(2)
        text_tokens.append((word, punctuation))
    
    # words_dataと text_tokensを対応付ける
    # words_dataの単語にpunctuationを付与
    words_with_punct = []
    text_idx = 0
    
    for word_info in words_data:
        word = word_info.get("word", "").strip()
        if not word:
            continue
        
        # text_tokensから対応する単語を探す
        punctuation = ""
        if text_idx < len(text_tokens):
            text_word, text_punct = text_tokens[text_idx]
            # 単語が一致するか確認（大文字小文字無視、句読点除去）
            word_clean = re.sub(r'[.,!?;:\'"]+', '', word.lower())
            text_word_clean = re.sub(r'[.,!?;:\'"]+', '', text_word.lower())
            
            if word_clean == text_word_clean:
                punctuation = text_punct
                text_idx += 1
            elif text_word_clean in word_clean or word_clean in text_word_clean:
                # 部分一致の場合も進める
                punctuation = text_punct
                text_idx += 1
        
        words_with_punct.append({
            "word": word,
            "punctuation": punctuation,
            "start": word_info.get("start", 0),
            "end": word_info.get("end", 0)
        })
    
    # 強い区切りになる接続詞
    strong_connectors = {'so', 'because', 'therefore', 'however', 'but', 'although', 'since'}
    weak_connectors = {'and', 'or'}
    
    # 文末記号
    sentence_enders = {'.', '!', '?'}
    
    segments = []
    current_segment = []
    current_start_time = None
    
    for i, item in enumerate(words_with_punct):
        word = item["word"]
        punct = item["punctuation"]
        start = item["start"]
        end = item["end"]
        
        if current_start_time is None:
            current_start_time = start
        
        # 前の単語との間（pause）
        pause_before = 0
        if i > 0 and current_segment:
            pause_before = start - words_with_punct[i - 1]["end"]
        
        word_lower = word.lower().rstrip('.,!?')
        word_count = len(current_segment)
        
        should_break = False
        
        # 条件1: 前の単語が文末句読点を持っていて、十分な長さ
        if current_segment:
            prev_punct = current_segment[-1]["punctuation"]
            if any(p in prev_punct for p in sentence_enders):
                if word_count >= MIN_WORDS_PER_SEGMENT:
                    should_break = True
        
        # 条件2: 強い接続詞 + 十分な長さ + pause
        if word_lower in strong_connectors:
            if word_count >= MIN_WORDS_PER_SEGMENT and pause_before >= 0.2:
                should_break = True
        
        # 条件3: 長いpause + 十分な長さ
        if pause_before >= PAUSE_THRESHOLD and word_count >= MIN_WORDS_PER_SEGMENT:
            should_break = True
        
        # 条件4: 最大長を超えそう
        if word_count >= MAX_WORDS_PER_SEGMENT:
            # カンマや接続詞で区切る
            if current_segment:
                prev_punct = current_segment[-1]["punctuation"]
                if ',' in prev_punct or word_lower in strong_connectors | weak_connectors:
                    should_break = True
                elif pause_before >= 0.2:
                    should_break = True
        
        # 区切りを入れる
        if should_break and current_segment:
            segments.append({
                "items": current_segment.copy(),
                "start_time": current_start_time,
                "end_time": current_segment[-1]["end"]
            })
            current_segment = []
            current_start_time = start
        
        current_segment.append(item)
    
    # 最後のセグメント
    if current_segment:
        segments.append({
            "items": current_segment.copy(),
            "start_time": current_start_time,
            "end_time": current_segment[-1]["end"]
        })
    
    # 短すぎるセグメントを結合
    merged_segments = []
    for seg in segments:
        if merged_segments and len(seg["items"]) < MIN_WORDS_PER_SEGMENT // 2:
            merged_segments[-1]["items"].extend(seg["items"])
            merged_segments[-1]["end_time"] = seg["end_time"]
        else:
            merged_segments.append(seg)
    
    # 出力形式に変換（句読点も含めてテキストを構築）
    result = []
    for idx, seg in enumerate(merged_segments):
        text_parts = []
        for item in seg["items"]:
            text_parts.append(item["word"] + item["punctuation"])
        
        result.append({
            "id": idx,
            "text": " ".join(text_parts),
            "start_time": round(seg["start_time"], 1),
            "end_time": round(seg["end_time"], 1)
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
