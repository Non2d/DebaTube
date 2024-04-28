from typing import Optional, List
from pydantic import BaseModel, Field #BaseModelはFastAPIで使われるスキーマモデルクラスのベースクラス

class Source(BaseModel):
    title: Optional[str] = Field(None, example="WSDC 2019 Round 1")
    url: Optional[str] = Field(None, example="www.youtube.com")

class TaskBase(BaseModel): #共通のフィールドを持つベースクラスを定義
    motion: Optional[str] = Field(None, example="This House Would Ban Tabacco.")
    source: Source = Field(None, example={"title": "WSDC 2019 Round 1", "url": "www.youtube.com"})
    POIs: List[int] = Field(None, example="[11, 22, 33]")

class TaskCreate(TaskBase):
    pass

class TaskCreateResponse(TaskCreate):
    id: int

    class Config:
        orm_mode = True

class Task(TaskBase):
    id: int
    done: bool = Field(False, description="完了フラグ")

    class Config: #DBとの接続に使う
        orm_mode = True