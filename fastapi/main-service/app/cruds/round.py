from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any

from models.round import Round, Speech, Adu, Rebuttal, Word, Sentence
from models.external_video import ExternalVideo
from sqlalchemy import func


# ==================== Round CRUD ====================

async def create_round(
    db: AsyncSession, 
    name: str, 
    type: str = "record", 
    note: str = None,
    style: str = None,
    motion: str = None,
    video_id: str = None,
    video_title: str = None,
    video_description: str = None,
    video_published_at: str = None,
    video_channel_id: str = None,
    video_channel_title: str = None,
    video_thumbnail_url: str = None,
    video_tags: list = None,
    video_category_id: str = None,
    owner_id: str = None
) -> Round:
    """
    新しいラウンドを作成
    同じ名前がある場合はtry_countをインクリメントして作成する
    """
    # video_idの重複チェック（同じ動画IDのRoundが既に存在しないか）
    if video_id:
        existing_round_result = await db.execute(
            select(Round).where(Round.video_id == video_id)
        )
        if existing_round_result.scalar_one_or_none():
            raise ValueError("Video already registered")

    # 同じ名前のラウンドの最大try_countを取得
    result = await db.execute(
        select(func.max(Round.try_count)).where(Round.name == name)
    )
    max_try_count = result.scalar()
    
    new_try_count = 1
    if max_try_count is not None:
        new_try_count = max_try_count + 1
        
    # Roundを作成
    round_obj = Round(
        name=name, 
        try_count=new_try_count,
        type=type,
        note=note,
        style=style,
        motion=motion,
        video_id=video_id,
        owner_id=owner_id
    )
    db.add(round_obj)
    await db.commit()
    await db.refresh(round_obj)
    return round_obj


async def get_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> Optional[Round]:
    """
    ラウンドを名前で取得
    try_count指定なしの場合は、最新のものを返す
    """
    query = select(Round).where(Round.name == round_name).options(selectinload(Round.speeches))
    
    if try_count is not None:
        # 指定されたバージョンを取得
        query = query.where(Round.try_count == try_count)
    else:
        # 最新を取得 (try_count降順で1件)
        query = query.order_by(Round.try_count.desc())
    
    result = await db.execute(query)
    
    # scalar_one_or_noneだと複数ある場合にエラーになる可能性がある(latest取得の場合、limitが必要？)
    # scalar() は最初の一件を返すので order_by desc していれば最新が取れる
    # ただし first() メソッドがAsyncSessionにはないので、fetchする
    row = result.first()
    if row:
        return row[0]
    return None


async def get_round_by_id(db: AsyncSession, round_id: int) -> Optional[Round]:
    """
    ラウンドをIDで取得
    """
    result = await db.execute(
        select(Round).where(Round.id == round_id).options(selectinload(Round.speeches))
    )
    return result.scalar_one_or_none()


async def get_all_rounds(db: AsyncSession) -> List[Round]:
    """
    すべてのラウンドを取得
    """
    result = await db.execute(
        select(Round).options(selectinload(Round.speeches))
    )
    return result.scalars().all()


async def get_all_rounds_with_details(db: AsyncSession, type: Optional[str] = None) -> List[Round]:
    """
    すべてのラウンドを取得（統計用に詳細リレーションもロード）
    typeが指定された場合はそのタイプのみ取得
    """
    # Round -> Speeches -> Adus -> Rebuttals(src)
    # これにより、len(r.speeches), len(s.adus), len(a.rebuttals_as_source) でカウント可能
    stmt = (
        select(Round)
        .options(
            selectinload(Round.speeches)
            .selectinload(Speech.adus)
            .selectinload(Adu.rebuttals_as_source)
        )
    )

    if type:
        stmt = stmt.where(Round.type == type)

    result = await db.execute(stmt)
    return result.scalars().all()


async def delete_round(db: AsyncSession, round_name: str) -> bool:
    """
    ラウンドを削除（カスケードで関連データも削除）
    """
    result = await db.execute(delete(Round).where(Round.name == round_name))
    await db.commit()
    return result.rowcount > 0


# ==================== Speech CRUD ====================

async def create_speech(
    db: AsyncSession,
    round_id: int,
    position: str,
    audio_path: Optional[str] = None,
    duration: Optional[float] = None,
    raw_transcription: Optional[Dict[str, Any]] = None
) -> Speech:
    """
    新しいスピーチを作成
    """
    speech = Speech(
        round_id=round_id,
        position=position,
        audio_path=audio_path,
        duration=duration,
        raw_transcription=raw_transcription
    )
    db.add(speech)
    await db.commit()
    await db.refresh(speech)
    return speech


