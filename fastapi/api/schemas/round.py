from typing import Optional, List
from pydantic import BaseModel, Field #BaseModelはFastAPIで使われるスキーマモデルクラスのベースクラス
from datetime import datetime

# exampleでsegmentが定義されている場合でも、segmentはADU_id:nullとして登録され、responseではsegmentは[]として返される
# ただし、データベースでは正しいspeech_idと共にしっかりと登録される
speeches_example = [
    {
      "start_time": 60.12,
      "ADUs": []
    },
    {
      "start_time": 160.12,
      "ADUs": []
    }
]

class Source(BaseModel):
    title: str = Field(..., example="WSDC 2019 Round 1")
    url: Optional[str] = Field(None, example="www.youtube.com")

class Rebuttal(BaseModel):
    src: int = Field(..., example=11)
    tgt: int = Field(..., example=22)

class SegmentBase(BaseModel):
    start: float = Field(..., example=0)
    end: float = Field(..., example=100)
    text: str = Field(..., example="We are proud to propose.")

class Segment(SegmentBase):
    speech_id: Optional[int] = Field(None, example=1)

class SegmentCreate(SegmentBase):
    pass

class ArgumentUnit(BaseModel):
    sequence_id: Optional[int] = Field(None, example=1)
    segments: List[Segment] = Field(..., example=[{"start": 0, "end": 100, "text": "We are proud to propose."}, {"start": 100, "end": 300, "text": "Thank you."}])
    transcript: Optional[str] = Field(None, example="We are proud to propose.")
    class Config:
        orm_mode = True

class SpeechBase(BaseModel):
    start_time: float = Field(..., example=0)
    ADUs: List[ArgumentUnit] = Field(..., example= [{"sequence_id":1, "transcript":"We agree."}])

class Speech(SpeechBase):
    pass

class SpeechCreateResponse(SpeechBase):
    id: Optional[int] = Field(None, example=1) #Segmentを登録するときに使う。/speech/{speech_id}/asr
    class Config:
        orm_mode = True

class RoundBase(BaseModel): #共通のフィールドを持つベースクラスを定義
    created_at: datetime = Field(None, example=datetime.now())
    updated_at: datetime = Field(None, example=datetime.now())
    deleted_at: Optional[datetime] = Field(None)
    motion: str = Field(..., example="This House Would Ban Tabacco.")
    source: Source = Field(..., example={"title": "WSDC 2019 Round 1", "url": "www.youtube.com"})
    POIs: Optional[List[int]] = Field(None, example="[11, 22, 33]")
    rebuttals: Optional[List[Rebuttal]] = Field(None, example=[{'src': 11, 'tgt': 22}, {'src': 22, 'tgt': 33}])
    speeches: List[Speech] = Field(..., example=speeches_example)

class RoundCreate(RoundBase):
    pass

class RoundCreateResponse(RoundBase):
    id: int
    speeches: List[SpeechCreateResponse] = Field(..., example=[1,2,3])
    class Config:
        orm_mode = True

class Round(RoundBase):
    id: int
    class Config: #DBとの接続に使う
        orm_mode = True