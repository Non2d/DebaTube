from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, and_, func
from typing import Dict, List
from models.round import Round, Speech, Word, Sentence, Adu, Rebuttal
from utils.audio import get_audio_path
from services.transcription_service import get_cached_video_ids_remote, get_transcription_status_remote
from fastapi import HTTPException
import os

async def get_job_progress(db: AsyncSession, round_id: int) -> Dict:
    """
    ラウンドの処理進捗を軽量に取得する関数。
    
    以下の項目を確認し、各スピーチの進捗状況と合わせて返却する：
    1. 音声ファイルの有無（外部GPUサーバーまたはローカルキャッシュ）
    2. ラウンド全体の文字起こし完了状況
    3. 単語（Word）の登録状況（3つ以上で完了とみなす）
    4. 文（Sentence）のグループ化状況（3つ以上で完了とみなす）
    5. スピーチのダイアライゼーション完了状況（4つ以上のスピーチ登録で完了とみなす）
    6. ADU分割の完了状況（全スピーチに対してADUが存在すること）
    7. 反論（Rebuttal）の特定状況（反論データが存在すること）
    """
    round_result = await db.execute(select(Round).where(Round.id == round_id))
    round_obj = round_result.scalar_one_or_none()
    
    external_has_audio = False
    if round_obj and round_obj.video_id:
        try:
            cache_data = await get_cached_video_ids_remote()
            cached_video_ids = cache_data.get("cached_video_ids", [])
            external_has_audio = round_obj.video_id in cached_video_ids
        except Exception as e:
            external_has_audio = False
    
    local_has_audio = False
    if round_obj and round_obj.video_id:
        audio_path = get_audio_path(round_obj.video_id)
        local_has_audio = bool(audio_path)

    has_raw_round_transcription = round_obj and round_obj.raw_transcription is not None
    
    stmt_count = select(func.count(Word.id)).where(Word.round_id == round_id)
    count_res = await db.execute(stmt_count)
    word_count = count_res.scalar()
    if word_count is None:
        word_count = 0
    words_registered = word_count >= 3

    stmt = select(func.count(Sentence.id)).where(Sentence.round_id == round_id)
    sentence_count = (await db.execute(stmt)).scalar() or 0
    sentences_registered = sentence_count >= 3

    speeches_result = await db.execute(
        select(Speech).where(Speech.round_id == round_id).order_by(Speech.id)
    )
    speeches = speeches_result.scalars().all()
    
    speeches_progress = []
    
    for speech in speeches:
        has_audio = None
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

    adus_complete = has_enough_speeches and all(s["has_adus"] for s in speeches_progress)

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

async def get_job_progress_background(db: AsyncSession, round_id: int) -> Dict:
    """
    バックグラウンド処理用の詳細なジョブ進捗を取得する関数。
    
    各ステップのステータス定義:
    - Step 1-A (音声取得): 外部サーバーまたはローカルにキャッシュがあれば DONE
    - Step 1-B (文字起こし): 外部APIのステータスに依存 (404->NOT_IN_QUEUE, PENDING->IN_QUEUE, PROCESSING->PROCESSING, COMPLETED->DONE)
    - Step 1-C (単語登録): 3単語以上登録済みで DONE
    - Step 1-D (文生成): 3文以上生成済みで DONE
    - Step 2 (話者分離): 4スピーチ以上あれば DONE
    - Step 3 (ADU分割): 全スピーチでADU生成済みなら DONE
    - Step 4 (反論特定): 反論データが存在すれば DONE

    Step 1全体のステータス決定ロジック (A, B, C, Dの状況に基づく):
    1. B ~ D すべてが DONE なら -> DONE
    2. 上記以外で、A ~ Dのいずれかが PROCESSING なら -> PROCESSING
    3. 上記以外で、A ~ Dのいずれかが IN_QUEUE なら -> IN_QUEUE
    4. それ以外は -> NOT_IN_QUEUE
    """
    round_result = await db.execute(select(Round).where(Round.id == round_id))
    round_obj = round_result.scalar_one_or_none()

    external_has_audio = False
    local_has_audio = False
    if round_obj and round_obj.video_id:
        try:
            cache_data = await get_cached_video_ids_remote()
            cached_video_ids = cache_data.get("cached_video_ids", [])
            external_has_audio = round_obj.video_id in cached_video_ids
        except Exception:
            external_has_audio = False

        audio_path = get_audio_path(round_obj.video_id)
        local_has_audio = bool(audio_path)

    step_1a_status = "DONE" if (external_has_audio or local_has_audio) else "NOT_IN_QUEUE"

    step_1b_status = "NOT_IN_QUEUE"
    try:
        status_info = await get_transcription_status_remote(round_id)
        external_status = status_info.get("status", "PENDING")

        status_mapping = {
            "PENDING": "IN_QUEUE",
            "PROCESSING": "PROCESSING",
            "COMPLETED": "DONE",
            "ERROR": "ERROR"
        }
        step_1b_status = status_mapping.get(external_status, "NOT_IN_QUEUE")
    except HTTPException as e:
        if e.status_code == 404:
            step_1b_status = "NOT_IN_QUEUE"
        else:
            step_1b_status = "NOT_IN_QUEUE"
    except Exception:
        step_1b_status = "NOT_IN_QUEUE"

    stmt_count = select(func.count(Word.id)).where(Word.round_id == round_id)
    count_res = await db.execute(stmt_count)
    word_count = count_res.scalar() or 0
    step_1c_status = "DONE" if word_count >= 3 else "NOT_IN_QUEUE"

    stmt = select(func.count(Sentence.id)).where(Sentence.round_id == round_id)
    sentence_count = (await db.execute(stmt)).scalar() or 0
    step_1d_status = "DONE" if sentence_count >= 3 else "NOT_IN_QUEUE"

    if step_1b_status == "DONE" and step_1c_status == "DONE" and step_1d_status == "DONE":
        step_1_status = "DONE"
    else:
        targets_for_active = [step_1a_status, step_1b_status, step_1c_status, step_1d_status]
        
        if any(s == "PROCESSING" for s in targets_for_active):
            step_1_status = "PROCESSING"
        elif any(s == "IN_QUEUE" for s in targets_for_active):
            step_1_status = "IN_QUEUE"
        else:
            step_1_status = "NOT_IN_QUEUE"

    speeches_result = await db.execute(
        select(Speech).where(Speech.round_id == round_id).order_by(Speech.id)
    )
    speeches = speeches_result.scalars().all()
    has_enough_speeches = len(speeches) >= 4
    step_2_status = "DONE" if has_enough_speeches else "NOT_IN_QUEUE"

    speeches_progress = []
    for speech in speeches:
        adus_exist = await db.execute(
            select(exists().where(Adu.speech_id == speech.id))
        )
        has_adus = adus_exist.scalar()
        speeches_progress.append({
            "position": speech.position,
            "has_adus": has_adus
        })

    adus_complete = has_enough_speeches and all(s["has_adus"] for s in speeches_progress)
    step_3_status = "DONE" if adus_complete else "NOT_IN_QUEUE"

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
    step_4_status = "DONE" if has_rebuttals else "NOT_IN_QUEUE"

    return {
        "round_id": round_id,
        "step_1": step_1_status,
        "step_1a": step_1a_status,
        "step_1b": step_1b_status,
        "step_1c": step_1c_status,
        "step_1d": step_1d_status,
        "step_2": step_2_status,
        "step_3": step_3_status,
        "step_4": step_4_status
    }
