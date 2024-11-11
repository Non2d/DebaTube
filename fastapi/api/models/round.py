from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Float, Text, DateTime
from sqlalchemy.orm import relationship

from db import Base

class Round(Base):
    __tablename__ = "rounds"
    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(1024))
    motion = Column(String(1024))

    pois = relationship("Poi", back_populates="round")
    rebuttals = relationship("Rebuttal", back_populates="round")
    speeches = relationship("Speech", back_populates="round")

class Speech(Base):
    __tablename__ = "speeches"
    id = Column(Integer, primary_key=True, index=True)

    argument_units = relationship("ArgumentUnit", back_populates="speech")

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