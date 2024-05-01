# from typing import List, Dict
# from pydantic import BaseModel, Field

# class Source(BaseModel):
#     title: str
#     url: str

# class Motion(BaseModel):
#     original:str
#     translated_JP:str

# class Rebuttal(BaseModel):
#     src: int
#     dst: int

# class ADU(BaseModel):
#     id:int
#     transcript: str
#     translated_JP: str

# class Speech(BaseModel):
#     side: str
#     ADUs: List[ADU]

# class RoundBase(BaseModel):
#     source: Source
#     motion: Motion
#     rebuttals: List[Rebuttal]
#     POIs: List[int]
#     speeches: List[Speech]

# class RoundCreate(RoundBase):
#     pass

# class RoundCreateResponse(RoundCreate):
#     id: int

#     class Config:
#         orm_mode = True

# class Round(RoundBase):
#     id: int

#     #ここで、PydanticのORMモードを有効にして、PydanticモデルをPydanticモデルからORMモデルに変換できるようにしている
#     #のちにDBとの接続に使う
#     class Config:
#         orm_mode = True