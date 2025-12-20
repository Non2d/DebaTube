# from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy.orm import selectinload, defer
# from sqlalchemy.future import select
# from db import get_db
# import time
# import asyncio
# from dotenv import load_dotenv
# load_dotenv()
# from typing import List, Optional, Dict
# from pydantic import BaseModel
# import models.round as round_db_model
# from log_config import logger
# router = APIRouter()
# from cruds.gpt import segment2argument_units, speeches2rebuttals, digest2motion, group_consecutive
# import os, httpx
# from datetime import datetime
# import pytz
# from fastapi import Query
# import html, re
# from features.macro_structural import calculate_features

# # request schema

# class SegmentCreate(BaseModel):  # たぶんだけどSegmentを返すことはない
#     start: float
#     end: float
#     text: str

# class RoundCreate(BaseModel):
#     video_id: str
#     # title: str
#     # description: str
#     motion: str
#     # date_uploaded: str
#     # channel_id: str
#     tag: str #追加

#     speeches: List[List[SegmentCreate]]
#     poi_segment_ids: List[int]  # リクエストの時点ではpoiはまだ確定していない
#     # rebuttals: List[Rebuttal] # リクエストの時点ではrebuttalはまだ存在しない

# class RebuttalCreate(BaseModel):
#     src: int
#     tgt: int

# class ArgumentUnitCreate(BaseModel):
#     sequence_id: int
#     start: float
#     end: float
#     text: str
# class ArgumentUnitsCreate(BaseModel):
#     argument_units: List[ArgumentUnitCreate]
# class RoundBatchCreate(BaseModel):
#     video_id: Optional[str]
#     title: Optional[str]
#     description: Optional[str]
#     motion: Optional[str]
#     date_uploaded: Optional[str]
#     channel_id: Optional[str]
#     tag: Optional[str]

#     speeches: List[ArgumentUnitsCreate]
#     pois: List[int]
#     rebuttals: List[RebuttalCreate]

# class ArgumentUnitCreate(BaseModel):
#     sequence_id: int
#     start: float
#     end: float
#     text: str

# # response schema
# class RebuttalResponse(BaseModel):
#     # id: int
#     src: int
#     tgt: int

#     class Config:
#         orm_mode = True

# class ArgumentUnitResponse(BaseModel):
#     # id: int
#     sequence_id: int
#     start: float
#     end: float
#     text: str

#     class Config:
#         orm_mode = True

# class SpeechResponse(BaseModel):
#     # id: int
#     argument_units: List[ArgumentUnitResponse]

#     class Config:
#         orm_mode = True

# class RoundBatchResponse(BaseModel):
#     video_id: Optional[str]
#     title: Optional[str]
#     description: Optional[str]
#     motion: Optional[str]
#     date_uploaded: Optional[str]
#     channel_id: Optional[str]
#     tag: Optional[str]

#     pois: List[int]
#     rebuttals: List[RebuttalResponse]
#     speeches: List[SpeechResponse]

#     class Config:
#         orm_mode = True

# class RoundSummaryResponse(BaseModel):
#     id: Optional[int]
#     video_id: Optional[str]
#     title: Optional[str]
#     description: Optional[str]
#     motion: Optional[str]
#     date_uploaded: Optional[str]
#     channel_id: Optional[str]
#     tag: Optional[str]
    
#     poi_count: int
#     rebuttal_count: int
#     speech_count: int
#     total_argument_units: int

#     class Config:
#         orm_mode = True

# class MacroStructuralFeatures(BaseModel):
#     distance: float
#     interval: float
#     order: float
#     rally: float

# class RoundBatchWithFeaturesResponse(BaseModel):
#     id: Optional[int]
#     video_id: Optional[str]
#     title: Optional[str]
#     description: Optional[str]
#     motion: Optional[str]
#     date_uploaded: Optional[str]
#     channel_id: Optional[str]
#     tag: Optional[str]

#     pois: List[int]
#     rebuttals: List[RebuttalResponse]
#     speeches: List[SpeechResponse]
#     features: MacroStructuralFeatures

#     class Config:
#         orm_mode = True

