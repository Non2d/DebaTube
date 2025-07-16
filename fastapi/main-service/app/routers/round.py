from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.future import select
from db import get_db
from typing import List, Optional, Dict
from pydantic import BaseModel
import models.round as round_db_model
from log_config import logger
from datetime import datetime
import pytz
from features.macro_structural import calculate_features

router = APIRouter()

class InitialRoundCreate(BaseModel):
    title: str
    video_id: Optional[str] = None

class RebuttalCreate(BaseModel):
    src: int
    tgt: int

class ArgumentUnitCreate(BaseModel):
    sequence_id: int
    start: float
    end: float
    text: str

class ArgumentUnitsCreate(BaseModel):
    argument_units: List[ArgumentUnitCreate]

class RoundBatchCreate(BaseModel):
    video_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    motion: Optional[str]
    date_uploaded: Optional[str]
    channel_id: Optional[str]
    tag: Optional[str]

    speeches: List[ArgumentUnitsCreate]
    pois: List[int]
    rebuttals: List[RebuttalCreate]

class RebuttalResponse(BaseModel):
    # id: int
    src: int
    tgt: int

    class Config:
        orm_mode = True

class ArgumentUnitResponse(BaseModel):
    # id: int
    sequence_id: int
    start: float
    end: float
    text: str

    class Config:
        orm_mode = True

class SpeechResponse(BaseModel):
    # id: int
    argument_units: List[ArgumentUnitResponse]

    class Config:
        orm_mode = True

class RoundBatchResponse(BaseModel):
    video_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    motion: Optional[str]
    date_uploaded: Optional[str]
    channel_id: Optional[str]
    tag: Optional[str]

    pois: List[int]
    rebuttals: List[RebuttalResponse]
    speeches: List[SpeechResponse]

    class Config:
        orm_mode = True

class RoundSummaryResponse(BaseModel):
    id: Optional[int]
    video_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    motion: Optional[str]
    date_uploaded: Optional[str]
    channel_id: Optional[str]
    tag: Optional[str]
    
    poi_count: int
    rebuttal_count: int
    speech_count: int
    total_argument_units: int

    class Config:
        orm_mode = True

class MacroStructuralFeatures(BaseModel):
    distance: float
    interval: float
    order: float
    rally: float

class RoundBatchWithFeaturesResponse(BaseModel):
    id: Optional[int]
    video_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    motion: Optional[str]
    date_uploaded: Optional[str]
    channel_id: Optional[str]
    tag: Optional[str]

    pois: List[int]
    rebuttals: List[RebuttalResponse]
    speeches: List[SpeechResponse]
    features: MacroStructuralFeatures

    class Config:
        orm_mode = True

class PoiResponse(BaseModel):
    argument_unit_id: int
    class Config:
        orm_mode = True
class RoundResponse(BaseModel):
    id: int
    video_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    motion: Optional[str]
    date_uploaded: Optional[str]
    channel_id: Optional[str]
    tag: Optional[str]

    pois: List[PoiResponse]
    rebuttals: List[RebuttalResponse]
    speeches: List[SpeechResponse]

    class Config:
        orm_mode = True

@router.get("/rounds")
async def get_rounds(db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).options(
        selectinload(round_db_model.Round.pois),
        selectinload(round_db_model.Round.rebuttals),
        selectinload(round_db_model.Round.speeches).selectinload(
            round_db_model.Speech.argument_units
        ),
    )
    result = await db.execute(query)
    rounds = result.scalars().unique().all()
    return rounds

@router.post("/rounds")
async def create_round(round_create: InitialRoundCreate, db: AsyncSession = Depends(get_db)):
    round = round_db_model.Round(
        title=round_create.title,
        video_id=round_create.video_id,
    )
    db.add(round)
    await db.commit()
    await db.refresh(round)
    logger.info(f"Round created: {round.id} - {round.title}")
    return {"id": round.id, "title": round.title, "video_id": round.video_id}