async def get_speech(db: AsyncSession, speech_id: int) -> Optional[Speech]:
    """
    スピーチをIDで取得
    """
    result = await db.execute(
        select(Speech)
        .where(Speech.id == speech_id)
        .options(selectinload(Speech.adus))
    )
    return result.scalar_one_or_none()


async def get_speeches_by_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> List[Speech]:
    """
    ラウンド名でスピーチ一覧を取得
    try_count指定時はそのバージョンのスピーチを取得
    """
    # ラウンドIDを特定
    round_obj = await get_round(db, round_name, try_count)
    if not round_obj:
        return []

    result = await db.execute(
        select(Speech)
        .where(Speech.round_id == round_obj.id)
        .options(selectinload(Speech.adus))
    )
    return result.scalars().all()


async def update_speech_transcription(
    db: AsyncSession,
    speech_id: int,
    raw_transcription: Dict[str, Any]
) -> Optional[Speech]:
    """
    スピーチの文字起こしデータを更新
    """
    speech = await get_speech(db, speech_id)
    if speech:
        speech.raw_transcription = raw_transcription
        await db.commit()
        await db.refresh(speech)
    return speech


# ==================== Word & Sentence CRUD ====================

async def create_words_batch(
    db: AsyncSession,
    words_data: List[Dict[str, Any]]
) -> List[Word]:
    words = [
        Word(
            round_id=w["round_id"],
            text=w["text"],
            start_time=w["start_time"],
            end_time=w["end_time"],
            confidence=w.get("confidence")
        )
        for w in words_data
    ]
    db.add_all(words)
    await db.commit()
    return words


async def create_words_batch_fast(
    db: AsyncSession,
    words_data: List[Dict[str, Any]]
) -> int:
    """
    SQLAlchemy Coreを使用した高速な一括挿入
    戻り値は挿入件数のみで、作成されたオブジェクトやIDは返さない
    """
    if not words_data:
        return 0
    stmt = insert(Word).values(words_data)
    await db.execute(stmt)
    await db.commit()
    return len(words_data)


async def create_sentences_batch(
    db: AsyncSession,
    sentences_data: List[Dict[str, Any]]
) -> List[Sentence]:
    sentences = [
        Sentence(
            round_id=s["round_id"],
            text=s["text"],
            first_word_id=s["first_word_id"],
            last_word_id=s["last_word_id"]
        )
        for s in sentences_data
    ]
    db.add_all(sentences)
    await db.commit()
    for s in sentences:
        await db.refresh(s)
    return sentences


async def get_sentences_by_speech(db: AsyncSession, speech_id: int) -> List[Sentence]:
    result = await db.execute(
        select(Sentence)
        .join(Speech, Sentence.round_id == Speech.round_id)
        .where(Speech.id == speech_id)
        .order_by(Sentence.id)
    )
    return result.scalars().all()


async def get_sentences_by_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> List[Sentence]:
    round_obj = await get_round(db, round_name, try_count)
    if not round_obj:
        return []
    
    result = await db.execute(
        select(Sentence)
        .where(Sentence.round_id == round_obj.id)
        .order_by(Sentence.id)
    )
    return result.scalars().all()


async def get_words_by_speech(db: AsyncSession, speech_id: int) -> List[Word]:
    result = await db.execute(
        select(Word)
        .join(Speech, Word.round_id == Speech.round_id)
        .where(Speech.id == speech_id)
        .order_by(Word.id)
    )
    return result.scalars().all()


async def get_words_by_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> List[Word]:
    round_obj = await get_round(db, round_name, try_count)
    if not round_obj:
        return []
    
    result = await db.execute(
        select(Word)
        .where(Word.round_id == round_obj.id)
        .order_by(Word.id)
    )
    return result.scalars().all()


# ==================== ADU CRUD ====================

async def create_adu(
    db: AsyncSession,
    speech_id: int,
    first_sentence_id: int,
    last_sentence_id: int,
    text: str,
    role: str,
    start_time: float = 0.0,
    end_time: float = 0.0
) -> Adu:
    """
    新しいADUを作成
    """
    adu = Adu(
        speech_id=speech_id,
        first_sentence_id=first_sentence_id,
        last_sentence_id=last_sentence_id,
        text=text,
        role=role,
        start_time=start_time,
        end_time=end_time
    )
    db.add(adu)
    await db.commit()
    await db.refresh(adu)
    return adu