# class PoiResponse(BaseModel):
#     argument_unit_id: int
#     class Config:
#         orm_mode = True
# class RoundResponse(BaseModel):
#     id: int
#     video_id: Optional[str]
#     title: Optional[str]
#     description: Optional[str]
#     motion: Optional[str]
#     date_uploaded: Optional[str]
#     channel_id: Optional[str]
#     tag: Optional[str]

#     pois: List[PoiResponse]
#     rebuttals: List[RebuttalResponse]
#     speeches: List[SpeechResponse]

#     class Config:
#         orm_mode = True

# def remove_invalid_characters(text):
#     # 無効な文字（絵文字や特殊文字）を削除する正規表現
#     return re.sub(r'[^\x00-\x7F]+', '', text)


# @router.get("/rounds")
# async def get_rounds(db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     )
#     result = await db.execute(query)
#     rounds = result.scalars().unique().all()
#     return rounds

# # textは省く
# @router.get("/rounds-without-text")
# async def get_rounds_without_text(db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ).options(defer(round_db_model.ArgumentUnit.text)),
#     )
#     result = await db.execute(query)
#     rounds = result.scalars().unique().all()
#     return rounds

# @router.get("/batch-rounds", response_model=List[RoundBatchResponse])
# async def get_rounds_batch(db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     )
#     result = await db.execute(query)
#     db_rounds = result.scalars().unique().all()

#     return [
#         RoundBatchResponse(
#             video_id=db_round.video_id,
#             title=db_round.title,
#             description=db_round.description,
#             motion=db_round.motion,
#             date_uploaded=db_round.date_uploaded,
#             channel_id=db_round.channel_id,
#             tag=db_round.tag,

#             pois=[poi.argument_unit_id for poi in db_round.pois],
#             rebuttals=[
#                 RebuttalResponse(src=rebuttal.src, tgt=rebuttal.tgt)
#                 for rebuttal in db_round.rebuttals
#             ],
#             speeches=[
#                 SpeechResponse(
#                     argument_units=[
#                         ArgumentUnitResponse(
#                             sequence_id=au.sequence_id,
#                             start=au.start,
#                             end=au.end,
#                             text=au.text
#                         ) for au in speech.argument_units
#                     ]
#                 ) for speech in db_round.speeches
#             ]
#         ) for db_round in db_rounds
#     ]

# @router.get("/rounds-summary", response_model=List[RoundSummaryResponse])
# async def get_rounds_summary(db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     )
#     result = await db.execute(query)
#     db_rounds = result.scalars().unique().all()

#     return [
#         RoundSummaryResponse(
#             id=db_round.id,
#             video_id=db_round.video_id,
#             title=db_round.title,
#             description=db_round.description,
#             motion=db_round.motion,
#             date_uploaded=db_round.date_uploaded,
#             channel_id=db_round.channel_id,
#             tag=db_round.tag,
#             poi_count=len(db_round.pois),
#             rebuttal_count=len(db_round.rebuttals),
#             speech_count=len(db_round.speeches),
#             total_argument_units=sum(len(speech.argument_units) for speech in db_round.speeches)
#         ) for db_round in db_rounds
#     ]

# @router.get("/batch-rounds-with-features", response_model=List[RoundBatchWithFeaturesResponse])
# async def get_rounds_batch_with_features(db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     )
#     result = await db.execute(query)
#     db_rounds = result.scalars().unique().all()

#     response_list = []
#     for db_round in db_rounds:
#         # Convert to RoundBatchResponse format for feature calculation
#         round_data = {
#             "video_id": db_round.video_id,
#             "title": db_round.title,
#             "description": db_round.description,
#             "motion": db_round.motion,
#             "date_uploaded": db_round.date_uploaded,
#             "channel_id": db_round.channel_id,
#             "tag": db_round.tag,
#             "pois": [poi.argument_unit_id for poi in db_round.pois],
#             "rebuttals": [
#                 {"src": rebuttal.src, "tgt": rebuttal.tgt}
#                 for rebuttal in db_round.rebuttals
#             ],
#             "speeches": [
#                 {
#                     "argument_units": [
#                         {
#                             "sequence_id": au.sequence_id,
#                             "start": au.start,
#                             "end": au.end,
#                             "text": au.text
#                         } for au in speech.argument_units
#                     ]
#                 } for speech in db_round.speeches
#             ]
#         }
        
#         # Calculate features
#         features = calculate_features(round_data)
        