@router.get("/rounds-summary", response_model=List[RoundSummaryResponse])
async def get_rounds_summary(db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).options(
        selectinload(round_db_model.Round.pois),
        selectinload(round_db_model.Round.rebuttals),
        selectinload(round_db_model.Round.speeches).selectinload(
            round_db_model.Speech.argument_units
        ),
    )
    result = await db.execute(query)
    db_rounds = result.scalars().unique().all()

    return [
        RoundSummaryResponse(
            id=db_round.id,
            video_id=db_round.video_id,
            title=db_round.title,
            description=db_round.description,
            motion=db_round.motion,
            date_uploaded=db_round.date_uploaded,
            channel_id=db_round.channel_id,
            tag=db_round.tag,
            poi_count=len(db_round.pois),
            rebuttal_count=len(db_round.rebuttals),
            speech_count=len(db_round.speeches),
            total_argument_units=sum(len(speech.argument_units) for speech in db_round.speeches)
        ) for db_round in db_rounds
    ]

@router.get("/batch-rounds-with-features", response_model=List[RoundBatchWithFeaturesResponse])
async def get_rounds_batch_with_features(db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).options(
        selectinload(round_db_model.Round.pois),
        selectinload(round_db_model.Round.rebuttals),
        selectinload(round_db_model.Round.speeches).selectinload(
            round_db_model.Speech.argument_units
        ),
    )
    result = await db.execute(query)
    db_rounds = result.scalars().unique().all()

    response_list = []
    for db_round in db_rounds:
        # Convert to RoundBatchResponse format for feature calculation
        round_data = {
            "video_id": db_round.video_id,
            "title": db_round.title,
            "description": db_round.description,
            "motion": db_round.motion,
            "date_uploaded": db_round.date_uploaded,
            "channel_id": db_round.channel_id,
            "tag": db_round.tag,
            "pois": [poi.argument_unit_id for poi in db_round.pois],
            "rebuttals": [
                {"src": rebuttal.src, "tgt": rebuttal.tgt}
                for rebuttal in db_round.rebuttals
            ],
            "speeches": [
                {
                    "argument_units": [
                        {
                            "sequence_id": au.sequence_id,
                            "start": au.start,
                            "end": au.end,
                            "text": au.text
                        } for au in speech.argument_units
                    ]
                } for speech in db_round.speeches
            ]
        }
        
        # Calculate features
        features = calculate_features(round_data)
        
        response_list.append(
            RoundBatchWithFeaturesResponse(
                id=db_round.id,
                video_id=db_round.video_id,
                title=db_round.title,
                description=db_round.description,
                motion=db_round.motion,
                date_uploaded=db_round.date_uploaded,
                channel_id=db_round.channel_id,
                tag=db_round.tag,
                pois=[poi.argument_unit_id for poi in db_round.pois],
                rebuttals=[
                    RebuttalResponse(src=rebuttal.src, tgt=rebuttal.tgt)
                    for rebuttal in db_round.rebuttals
                ],
                speeches=[
                    SpeechResponse(
                        argument_units=[
                            ArgumentUnitResponse(
                                sequence_id=au.sequence_id,
                                start=au.start,
                                end=au.end,
                                text=au.text
                            ) for au in speech.argument_units
                        ]
                    ) for speech in db_round.speeches
                ],
                features=MacroStructuralFeatures(
                    distance=features["distance"],
                    interval=features["interval"],
                    order=features["order"],
                    rally=features["rally"]
                )
            )
        )
    
    return response_list

@router.delete("/rounds/{round_id}")
async def delete_round(round_id: int, db: AsyncSession = Depends(get_db)):
    query = select(round_db_model.Round).filter_by(id=round_id)
    result = await db.execute(query)
    round = result.scalars().first()
    if round is None:
        raise HTTPException(status_code=404, detail="Round not found")
    await db.delete(round)
    await db.commit()
    logger.info(f"Round {round_id}: {round.title} deleted")
    return {"message": f"Round {round_id}: {round.title} deleted"}

class OperationLogRequest(BaseModel):
    operation: str
    data: Dict

@router.post("/log/operation")
async def log_operation(operation_log: OperationLogRequest, db: AsyncSession = Depends(get_db)):
    jst = pytz.timezone('Asia/Tokyo')
    readable_current_time = datetime.now(jst).strftime("%Y-%m-%d %H:%M:%S.%f")[:-4]
    logger.info(f"{readable_current_time}: Operation is logged: {operation_log}")
    db.add(round_db_model.OperationLog(
        operation=operation_log.operation,
        timestamp=readable_current_time,
        data=operation_log.data,
    ))
    await db.commit()
    return "Operation logged successfully: " + str(operation_log)
