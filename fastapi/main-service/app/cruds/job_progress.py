from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists, and_, func
from typing import Dict, List
from models.round import Round, Speech, Word, Sentence, Adu, Rebuttal
from utils.audio import get_audio_path
from services.transcription_service import get_transcription_status_remote, get_transcription_status_remote_batch, get_download_audio_status_remote_batch
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
            status_list = await get_download_audio_status_remote_batch(
                video_ids=[round_obj.video_id]
            )
            for status_item in status_list:
                if status_item.get("video_id") == round_obj.video_id:
                    external_has_audio = status_item.get("dl_audio_status") == "DONE"
                    break
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
    1. B ~ D すべてが DONE なら -> DONE (1-Aは完了条件に含めない)
    2. 上記以外で、A ~ Dのいずれかが PROCESSING なら -> PROCESSING
    3. 上記以外で、A ~ Dのいずれかが IN_QUEUE なら -> IN_QUEUE
    4. それ以外は -> NOT_IN_QUEUE
    """
    round_result = await db.execute(select(Round).where(Round.id == round_id))
    round_obj = round_result.scalar_one_or_none()

    # Round が存在しなければ全て NOT_IN_QUEUE
    if not round_obj:
        return {
            "round_id": round_id,
            "step_1": "NOT_IN_QUEUE",
            "step_1a": "NOT_IN_QUEUE",
            "step_1b": "NOT_IN_QUEUE",
            "step_1c": "NOT_IN_QUEUE",
            "step_1d": "NOT_IN_QUEUE",
            "step_2": "NOT_IN_QUEUE",
            "step_3": "NOT_IN_QUEUE",
            "step_4": "NOT_IN_QUEUE"
        }

    step_1a_status = "NOT_IN_QUEUE"
    if round_obj and round_obj.video_id:
        # Check local audio first
        audio_path = get_audio_path(round_obj.video_id)
        if audio_path:
            step_1a_status = "DONE"
            print(f"[Step 1-A] Local audio found for {round_obj.video_id}: {step_1a_status}")
        else:
            # Check external download status
            try:
                print(f"[Step 1-A] Fetching download status for video_id: {round_obj.video_id}")
                status_list = await get_download_audio_status_remote_batch(
                    video_ids=[round_obj.video_id]
                )
                print(f"[Step 1-A] Status list response: {status_list}")

                status_mapping = {
                    "NOT_IN_QUEUE": "NOT_IN_QUEUE",
                    "PENDING": "IN_QUEUE",
                    "IN_QUEUE": "IN_QUEUE",
                    "PROCESSING": "PROCESSING",
                    "COMPLETED": "DONE",
                    "DONE": "DONE",
                    "ERROR": "ERROR"
                }

                for status_item in status_list:
                    if status_item.get("video_id") == round_obj.video_id:
                        external_status = status_item.get("dl_audio_status", "NOT_IN_QUEUE")
                        step_1a_status = status_mapping.get(external_status, "NOT_IN_QUEUE")
                        print(f"[Step 1-A] Found status for {round_obj.video_id}: {external_status} → {step_1a_status}")
                        break
            except Exception as e:
                print(f"[Step 1-A] Error getting download status for {round_obj.video_id}: {str(e)}")
                step_1a_status = "NOT_IN_QUEUE"
    else:
        print(f"[Step 1-A] No round or video_id: round_obj={round_obj}, video_id={round_obj.video_id if round_obj else 'N/A'}")

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


async def get_job_progress_background_batch(db: AsyncSession, round_ids: List[int]) -> List[Dict]:
    """
    複数ラウンドのバックグラウンド処理進捗を一括取得。

    - キャッシュと外部API呼び出しを共有して効率化
    - DBクエリとAPI呼び出しを並列実行
    """
    if not round_ids:
        return []

    # Step 1: Get all rounds at once
    rounds_result = await db.execute(
        select(Round).where(Round.id.in_(round_ids)).order_by(Round.id)
    )
    rounds = rounds_result.scalars().all()
    round_map = {r.id: r for r in rounds}

    # Step 2: Get download audio status for all rounds in batch
    download_statuses = {}
    video_ids_to_check = [r.video_id for r in rounds if r.video_id]
    try:
        if video_ids_to_check:
            download_results = await get_download_audio_status_remote_batch(
                video_ids=video_ids_to_check
            )

            status_mapping = {
                "NOT_IN_QUEUE": "NOT_IN_QUEUE",
                "PENDING": "IN_QUEUE",
                "IN_QUEUE": "IN_QUEUE",
                "PROCESSING": "PROCESSING",
                "COMPLETED": "DONE",
                "DONE": "DONE",
                "ERROR": "ERROR"
            }

            for result in download_results:
                video_id = result.get("video_id")
                external_status = result.get("dl_audio_status", "NOT_IN_QUEUE")
                mapped_status = status_mapping.get(external_status, "NOT_IN_QUEUE")
                download_statuses[video_id] = mapped_status
    except Exception:
        pass

    # Step 3: Get transcription status for all rounds in batch
    transcription_statuses = {}
    try:
        transcription_results = await get_transcription_status_remote_batch(round_ids)

        for result in transcription_results:
            round_id = result.get("round_id")
            external_status = result.get("status", "PENDING")
            status_mapping = {
                "PENDING": "IN_QUEUE",
                "PROCESSING": "PROCESSING",
                "COMPLETED": "DONE",
                "ERROR": "ERROR"
            }
            transcription_statuses[round_id] = status_mapping.get(external_status, "NOT_IN_QUEUE")
    except Exception as e:
        # If batch call fails, set all to NOT_IN_QUEUE
        print(f"Error fetching transcription status batch: {str(e)}")
        for round_id in round_ids:
            transcription_statuses[round_id] = "NOT_IN_QUEUE"

    # Step 4: Get word/sentence counts for all rounds
    word_counts_result = await db.execute(
        select(Word.round_id, func.count(Word.id).label("count"))
        .where(Word.round_id.in_(round_ids))
        .group_by(Word.round_id)
    )
    word_counts = {row.round_id: row.count for row in word_counts_result.all()}

    sentence_counts_result = await db.execute(
        select(Sentence.round_id, func.count(Sentence.id).label("count"))
        .where(Sentence.round_id.in_(round_ids))
        .group_by(Sentence.round_id)
    )
    sentence_counts = {row.round_id: row.count for row in sentence_counts_result.all()}

    # Step 5: Get speeches for all rounds
    speeches_result = await db.execute(
        select(Speech).where(Speech.round_id.in_(round_ids)).order_by(Speech.round_id, Speech.id)
    )
    speeches = speeches_result.scalars().all()
    speeches_by_round = {}
    for speech in speeches:
        if speech.round_id not in speeches_by_round:
            speeches_by_round[speech.round_id] = []
        speeches_by_round[speech.round_id].append(speech)

    # Step 6: Get ADU existence for all speeches in one query
    adu_results = await db.execute(
        select(Adu.speech_id).distinct().where(Adu.speech_id.in_([s.id for s in speeches]))
    )
    speeches_with_adus = set(row.speech_id for row in adu_results.all())

    # Step 7: Get rebuttal existence for all rounds
    rebuttals_result = await db.execute(
        select(Speech.round_id).distinct().where(
            and_(
                Rebuttal.src_adu_id == Adu.id,
                Adu.speech_id == Speech.id,
                Speech.round_id.in_(round_ids)
            )
        )
    )
    rounds_with_rebuttals = set(row.round_id for row in rebuttals_result.all())

    # Step 8: Precompute local audio paths for all rounds (once before loop)
    local_audio_map = {}
    for round_obj in rounds:
        if round_obj.video_id:
            audio_path = get_audio_path(round_obj.video_id)
            local_audio_map[round_obj.id] = bool(audio_path)
        else:
            local_audio_map[round_obj.id] = False

    # Step 9: Build results
    results = []
    for round_id in round_ids:
        round_obj = round_map.get(round_id)

        if not round_obj:
            results.append({
                "round_id": round_id,
                "step_1": "NOT_IN_QUEUE",
                "step_1a": "NOT_IN_QUEUE",
                "step_1b": "NOT_IN_QUEUE",
                "step_1c": "NOT_IN_QUEUE",
                "step_1d": "NOT_IN_QUEUE",
                "step_2": "NOT_IN_QUEUE",
                "step_3": "NOT_IN_QUEUE",
                "step_4": "NOT_IN_QUEUE"
            })
            continue

        # Determine step statuses
        local_has_audio = local_audio_map.get(round_id, False)
        if local_has_audio:
            step_1a_status = "DONE"
        else:
            step_1a_status = download_statuses.get(round_obj.video_id, "NOT_IN_QUEUE") if round_obj.video_id else "NOT_IN_QUEUE"
        step_1b_status = transcription_statuses.get(round_id, "NOT_IN_QUEUE")

        word_count = word_counts.get(round_id, 0)
        step_1c_status = "DONE" if word_count >= 3 else "NOT_IN_QUEUE"

        sentence_count = sentence_counts.get(round_id, 0)
        step_1d_status = "DONE" if sentence_count >= 3 else "NOT_IN_QUEUE"

        speeches = speeches_by_round.get(round_id, [])
        has_enough_speeches = len(speeches) >= 4
        step_2_status = "DONE" if has_enough_speeches else "NOT_IN_QUEUE"

        adus_complete = has_enough_speeches and all(
            s.id in speeches_with_adus for s in speeches
        )
        step_3_status = "DONE" if adus_complete else "NOT_IN_QUEUE"

        has_rebuttals = round_id in rounds_with_rebuttals
        step_4_status = "DONE" if has_rebuttals else "NOT_IN_QUEUE"

        # Determine step_1 status
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

        results.append({
            "round_id": round_id,
            "step_1": step_1_status,
            "step_1a": step_1a_status,
            "step_1b": step_1b_status,
            "step_1c": step_1c_status,
            "step_1d": step_1d_status,
            "step_2": step_2_status,
            "step_3": step_3_status,
            "step_4": step_4_status
        })

    return results