#         response_list.append(
#             RoundBatchWithFeaturesResponse(
#                 id=db_round.id,
#                 video_id=db_round.video_id,
#                 title=db_round.title,
#                 description=db_round.description,
#                 motion=db_round.motion,
#                 date_uploaded=db_round.date_uploaded,
#                 channel_id=db_round.channel_id,
#                 tag=db_round.tag,
#                 pois=[poi.argument_unit_id for poi in db_round.pois],
#                 rebuttals=[
#                     RebuttalResponse(src=rebuttal.src, tgt=rebuttal.tgt)
#                     for rebuttal in db_round.rebuttals
#                 ],
#                 speeches=[
#                     SpeechResponse(
#                         argument_units=[
#                             ArgumentUnitResponse(
#                                 sequence_id=au.sequence_id,
#                                 start=au.start,
#                                 end=au.end,
#                                 text=au.text
#                             ) for au in speech.argument_units
#                         ]
#                     ) for speech in db_round.speeches
#                 ],
#                 features=MacroStructuralFeatures(
#                     distance=features["distance"],
#                     interval=features["interval"],
#                     order=features["order"],
#                     rally=features["rally"]
#                 )
#             )
#         )
    
#     return response_list

# @router.get("/batch-rounds/{round_id}", response_model=RoundBatchResponse)
# async def get_round_batch(round_id: int, db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     ).filter_by(id=round_id)

#     result = await db.execute(query)
#     db_round = result.scalars().first()

#     if not db_round:
#         raise HTTPException(status_code=404, detail="Round not found")

#     logger.info(f"round.pois: {db_round.pois}")

#     return RoundBatchResponse(
#         video_id=db_round.video_id,
#         title=db_round.title,
#         description=db_round.description,
#         motion=db_round.motion,
#         date_uploaded=db_round.date_uploaded,
#         channel_id=db_round.channel_id,
#         tag=db_round.tag,

#         pois=[poi.argument_unit_id for poi in db_round.pois],
#         rebuttals=[
#             RebuttalResponse(src=rebuttal.src, tgt=rebuttal.tgt)
#             for rebuttal in db_round.rebuttals
#         ],
#         speeches=[
#             SpeechResponse(
#                 argument_units=[
#                     ArgumentUnitResponse(
#                         sequence_id=au.sequence_id,
#                         start=au.start,
#                         end=au.end,
#                         text=au.text
#                     ) for au in speech.argument_units
#                 ]
#             ) for speech in db_round.speeches
#         ]
#     )

# @router.get("/batch-rounds-list", response_model=List[RoundBatchResponse])
# async def get_rounds_batch(round_ids: List[int] = Query(...), db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     ).filter(round_db_model.Round.id.in_(round_ids))
#     result = await db.execute(query)
#     db_rounds = result.scalars().unique().all()

#     return [
#         RoundBatchResponse(
#             video_id=db_round.video_id,
#             title=db_round.title,
#             description=db_round.description,
#             motion=db_round.motion,
#             date_uploaded=db_round.date_uploaded,
#             channel_id=db_round.channel_id,
#             tag=db_round.tag,
#             pois=[poi.argument_unit_id for poi in db_round.pois],
#             rebuttals=[
#                 RebuttalResponse(src=rebuttal.src, tgt=rebuttal.tgt)
#                 for rebuttal in db_round.rebuttals
#             ],
#             speeches=[
#                 SpeechResponse(
#                     argument_units=[
#                         ArgumentUnitResponse(
#                             sequence_id=au.sequence_id,
#                             start=au.start,
#                             end=au.end,
#                             text=au.text
#                         ) for au in speech.argument_units
#                     ]
#                 ) for speech in db_round.speeches
#             ]
#         ) for db_round in db_rounds
#     ]

# @router.get("/rounds/{round_id}")
# async def get_round(round_id: int, db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).options(
#         selectinload(round_db_model.Round.pois),
#         selectinload(round_db_model.Round.rebuttals),
#         selectinload(round_db_model.Round.speeches).selectinload(
#             round_db_model.Speech.argument_units
#         ),
#     ).filter_by(id=round_id)
#     result = await db.execute(query)
#     round = result.scalars().first()
#     if round is None:
#         raise HTTPException(status_code=404, detail="Round not found")
#     return round

