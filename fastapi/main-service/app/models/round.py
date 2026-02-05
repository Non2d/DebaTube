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
    tags = Column(String(255), nullable=True)  # タグ（最大100文字程度）
    video_id = Column(String(255), nullable=True)  # 外部キー制約を削除
    owner_id = Column(String(255), nullable=True)
    raw_transcription = Column(JSON, nullable=True)  # Full transcription before diarization

    speeches = relationship("Speech", back_populates="round", cascade="all, delete-orphan")
    sentences = relationship("Sentence", back_populates="round", cascade="all, delete-orphan")
    words = relationship("Word", back_populates="round", cascade="all, delete-orphan")

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
    
    position = Column(String(64), nullable=False)
    audio_path = Column(String(512), nullable=True)
    duration = Column(Float, nullable=True)
    raw_transcription = Column(JSON, nullable=True)
    
    first_sentence_id = Column(Integer, ForeignKey("sentences.id"), nullable=True)
    last_sentence_id = Column(Integer, ForeignKey("sentences.id"), nullable=True)

    round = relationship("Round", back_populates="speeches")
    adus = relationship("Adu", back_populates="speech", cascade="all, delete-orphan")

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
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    
    text = Column(String(255), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    confidence = Column(Float, nullable=True)

    round = relationship("Round", back_populates="words")

    def __repr__(self):
        return f"<Word(id={self.id}, round_id={self.round_id}, text={self.text})>"


class Sentence(Base):
    """
    スピーチ内の文を表すテーブル（Wordのグループ）
    """
    __tablename__ = "sentences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    round_id = Column(Integer, ForeignKey("rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    
    text = Column(Text, nullable=False)
    
    first_word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    last_word_id = Column(Integer, ForeignKey("words.id"), nullable=False)

    round = relationship("Round", back_populates="sentences")

    def __repr__(self):
        return f"<Sentence(id={self.id}, round_id={self.round_id})>"


class Adu(Base):
    """
    ADU（Argumentative Discourse Unit）を表すテーブル
    全スピーチ通しの連番idを持つ
    """
    __tablename__ = "adus"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    speech_id = Column(Integer, ForeignKey("speeches.id", ondelete="CASCADE"), nullable=False)
    
    first_sentence_id = Column(Integer, ForeignKey("sentences.id"), nullable=False)
    last_sentence_id = Column(Integer, ForeignKey("sentences.id"), nullable=False)
    
    text = Column(Text, nullable=False)
    role = Column(String(64), nullable=False)
    
    # Denormalized timestamp fields for performance (避けるため深いネスト: adu.sentences[0].words[0].start)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)

    speech = relationship("Speech", back_populates="adus")
    rebuttals_as_source = relationship(
        "Rebuttal",
        foreign_keys="Rebuttal.src_adu_id",
        back_populates="source_adu",
        cascade="all, delete-orphan"
    )
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
