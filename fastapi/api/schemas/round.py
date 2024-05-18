from typing import Optional, List
from pydantic import BaseModel, Field #BaseModelはFastAPIで使われるスキーマモデルクラスのベースクラス

speeches_example = [
    {
      "start_time": 60.12,
      "ADUs": [
        {
          "segments": [
            {
              "start_time": 0,
              "end_time": 100,
              "text": "We are proud to propose."
            }
          ],
          "sequence_id": 1,
          "transcript": "Some transcript"
        }
      ]
    }
]

class Source(BaseModel):
    title: str = Field(..., example="WSDC 2019 Round 1")
    url: Optional[str] = Field(None, example="www.youtube.com")

class Rebuttal(BaseModel):
    src: int = Field(..., example=11)
    tgt: int = Field(..., example=22)

class Segment(BaseModel):
    start_time: float = Field(..., example=0)
    end_time: float = Field(..., example=100)
    text: str = Field(..., example="We are proud to propose.")

class ADU(BaseModel):
    sequence_id: int = Field(..., example=1)
    segments: List[Segment] = Field(..., example=[{"start_time": 0, "end_time": 100, "text": "We are proud to propose."}, {"start_time": 100, "end_time": 300, "text": "Thank you."}])
    transcript: str = Field(..., example="We are proud to propose.")

class Speech(BaseModel):
    start_time: float = Field(..., example=0)
    ADUs: List[ADU] = Field(..., example= [{"sequence_id":1, "transcript":"We agree."}])#[{"sequence_id": 1, "segments": [{"start_time": 0, "end_time": 100, "transcript": "We are proud to propose."}, {"start_time": 100, "end_time": 300, "transcript": "Thank you."}], "transcript": "We are proud to propose."}])

class RoundBase(BaseModel): #共通のフィールドを持つベースクラスを定義
    motion: str = Field(..., example="This House Would Ban Tabacco.")
    source: Source = Field(..., example={"title": "WSDC 2019 Round 1", "url": "www.youtube.com"})
    POIs: Optional[List[int]] = Field(None, example="[11, 22, 33]")
    rebuttals: Optional[List[Rebuttal]] = Field(None, example=[{'src': 11, 'tgt': 22}, {'src': 22, 'tgt': 33}])
    speeches: List[Speech] = Field(..., example=speeches_example)

class RoundCreate(RoundBase):
    pass

class RoundCreateResponse(RoundBase):
    id: int

    class Config:
        orm_mode = True

class Round(RoundBase):
    id: int

    class Config: #DBとの接続に使う
        orm_mode = True