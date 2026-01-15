from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, and_, func
from typing import Dict, List
from models.round import Round, Speech, Word, Sentence, Adu, Rebuttal


import os

async def get_job_progress(db: AsyncSession, round_id: int) -> Dict:
    """
    ラウンドの処理進捗を軽量に取得
    各スピーチの文字起こし、文、ADU、反論の有無を確認
    """
    # Round情報を取得してvideo_idを確認
    round_result = await db.execute(select(Round).where(Round.id == round_id))
    round_obj = round_result.scalar_one_or_none()

    has_round_transcription = round_obj and round_obj.raw_transcription is not None
    
    # 音声ファイルの存在確認 (1試合に1つのファイル)
    audio_complete = False
    audio_file_exists = False # 今後，External GPU ServerやCollab上に音声ファイルがあるかに対応させる
    if round_obj and round_obj.video_id:
        # Check standard path
        audio_path = f"/app/tmp-audio-save/{round_obj.video_id}/full_audio.m4a"
        if os.path.exists(audio_path):
            audio_complete = True
        else:
            # Fallback check for old path
            old_path = f"/app/tmp-audio-save/{round_obj.video_id}.m4a"
            if os.path.exists(old_path):
                audio_complete = True

    # このラウンドの全スピーチを取得
    speeches_result = await db.execute(
        select(Speech).where(Speech.round_id == round_id).order_by(Speech.id)
    )
    speeches = speeches_result.scalars().all()
    
    speeches_progress = []
    
    for speech in speeches:
        # 音声ファイルの有無: 個別スピーチではなく全体で管理するため、ここではaudio_completeを使うか、空にする
        has_audio = audio_complete
        
        # 文字起こしの有無 (Wordの存在確認)
        # 文字起こしの有無
        has_transcription = speech.raw_transcription is not None
        
        # 文の有無
        has_sentences = speech.first_sentence_id is not None
        
        # ADUの有無
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
    
    # 反論の有無（ADU経由でround_idを取得）
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
    
    # 全体の完了状況
    has_enough_speeches = len(speeches_progress) >= 4 

    # Check if Round has at least 3 words
    stmt_count = select(func.count(Word.id)).where(Word.round_id == round_id)
    count_res = await db.execute(stmt_count)
    word_count = count_res.scalar()
    if word_count is None:
        word_count = 0

    all_speeches_have_transcription = has_enough_speeches and all(s["has_transcription"] for s in speeches_progress)
    transcription_complete = all_speeches_have_transcription or has_round_transcription
    
    words_registered = word_count >= 3
    
    # If transcription is complete, audio download must have been completed (even if file is now deleted)
    # 1-A: Audio Download
    if transcription_complete:
        audio_complete = True
    
    # 1-B: Transcription (Raw Transcript exists)
    # transcription_complete is already calculated above
    
    # 1-C: Word Registration (Words exist in DB)
    # words_registered is already calculated above

    # 1-D: Sentence Grouping (Sentences exist in DB)
    stmt = select(func.count(Sentence.id)).where(Sentence.round_id == round_id)
    sentence_count = (await db.execute(stmt)).scalar() or 0
    sentences_registered = sentence_count >= 3
    
    adus_complete = has_enough_speeches and all(s["has_adus"] for s in speeches_progress)
    rebuttals_complete = has_rebuttals
    
    return {
        "round_id": round_id,
        "audio_complete": audio_complete,           # 1-A
        "audio_file_exists": audio_file_exists,
        "transcription_complete": transcription_complete, # 1-B
        "words_registered": words_registered,       # 1-C
        "sentences_registered": sentences_registered, # 1-D
        "speeches_complete": has_enough_speeches,   # 2 (Diarization)
        "adus_complete": adus_complete,
        "rebuttals_complete": rebuttals_complete,
        "speeches": speeches_progress
    }
