from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship

from db import Base

class Round(Base):
    __tablename__ = "rounds"

    id = Column(Integer, primary_key=True)
    motion = Column(String(1024))
    source = Column(JSON)
    POIs = Column(JSON)

    rebuttals = relationship("Rebuttal", back_populates="round", cascade="delete")
    done = relationship("Done", back_populates="round", cascade="delete")

class Rebuttal(Base):
    __tablename__ = "rebuttals"

    id = Column(Integer, primary_key=True)

    src = Column(Integer)
    tgt = Column(Integer)

    round_id = Column(Integer, ForeignKey("rounds.id"))
    round = relationship("Round", back_populates="rebuttals")

class Done(Base):
    __tablename__ = "dones"

    id = Column(Integer, ForeignKey("rounds.id"), primary_key=True)

    round = relationship("Round", back_populates="done")