async def create_adus_batch(
    db: AsyncSession,
    adus_data: List[Dict[str, Any]]
) -> List[Adu]:
    adus = [
        Adu(
            speech_id=adu_data["speech_id"],
            first_sentence_id=adu_data["first_sentence_id"],
            last_sentence_id=adu_data["last_sentence_id"],
            text=adu_data["text"],
            role=adu_data["role"],
            start_time=adu_data.get("start_time", 0.0),
            end_time=adu_data.get("end_time", 0.0)
        )
        for adu_data in adus_data
    ]
    db.add_all(adus)
    await db.commit()

    for adu in adus:
        await db.refresh(adu)

    return adus


async def get_adu(db: AsyncSession, adu_id: int) -> Optional[Adu]:
    """
    ADUをIDで取得
    """
    result = await db.execute(
        select(Adu).where(Adu.id == adu_id)
    )
    return result.scalar_one_or_none()


async def get_adus_by_speech(db: AsyncSession, speech_id: int) -> List[Adu]:
    """
    スピーチIDでADU一覧を取得
    """
    result = await db.execute(
        select(Adu).where(Adu.speech_id == speech_id).order_by(Adu.id)
    )
    return result.scalars().all()


async def get_adus_by_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> List[Adu]:
    """
    ラウンド名でADU一覧を取得（全スピーチ）
    """
    # ラウンドIDを特定
    round_obj = await get_round(db, round_name, try_count)
    if not round_obj:
        return []

    result = await db.execute(
        select(Adu)
        .join(Speech, Adu.speech_id == Speech.id)
        .where(Speech.round_id == round_obj.id)
        .order_by(Adu.id)
    )
    return result.scalars().all()


# ==================== Rebuttal CRUD ====================

async def create_rebuttal(
    db: AsyncSession,
    src_adu_id: int,
    tgt_adu_id: int
) -> Rebuttal:
    """
    新しい反論関係を作成
    """
    rebuttal = Rebuttal(
        src_adu_id=src_adu_id,
        tgt_adu_id=tgt_adu_id
    )
    db.add(rebuttal)
    await db.commit()
    await db.refresh(rebuttal)
    return rebuttal


async def create_rebuttals_batch(
    db: AsyncSession,
    rebuttal_pairs: List[List[int]]
) -> List[Rebuttal]:
    """
    複数の反論関係を一括作成
    rebuttal_pairs: [[src_id, tgt_id], [src_id, tgt_id], ...]
    """
    rebuttals = [
        Rebuttal(src_adu_id=pair[0], tgt_adu_id=pair[1])
        for pair in rebuttal_pairs
    ]
    db.add_all(rebuttals)
    await db.commit()

    for rebuttal in rebuttals:
        await db.refresh(rebuttal)

    return rebuttals


async def get_rebuttals_by_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> List[Rebuttal]:
    """
    ラウンド名で反論関係一覧を取得
    """
    # ラウンドIDを特定
    round_obj = await get_round(db, round_name, try_count)
    if not round_obj:
        return []

    result = await db.execute(
        select(Rebuttal)
        .join(Adu, Rebuttal.src_adu_id == Adu.id)
        .join(Speech, Adu.speech_id == Speech.id)
        .where(Speech.round_id == round_obj.id)
    )
    return result.scalars().all()


async def delete_rebuttals_by_round(db: AsyncSession, round_name: str, try_count: Optional[int] = None) -> bool:
    """
    ラウンド名で反論関係を削除
    """
    # ラウンドIDを特定 (削除の場合は最新だけ消すか指定するか？通常指定しなければ最新)
    round_obj = await get_round(db, round_name, try_count)
    if not round_obj:
        return False

    # まずそのラウンドのADU IDsを取得
    adu_result = await db.execute(
        select(Adu.id)
        .join(Speech, Adu.speech_id == Speech.id)
        .where(Speech.round_id == round_obj.id)
    )
    adu_ids = [row[0] for row in adu_result.all()]

    if not adu_ids:
        return False

    # そのADU IDsに関連する反論を削除
    result = await db.execute(
        delete(Rebuttal).where(Rebuttal.src_adu_id.in_(adu_ids))
    )
    await db.commit()
    return result.rowcount > 0
