from sqlalchemy import Column, Integer, JSON
from db import Base  # Baseはデータベースのベースクラスです。

class Round(Base):
    __tablename__ = "debates"

    id = Column(Integer, primary_key=True)
    source = Column(JSON)
    motion = Column(JSON)
    rebuttals = Column(JSON)
    POIs = Column(JSON)
    speeches = Column(JSON)
