from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, and_, func
from typing import Dict, List
from models.round import Round, Speech, Word, Sentence, Adu, Rebuttal
from utils.audio import get_audio_path
import httpx
import os

async def get_job_progress(db: AsyncSession, round_id: int) -> Dict:
    """
    ラウンドの処理進捗を軽量に取得
    各スピーチの文字起こし、文、ADU、反論の有無を確認
    """
    # Round情報を取得してvideo_idを確認
    round_result = await db.execute(select(Round).where(Round.id == round_id))
    round_obj = round_result.scalar_one_or_none()
    
    # Step 1-A: Audio Download Complete
    # Check if Round.video_id exists in the audio caches in external GPU server or local directory.
    # External GPU server
    external_has_audio = False
    if round_obj and round_obj.video_id:
        try:
            async with httpx.AsyncClient() as client:
                cache_resp = await client.get("http://localhost:8080/cached_video_ids", timeout=5.0) # Expected format: { "total": 4, "cached_video_ids": ["video_id1", "video_id2", ...] } TODO: どうみてもただのリストだけ返したほうが良いな...
                if cache_resp.status_code == 200:
                    cache_data = cache_resp.json()
                    cached_video_ids = cache_data.get("cached_video_ids", [])
                    external_has_audio = round_obj.video_id in cached_video_ids
        except Exception as e:
            # If cache check fails, assume audio is not cached
            external_has_audio = False
    
    # Local directory
    local_has_audio = False
    if round_obj and round_obj.video_id:
        audio_path = get_audio_path(round_obj.video_id)
        local_has_audio = bool(audio_path)

    # 1-B: Transcription (Round Raw Transcript exists)
    has_raw_round_transcription = round_obj and round_obj.raw_transcription is not None
    
    # 1-C: Word Registration (Words exist in DB)
    stmt_count = select(func.count(Word.id)).where(Word.round_id == round_id)
    count_res = await db.execute(stmt_count)
    word_count = count_res.scalar()
    if word_count is None:
        word_count = 0
    words_registered = word_count >= 3

    # 1-D: Sentence Grouping (Sentences exist in DB)
    stmt = select(func.count(Sentence.id)).where(Sentence.round_id == round_id)
    sentence_count = (await db.execute(stmt)).scalar() or 0
    sentences_registered = sentence_count >= 3

    # 2: Speech Diarization (Speeches exist in DB)
    speeches_result = await db.execute(
        select(Speech).where(Speech.round_id == round_id).order_by(Speech.id)
    )
    speeches = speeches_result.scalars().all()
    
    speeches_progress = []
    
    for speech in speeches:
        has_audio = None #TODO: [record]でのみ使用する．とりあえずNone
        has_transcription = speech.raw_transcription is not None
        has_sentences = speech.first_sentence_id is not None
        
        adus_exist = await db.execute(
            select(exists().where(Adu.speech_id == speech.id))
        )
        has_adus = adus_exist.scalar()
        
        speeches_progress.append({
            "position": speech.position,
            "has_audio": has_audio, 
            "has_transcription": has_transcription,
            "has_sentences": has_sentences,
            "has_adus": has_adus
        })
    
    has_enough_speeches = len(speeches_progress) >= 4
    has_all_raw_speech_transcription = has_enough_speeches and all(s["has_transcription"] for s in speeches_progress)

    # 3: ADU Segmentation
    adus_complete = has_enough_speeches and all(s["has_adus"] for s in speeches_progress)

    # 4: Rebuttal Identification
    rebuttals_exist = await db.execute(
        select(exists().where(
            and_(
                Rebuttal.src_adu_id == Adu.id,
                Adu.speech_id == Speech.id,
                Speech.round_id == round_id
            )
        ))
    )
    has_rebuttals = rebuttals_exist.scalar()
    rebuttals_complete = has_rebuttals
    
    return {
        "round_id": round_id,
        "external_has_audio": external_has_audio,
        "local_has_audio": local_has_audio,
        "has_all_raw_speech_transcription": has_all_raw_speech_transcription,
        "has_raw_round_transcription": has_raw_round_transcription,
        "words_registered": words_registered,
        "sentences_registered": sentences_registered,
        "speeches_complete": has_enough_speeches,
        "adus_complete": adus_complete,
        "rebuttals_complete": rebuttals_complete,
        "speeches": speeches_progress
    }
