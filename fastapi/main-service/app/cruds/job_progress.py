from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, and_
from typing import Dict, List
from models.round import Round, Speech, Word, Sentence, Adu, Rebuttal


async def get_job_progress(db: AsyncSession, round_id: int) -> Dict:
    """
    ラウンドの処理進捗を軽量に取得
    各スピーチの文字起こし、文、ADU、反論の有無を確認
    """
    # このラウンドの全スピーチを取得
    speeches_result = await db.execute(
        select(Speech.id, Speech.position, Speech.audio_path, Speech.raw_transcription).where(
            Speech.round_id == round_id
        ).order_by(Speech.id)
    )
    speeches = speeches_result.all()
    
    speeches_progress = []
    
    for speech_id, position, audio_path, raw_transcription in speeches:
        # 音声ファイルの有無
        has_audio = audio_path is not None and audio_path != ""
        
        # 文字起こしの有無（raw_transcriptionまたはwords）
        has_transcription = raw_transcription is not None
        if not has_transcription:
            # wordsテーブルをチェック
            words_exist = await db.execute(
                select(exists().where(Word.speech_id == speech_id))
            )
            has_transcription = words_exist.scalar()
        
        # 文の有無
        sentences_exist = await db.execute(
            select(exists().where(Sentence.speech_id == speech_id))
        )
        has_sentences = sentences_exist.scalar()
        
        # ADUの有無
        adus_exist = await db.execute(
            select(exists().where(Adu.speech_id == speech_id))
        )
        has_adus = adus_exist.scalar()
        
        speeches_progress.append({
            "position": position,
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
    
    # 全体の完了状況（全スピーチが完了している場合のみTrue）
    audio_complete = all(s["has_audio"] for s in speeches_progress)
    transcription_complete = all(s["has_transcription"] for s in speeches_progress)
    sentences_complete = all(s["has_sentences"] for s in speeches_progress)
    adus_complete = all(s["has_adus"] for s in speeches_progress)
    rebuttals_complete = has_rebuttals
    
    return {
        "round_id": round_id,
        "audio_complete": audio_complete,
        "transcription_complete": transcription_complete,
        "sentences_complete": sentences_complete,
        "adus_complete": adus_complete,
        "rebuttals_complete": rebuttals_complete,
        "speeches": speeches_progress
    }
