from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey
from db import Base  # Baseはデータベースのベースクラスです。
from sqlalchemy.orm import relationship

class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True)
    source = relationship("Source", back_populates="round", uselist=False, lazy="joined")
    motion = relationship("Motion", back_populates="round", uselist=False, lazy="joined")
    speeches = relationship("Speech", back_populates="round", uselist=True, lazy="joined")
    rebuttals = relationship("Rebuttal", back_populates="round", uselist=True, lazy="joined")
    POIs = Column(JSON)

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True)
    round_id = Column(Integer, ForeignKey('rounds.id'))
    round = relationship("Round", back_populates="source")

    title = Column(String(255))
    url = Column(String(255))

class Motion(Base):
    __tablename__ = "motions"

    id = Column(Integer, primary_key=True)
    round_id = Column(Integer, ForeignKey('rounds.id'))
    round = relationship("Round", back_populates="motion")

    original = Column(String(255))
    translated_JP = Column(String(255))

class Speech(Base):
    __tablename__ = "speeches"

    id = Column(Integer, primary_key=True)
    round_id = Column(Integer, ForeignKey('rounds.id'))
    round = relationship("Round", back_populates="speeches")

    side = Column(String(255))
    ADUs = relationship("ADU", back_populates="speech", uselist=True)

class ADU(Base):
    __tablename__ = "ADUs"

    id = Column(Integer, primary_key=True)
    speech_id = Column(Integer, ForeignKey('speeches.id'))
    speech = relationship("Speech", back_populates="ADUs")

    transcript = Column(Text)
    translated_JP = Column(Text)

class Rebuttal(Base):
    __tablename__ = "rebuttals"

    id = Column(Integer, primary_key=True)
    round_id = Column(Integer, ForeignKey('rounds.id'))
    round = relationship("Round", back_populates="rebuttals")

    src = Column(Integer)
    dst = Column(Integer)