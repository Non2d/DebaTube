# from sqlalchemy.ext.asyncio import AsyncSession

# import models.debate as debate_model
# import schemas.debate as debate_schema

# from typing import List
# from sqlalchemy.sql import select
# from sqlalchemy.engine import Result

# from sqlalchemy.orm import joinedload

# async def create_round(
#         db: AsyncSession, debate_create: debate_schema.RoundCreate
# ) -> debate_model.Round:
#     source_model = debate_model.Source(title=debate_create.source.title, url=debate_create.source.url)
#     motion_model = debate_model.Motion(original=debate_create.motion.original, translated_JP=debate_create.motion.translated_JP)
#     speeches_model = []
#     for speech in debate_create.speeches:
#         adus_model = [debate_model.ADU(transcript=adu.transcript, translated_JP=adu.translated_JP) for adu in speech.ADUs]
#         speech_model = debate_model.Speech(side=speech.side, ADUs=adus_model)
#         speeches_model.append(speech_model)
#     rebuttal_model = [debate_model.Rebuttal(src=rebuttal.src, dst=rebuttal.dst) for rebuttal in debate_create.rebuttals]

#     debate = debate_model.Round(source=source_model, motion=motion_model, speeches=speeches_model, rebuttals=rebuttal_model, POIs=debate_create.POIs)
#     db.add(debate)
#     await db.commit()
#     await db.refresh(debate)
#     return debate

# async def get_rounds(db: AsyncSession) -> List[debate_model.Round]:
#     result : Result = await (
#         db.execute(
#             select(debate_model.Round)
#         )
#     )
#     return result.scalars().all()

# # putでidのroundが存在するか判定するために取得
# async def get_round(db: AsyncSession, round_id:int) -> debate_model.Round:
#     result : Result = await (
#         db.execute(
#             select(debate_model.Round).options(joinedload(debate_model.Round.speeches)).filter(debate_model.Round.id == round_id)
#         )
#     )
#     round: debate_model.Round = result.first()
#     return round[0] if round is not None else None

# async def update_round(
#         db:AsyncSession, round_create:debate_schema.RoundCreate, original: debate_model.Round
# ) -> debate_model.Round:
#     original.motion = round_create.motion
#     original.source = round_create.source
#     original.rebuttals = round_create.rebuttals
#     original.POIs = round_create.POIs
#     original.speeches = round_create.speeches
#     db.add(original)
#     await db.commit()
#     await db.refresh(original)
#     return original