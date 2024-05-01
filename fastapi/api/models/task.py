from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship

from db import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    motion = Column(String(1024))
    source = Column(JSON)
    POIs = Column(JSON)

    rebuttals = relationship("Rebuttal", back_populates="task", cascade="delete")
    done = relationship("Done", back_populates="task", cascade="delete")

class Rebuttal(Base):
    __tablename__ = "rebuttals"

    id = Column(Integer, primary_key=True)

    src = Column(Integer)
    tgt = Column(Integer)

    task_id = Column(Integer, ForeignKey("tasks.id"))
    task = relationship("Task", back_populates="rebuttals")

class Done(Base):
    __tablename__ = "dones"

    id = Column(Integer, ForeignKey("tasks.id"), primary_key=True)

    task = relationship("Task", back_populates="done")