# from sqlalchemy import Column, Integer, String, ForeignKey, JSON
# from sqlalchemy.orm import relationship
# from database import Base  # Baseはデータベースのベースクラスです。

# class Debate(Base):
#     __tablename__ = "debates"
#     id = Column(Integer, primary_key=True, index=True)
#     key = Column(String, unique=True, index=True)
#     source = Column(JSON)
#     motion = Column(JSON)
#     attacks = Column(JSON)
#     POIs = Column(JSON)
#     speeches = Column(JSON)
