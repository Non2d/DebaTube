from typing import List, Dict
from pydantic import BaseModel, Field

class Source(BaseModel):
    title: str
    URL: str

class Motion(BaseModel):
    original:str
    translated_JP:str

class Rebuttal(BaseModel):
    from_field: int = Field(..., alias="from")
    to: int

class ADU(BaseModel):
    id:int
    transcript: str
    translated_JP: str

class Speech(BaseModel):
    side: str
    ADUs: List[ADU]

class Rounds(BaseModel):
    id: int
    source: Source
    motion: Motion
    rebuttals: List[Rebuttal]
    POIs: List[int]
    speeches: List[Speech]
