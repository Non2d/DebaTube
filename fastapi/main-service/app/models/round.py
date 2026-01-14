from sqlalchemy import Column, Integer, String, ForeignKey, Float, Text, JSON, DateTime, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from db import Base
from models.external_video import ExternalVideo


class Round(Base):
    """
    議論ラウンド（試合）を表すテーブル
    """
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)  # 新しい主キー
    name = Column(String(255), index=True, nullable=False)  # 既存のID代わり (Unique制約は複合のみにする)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # New fields
    try_count = Column(Integer, default=1, nullable=False)
    type = Column(String(50), default="record", nullable=False) # "record" or "external_video"
    note = Column(Text, nullable=True)
    style = Column(String(50), default="british_parliamentary", nullable=False) # british_parliamentary, north_american, etc.
    motion = Column(Text, nullable=True)
    video_id = Column(String(255), nullable=True)  # 外部キー制約を削除
    owner_id = Column(String(255), nullable=True)
    raw_transcription = Column(JSON, nullable=True)  # Full transcription before diarization

    # リレーション
    speeches = relationship("Speech", back_populates="round", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('name', 'try_count', name='idx_rounds_name_try_count'),
    )

    def __repr__(self):
        return f"<Round(id={self.id}, name={self.name})>"


class Speech(Base):
    """
    個別のスピーチを表すテーブル
    """
    __tablename__ = "speeches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False)
    # round_name は削除
    
    position = Column(String(64), nullable=False)  # Proposition_1st, Opposition_1st, etc.
    audio_path = Column(String(512), nullable=True)  # 音声ファイルのパス
    duration = Column(Float, nullable=True)  # 音声の長さ（秒）
    raw_transcription = Column(JSON, nullable=True)  # Whisperの生出力をそのまま格納

    # リレーション
    round = relationship("Round", back_populates="speeches")
    adus = relationship("Adu", back_populates="speech", cascade="all, delete-orphan")
    words = relationship("Word", back_populates="speech", cascade="all, delete-orphan")
    sentences = relationship("Sentence", back_populates="speech", cascade="all, delete-orphan")

    __table_args__ = (
        Index('fk_speeches_round_id', 'round_id'),
    )

    def __repr__(self):
        return f"<Speech(id={self.id}, round_id={self.round_id}, position={self.position})>"


class Word(Base):
    """
    スピーチ内の単語を表すテーブル
    """
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    speech_id = Column(Integer, ForeignKey("speeches.id", ondelete="CASCADE"), nullable=False, index=True)
    index = Column(Integer, nullable=False)  # 0-indexed position in speech
    text = Column(String(255), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)

    # リレーション
    speech = relationship("Speech", back_populates="words")

    __table_args__ = (
        Index('idx_words_speech_id_index', 'speech_id', 'index'),
    )

    def __repr__(self):
        return f"<Word(id={self.id}, speech_id={self.speech_id}, index={self.index}, text={self.text})>"


class Sentence(Base):
    """
    スピーチ内の文を表すテーブル（Wordのグループ）
    """
    __tablename__ = "sentences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    speech_id = Column(Integer, ForeignKey("speeches.id", ondelete="CASCADE"), nullable=False, index=True)
    index = Column(Integer, nullable=False)  # 0-indexed position in speech
    text = Column(Text, nullable=False)  # Cached text for convenience
    start_word_index = Column(Integer, nullable=False)
    end_word_index = Column(Integer, nullable=False)

    # リレーション
    speech = relationship("Speech", back_populates="sentences")

    __table_args__ = (
        Index('idx_sentences_speech_id_index', 'speech_id', 'index'),
    )

    def __repr__(self):
        return f"<Sentence(id={self.id}, speech_id={self.speech_id}, index={self.index})>"


class Adu(Base):
    """
    ADU（Argumentative Discourse Unit）を表すテーブル
    全スピーチ通しの連番idを持つ
    """
    __tablename__ = "adus"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)  # 全スピーチ通しの連番
    speech_id = Column(Integer, ForeignKey("speeches.id", ondelete="CASCADE"), nullable=False)
    start_sentence_index = Column(Integer, nullable=False)
    end_sentence_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    role = Column(String(64), nullable=False)  # introduction, definition, claim, rebuttal, etc.
    # start_time / end_time are removed, derived from sentences -> words

    # リレーション
    speech = relationship("Speech", back_populates="adus")
    # 反論関係（src側）
    rebuttals_as_source = relationship(
        "Rebuttal",
        foreign_keys="Rebuttal.src_adu_id",
        back_populates="source_adu",
        cascade="all, delete-orphan"
    )
    # 反論関係（tgt側）
    rebuttals_as_target = relationship(
        "Rebuttal",
        foreign_keys="Rebuttal.tgt_adu_id",
        back_populates="target_adu",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index('ix_adus_speech_id', 'speech_id'),
    )

    def __repr__(self):
        return f"<Adu(id={self.id}, speech_id={self.speech_id}, role={self.role})>"


class Rebuttal(Base):
    """
    ADU間の反論関係を表すテーブル（N:N自己参照）
    """
    __tablename__ = "rebuttals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    src_adu_id = Column(Integer, ForeignKey("adus.id", ondelete="CASCADE"), nullable=False)  # 反論している側
    tgt_adu_id = Column(Integer, ForeignKey("adus.id", ondelete="CASCADE"), nullable=False)  # 反論されている側

    # リレーション
    source_adu = relationship("Adu", foreign_keys=[src_adu_id], back_populates="rebuttals_as_source")
    target_adu = relationship("Adu", foreign_keys=[tgt_adu_id], back_populates="rebuttals_as_target")

    __table_args__ = (
        Index('idx_rebuttals_src', 'src_adu_id'),
        Index('idx_rebuttals_tgt', 'tgt_adu_id'),
    )
