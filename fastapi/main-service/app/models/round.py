from sqlalchemy import Column, Integer, String, ForeignKey, Float, Text, JSON
from sqlalchemy.orm import relationship

from db import Base

class Round(Base):
    __tablename__ = "rounds"
    id = Column(Integer, primary_key=True, index=True)

    video_id = Column(String(1024))
    title = Column(String(1024))
    description = Column(String(1024))
    motion = Column(String(1024))
    date_uploaded = Column(String(1024))
    channel_id = Column(String(1024))
    tag = Column(String(1024))

    pois = relationship("Poi", back_populates="round", cascade="all, delete-orphan")
    rebuttals = relationship("Rebuttal", back_populates="round", cascade="all, delete-orphan")
    speeches = relationship("Speech", back_populates="round", cascade="all, delete-orphan")

class Speech(Base):
    __tablename__ = "speeches"
    id = Column(Integer, primary_key=True, index=True)

    argument_units = relationship("ArgumentUnit", back_populates="speech", cascade="all, delete-orphan")

    round_id = Column(Integer, ForeignKey("rounds.id"))
    round = relationship("Round", back_populates="speeches")

    # ログを見やすく
    def __repr__(self):
        return f"<Speech(id={self.id}, round_id={self.round_id}, argument_units={self.argument_units})>"

class ArgumentUnit(Base):
    __tablename__ = "argument_units"
    id = Column(Integer, primary_key=True, index=True)

    sequence_id = Column(Integer)
    start = Column(Float)
    end = Column(Float)
    text = Column(Text)

    speech_id = Column(Integer, ForeignKey("speeches.id"))
    speech = relationship("Speech", back_populates="argument_units")

    def __repr__(self):
        return f"<ArgumentUnit(id={self.id}, sequence_id={self.sequence_id}, start={self.start}, end={self.end}, text={self.text})>"

class Poi(Base):
    __tablename__ = "pois"
    id = Column(Integer, primary_key=True, index=True)
    argument_unit_id = Column(Integer) # segmentのidではないことに注意

    round_id = Column(Integer, ForeignKey("rounds.id"))
    round = relationship("Round", back_populates="pois")

class Rebuttal(Base):
    __tablename__ = "rebuttals"
    id = Column(Integer, primary_key=True, index=True)

    src = Column(Integer)
    tgt = Column(Integer)

    round_id = Column(Integer, ForeignKey("rounds.id"))
    round = relationship("Round", back_populates="rebuttals")

class OperationLog(Base):
    __tablename__ = "operation_logs"
    id = Column(Integer, primary_key=True, index=True)
    operation = Column(String(1024))
    timestamp = Column(String(1024))
    data = Column(JSON)