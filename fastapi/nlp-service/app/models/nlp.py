from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class SpeechRecognition(Base):
    __tablename__ = 'speech_recognition'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    start = Column(Float)
    end = Column(Float)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime)

class SpeakerDiarization(Base):
    __tablename__ = 'speaker_diarization'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    start = Column(Float)
    end = Column(Float)
    speaker = Column(String(50), nullable=False)
    created_at = Column(DateTime)