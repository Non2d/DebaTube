from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from datetime import datetime
from db import Base

class ExternalVideo(Base):
    __tablename__ = "external_videos"

    video_id = Column(String(255), primary_key=True)  # YouTube Video ID
    title = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    channel_id = Column(String(255), nullable=True)
    channel_title = Column(String(255), nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)  # Array of tags
    category_id = Column(String(50), nullable=True)
    yt_transcript = Column(MEDIUMTEXT, nullable=True)  # JSON format, up to 16MB
    created_at = Column(DateTime, default=datetime.utcnow)
