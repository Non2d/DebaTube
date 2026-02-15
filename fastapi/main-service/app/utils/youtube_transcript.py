from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
import json
from typing import Optional

def fetch_youtube_transcript(video_id: str, languages: list = ['en', 'ja']) -> Optional[str]:
    """
    YouTube動画の字幕を取得してJSON文字列として返す
    
    Args:
        video_id: YouTube動画ID
        languages: 優先する言語リスト（デフォルト: 英語、日本語）
    
    Returns:
        字幕データのJSON文字列、取得できない場合はNone
    """
    print(f"[TRANSCRIPT] Starting fetch for video_id: {video_id}")
    try:
        # YouTubeTranscriptApiのインスタンスを作成
        print(f"[TRANSCRIPT] Fetching transcript...")
        ytt_api = YouTubeTranscriptApi()
        fetched_transcript = ytt_api.fetch(video_id, languages=languages)
        
        # FetchedTranscriptオブジェクトをraw dataに変換
        transcript_data = fetched_transcript.to_raw_data()
        print(f"[TRANSCRIPT] Transcript fetched successfully, {len(transcript_data)} entries")
        
        # JSON文字列として返す
        result = json.dumps(transcript_data, ensure_ascii=False)
        print(f"[TRANSCRIPT] JSON created, length: {len(result)}")
        return result
        
    except TranscriptsDisabled:
        # 字幕が無効化されている
        print(f"[TRANSCRIPT ERROR] Transcripts disabled for {video_id}")
        return None
    except NoTranscriptFound:
        # 字幕が見つからない
        print(f"[TRANSCRIPT ERROR] No transcript found for {video_id}")
        return None
    except Exception as e:
        # その他のエラー
        print(f"[TRANSCRIPT ERROR] Error fetching transcript for {video_id}: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