# @router.delete("/rounds/{round_id}")
# async def delete_round(round_id: int, db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).filter_by(id=round_id)
#     result = await db.execute(query)
#     round = result.scalars().first()
#     if round is None:
#         raise HTTPException(status_code=404, detail="Round not found")
#     await db.delete(round)
#     await db.commit()
#     logger.info(f"Round {round_id}: {round.title} deleted")
#     return {"message": f"Round {round_id}: {round.title} deleted"}

# @router.get("/video_metadata")
# async def get_video_metadata(video_id: str):
#     url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={video_id}&key={os.getenv('YOUTUBE_API_KEY')}"
#     async with httpx.AsyncClient() as client:
#         response = await client.get(url)
#         response.raise_for_status()
#         all_data = response.json()
#         metadata = all_data["items"][0]["snippet"]
#         return metadata

# @router.post("/rounds", response_model=RoundResponse)
# async def create_round(round_create: RoundCreate, db: AsyncSession = Depends(get_db)): # Roundレコードを作成
#     # Removed speeches count validation to allow empty speeches for initial round creation
    
#     logger.info(f"round_create.title: {round_create.motion}, is empty?: {round_create.motion == ''}")
    
#     if round_create.video_id == "":
#         raise HTTPException(status_code=400, detail="Video id must not be empty.")
    
#     # 動画のmetaデータの取得
#     video_id = round_create.video_id
#     url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id={video_id}&key={os.getenv('YOUTUBE_API_KEY')}"
#     async with httpx.AsyncClient() as client:
#         response = await client.get(url)
#         response.raise_for_status()
#         all_data = response.json()
#         metadata = all_data["items"][0]["snippet"]

#     # メタデータからタグを取得し、エスケープ処理を行う
#     video_tag = ""
#     if "tags" in metadata and metadata["tags"]:
#         video_tag = html.escape(str(metadata["tags"][0])) + ","

#     secure_description = html.escape(remove_invalid_characters(metadata["description"]))

#     round = round_db_model.Round(
#         video_id = round_create.video_id,
#         motion = round_create.motion,
#         title = metadata["title"],
#         description = secure_description,
#         date_uploaded = metadata["publishedAt"],
#         channel_id = metadata["channelId"],
#         tag = video_tag+round_create.tag
#     )
#     db.add(round)
    
#     speeches = []
#     fixed_pois = []

#     start_time = time.time()  # 開始時間を記録

#     # ここでsegment2argment_unitsの処理を並行実行
#     segment_tasks = [segment2argument_units(speech_create) for speech_create in round_create.speeches]
#     segment_results = await asyncio.gather(*segment_tasks)  # 並行実行して結果を待つ

#     logger.info(f"segment_results: {segment_results}")
#     logger.info(f"poi_segment_ids: {round_create.poi_segment_ids}")

#     tmp_segment_id = 0
#     poi_local_ids = [[] for _ in range(len(round_create.speeches))]
#     for speech_id, speech in enumerate(round_create.speeches):
#         for local_segment_id, segment in enumerate(speech):
#             if tmp_segment_id in round_create.poi_segment_ids:
#                 logger.info(f"`POI->{tmp_segment_id}th segment: {segment.text}")
#                 poi_local_ids[speech_id].append(local_segment_id)
#             tmp_segment_id += 1
    
#     logger.info(f"poi_local_ids: {poi_local_ids}")

#     sequence_id = 0
#     for idx, first_seg_ids in enumerate(segment_results):
#         logger.info(f"{idx}th speech-----------------")
#         speech_create = round_create.speeches[idx]
#         argument_units = []

#         fixed_arg_heads = first_seg_ids

#         poi_arg_units = group_consecutive(poi_local_ids[idx])
        
#         poi_based_head_pairs = []
#         for poi_arg_unit in poi_arg_units:
#             first_poi_based_head = poi_arg_unit[0]
#             last_poi_based_head = poi_arg_unit[-1]+1
#             poi_based_head_pairs.append((first_poi_based_head, last_poi_based_head))
#             for arg_head in first_seg_ids:
#                 if first_poi_based_head < arg_head < last_poi_based_head:
#                     fixed_arg_heads.remove(arg_head)
        
