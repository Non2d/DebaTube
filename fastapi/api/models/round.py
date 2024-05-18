from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Float, Text, DateTime
from sqlalchemy.orm import relationship
import datetime

from db import Base

class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=datetime.datetime.now)
    updated_at = Column(DateTime, default=datetime.datetime.now, onupdate=datetime.datetime.now)
    deleted_at = Column(DateTime, nullable=True)
    motion = Column(String(1024))
    source = Column(JSON)
    POIs = Column(JSON)

    rebuttals = relationship("Rebuttal", back_populates="round", cascade="delete")
    speeches = relationship("Speech", back_populates="round", cascade="delete")

class Rebuttal(Base):
    __tablename__ = "rebuttals"

    id = Column(Integer, primary_key=True)

    src = Column(Integer)
    tgt = Column(Integer)

    round_id = Column(Integer, ForeignKey("rounds.id"))
    round = relationship("Round", back_populates="rebuttals")

class Speech(Base):
    __tablename__ = "speeches"

    id = Column(Integer, primary_key=True)

    start_time = Column(Float)

    round_id = Column(Integer, ForeignKey("rounds.id"))
    round = relationship("Round", back_populates="speeches")

    ADUs = relationship("ADU", back_populates="speech", cascade="delete")

class ADU(Base):
    __tablename__ = "ADUs"

    id = Column(Integer, primary_key=True)

    sequence_id = Column(Integer)
    transcript = Column(Text)

    speech_id = Column(Integer, ForeignKey("speeches.id"))
    speech = relationship("Speech", back_populates="ADUs")

    segments = relationship("Segment", cascade="delete")

class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True)

    start = Column(Float)
    end = Column(Float)
    text = Column(Text)

    ADU_id = Column(Integer, ForeignKey("ADUs.id"), nullable=True)
    ADU = relationship("ADU", back_populates="segments")