#         for poi_based_heads in poi_based_head_pairs:
#             if poi_based_heads[0] not in fixed_arg_heads:
#                 fixed_arg_heads.append(poi_based_heads[0])
#             if poi_based_heads[1] not in fixed_arg_heads:
#                 fixed_arg_heads.append(poi_based_heads[1])
        
#         fixed_arg_heads.sort()

#         logger.info(f"before         : {segment_results[idx]}")
#         logger.info(f"fixed_arg_heads: {fixed_arg_heads}")
#         logger.info(f"poi_based_head_pairs: {poi_based_head_pairs}")
        
#         for i in range(len(fixed_arg_heads)):
#             first_seg_id = fixed_arg_heads[i]

#             if i == len(fixed_arg_heads) - 1:
#                 last_seg_id = len(speech_create) - 1
#             elif fixed_arg_heads[i] == fixed_arg_heads[i+1]:
#                 last_seg_id = fixed_arg_heads[i]
#             else:
#                 last_seg_id = fixed_arg_heads[i+1] - 1

#             logger.info(f"len_speech_create: {len(speech_create)} first_seg_id: {first_seg_id}, last_seg_id: {last_seg_id}")
            
#             segment_texts = [speech_create[j].text.strip() for j in range(first_seg_id, last_seg_id + 1)]
#             plain_text = ' '.join(segment_texts)

#             if first_seg_id < 0 or first_seg_id >= len(speech_create) or last_seg_id < 0 or last_seg_id >= len(speech_create):
#                 logger.error(f"Index out of range: first_seg_id={first_seg_id}, last_seg_id={last_seg_id}, len_speech_create={len(speech_create)}")
#                 continue
#             argument_units.append(
#                 round_db_model.ArgumentUnit(
#                     sequence_id=sequence_id,
#                     start=speech_create[first_seg_id].start,
#                     end=speech_create[last_seg_id].end,
#                     text=plain_text,
#                 )
#             )

#             # fixed_poisへの追加
#             if first_seg_id in [pair[0] for pair in poi_based_head_pairs]: # POIの先頭のsegmentの場合
#                 fixed_pois.append(round_db_model.Poi(argument_unit_id=sequence_id, round=round))
#                 logger.info(f"This is POI: {sequence_id}, text: {plain_text}")

#             sequence_id += 1
        
#         # スピーチとArgument Unitsをデータベースに保存するためのリストに追加
#         speeches.append(
#             round_db_model.Speech(argument_units=argument_units, round=round)
#         )
    
#     db.add_all(speeches)  # スピーチをデータベースに追加

#     #POIの処理
#     db.add_all(fixed_pois)

#     fixed_poi_ids = [poi.argument_unit_id for poi in fixed_pois]

#     # GPTによる反論判定
#     rebuttals = await speeches2rebuttals(fixed_poi_ids, speeches)
#     logger.info("反論:"+str(rebuttals))
#     db_rebuttals = []
#     for rebuttal in rebuttals:
#         db_rebuttals.append(
#             round_db_model.Rebuttal(
#                 src=rebuttal.src,
#                 tgt=rebuttal.tgt,
#                 round=round
#             )
#         )
#     db.add_all(db_rebuttals)

#     # ここまでの変更全てをコミット
#     await db.commit()
#     await db.refresh(round)

#     # roundデータを取得し、関連するリレーションをロード
#     await db.execute(
#         select(round_db_model.Round)
#         .options(
#             selectinload(round_db_model.Round.rebuttals),
#             selectinload(round_db_model.Round.pois),
#             selectinload(round_db_model.Round.speeches).selectinload(
#                 round_db_model.Speech.argument_units
#             ),
#         )
#         .filter_by(id=round.id)
#     )

#     end_time = time.time()  # 終了時間を記録
#     logger.info(f"非同期処理の実行時間: {end_time - start_time}秒")

#     return round

# class DigestRequest(BaseModel):
#     digest: str

# @router.post("/motion")
# async def create_motion(round_digest: DigestRequest):
#     return await digest2motion(round_digest)

# @router.post("/batch-round")
# async def create_batch_round(round_create: RoundBatchCreate, db: AsyncSession = Depends(get_db)):
#     # Removed speeches count validation to allow flexible speech counts
    
#     logger.info(f"round_create.title: {round_create.title}, is empty?: {round_create.title == ''}")
    
#     if round_create.title == "":
#         raise HTTPException(status_code=400, detail="Title must not be empty.")

#     round = round_db_model.Round(
#         title=round_create.title,
#         motion=round_create.motion,
#         video_id=round_create.video_id,
#         description=round_create.description,
#         date_uploaded=round_create.date_uploaded,
#         channel_id=round_create.channel_id,
#         tag=round_create.tag
#     )
#     db.add(round)
    
#     logger.info(f"type of speeches[0].argunits is : {type(round_create.speeches[0])}")

#     db_speeches = []
#     for argument_units in round_create.speeches:
#         db_argument_units = []
#         for arg_unit in argument_units.argument_units:
#             db_argument_units.append(
#                 round_db_model.ArgumentUnit(
#                     sequence_id=arg_unit.sequence_id,
#                     start=arg_unit.start,
#                     end=arg_unit.end,
#                     text=arg_unit.text,
#                 )
#             )

#         db_speeches.append(
#             round_db_model.Speech(
#                 argument_units=db_argument_units,
#                 round=round
#             )
#         )
#     db.add_all(db_speeches)

#     db_rebuttals = []
#     for rebuttal in round_create.rebuttals:
#         db_rebuttals.append(
#             round_db_model.Rebuttal(
#                 src=rebuttal.src,
#                 tgt=rebuttal.tgt,
#                 round=round
#             )
#         )
#     db.add_all(db_rebuttals)

#     db_pois = []
#     for poi in round_create.pois:
#         db_pois.append(
#             round_db_model.Poi(
#                 argument_unit_id=poi,
#                 round=round
#             )
#         )
#     db.add_all(db_pois)

#     # ここまでの変更全てをコミット
#     await db.commit()
#     await db.refresh(round)

#     # roundデータを取得し、関連するリレーションをロード
#     await db.execute(
#         select(round_db_model.Round)
#         .options(
#             selectinload(round_db_model.Round.rebuttals),
#             selectinload(round_db_model.Round.pois),
#             selectinload(round_db_model.Round.speeches).selectinload(
#                 round_db_model.Speech.argument_units
#             ),
#         )
#         .filter_by(id=round.id)
#     )

#     return round

# @router.post("/batch-rounds", response_model=str)
# async def create_batch_rounds(rounds: List[RoundBatchCreate], db: AsyncSession = Depends(get_db)):
#     for round_create in rounds:
#         round = await create_batch_round(round_create, db)
#     return "Batch rounds created successfully."

# @router.post("/rounds/tag/{round_id}")
# async def edit_tag(round_id: int, tag: str, db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).filter_by(id=round_id)
#     result = await db.execute(query)
#     db_round = result.scalars().first()
#     if db_round is None:
#         raise HTTPException(status_code=404, detail="Round not found")
#     db_round.tag = tag
#     await db.commit()
#     await db.refresh(db_round)
#     return db_round

# @router.post("/rounds/video_id/{round_id}")
# async def edit_video_id(round_id: int, video_id: str, db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.Round).filter_by(id=round_id)
#     result = await db.execute(query)
#     db_round = result.scalars().first()
#     if db_round is None:
#         raise HTTPException(status_code=404, detail="Round not found")
#     db_round.video_id = video_id
#     await db.commit()
#     await db.refresh(db_round)
#     return db_round

# # 操作ログ用エンドポイント
# class OperationLogRequest(BaseModel):
#     operation: str
#     data: Dict

# @router.post("/log/operation")
# async def log_operation(operation_log: OperationLogRequest, db: AsyncSession = Depends(get_db)):
#     jst = pytz.timezone('Asia/Tokyo')
#     readable_current_time = datetime.now(jst).strftime("%Y-%m-%d %H:%M:%S.%f")[:-4]
#     logger.info(f"{readable_current_time}: Operation is logged: {operation_log}")
#     db.add(round_db_model.OperationLog(
#         operation=operation_log.operation,
#         timestamp=readable_current_time,
#         data=operation_log.data,
#     ))
#     await db.commit()
#     return "Operation logged successfully: " + str(operation_log)

# @router.get("/log/operation")
# async def get_operation_logs(db: AsyncSession = Depends(get_db)):
#     query = select(round_db_model.OperationLog)
#     result = await db.execute(query)
#     logs = result.scalars().all()
#     return logs

