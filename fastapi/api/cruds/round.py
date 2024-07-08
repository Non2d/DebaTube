from typing import List

from logging_config import logger

import asyncio

import sqlalchemy

from sqlalchemy.orm import Session

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import models.round as round_model
import schemas.round as round_schema
import datetime

from fastapi import BackgroundTasks

from logging_config import logger
from openai_client import argument_mining_by_llm, argument_mining_by_llm_sync, identify_rebuttal_sync

from starlette.concurrency import run_in_threadpool

async def create_round(
    db: AsyncSession, round_create: round_schema.RoundCreate
) -> round_model.Round:
    # Roundオブジェクトを作成
    round = round_model.Round(
        created_at=datetime.datetime.now(),
        updated_at=datetime.datetime.now(),
        deleted_at=None,
        motion=round_create.motion,
        source=round_create.source.model_dump(),
        POIs=round_create.POIs,
    )
    db.add(round)

    # Rebuttalsオブジェクトを作成
    rebuttals = [
        round_model.Rebuttal(src=rebuttal.src, tgt=rebuttal.tgt, round=round)
        for rebuttal in round_create.rebuttals
    ]
    db.add_all(rebuttals)

    # SpeechesおよびADUsオブジェクトを作成
    speeches = [
        round_model.Speech(start_time=speech_create.start_time, round=round)
        for speech_create in round_create.speeches
    ]
    db.add_all(speeches)

    # 一度にコミット
    await db.commit()
    await db.refresh(round)

    # 関係のロード
    await db.execute(
        select(round_model.Round)
        .options(
            selectinload(round_model.Round.rebuttals),
            selectinload(round_model.Round.speeches)
            .selectinload(round_model.Speech.ADUs)
            .selectinload(round_model.ADU.segments),
        )
        .filter_by(id=round.id)
    )
    return round

async def get_rounds(db: AsyncSession) -> List[any]:
    result = await db.execute(
        select(round_model.Round).options(
            selectinload(round_model.Round.rebuttals),
            selectinload(round_model.Round.speeches)
            .selectinload(round_model.Speech.ADUs)
            .selectinload(round_model.ADU.segments),
        )
    )
    rounds = result.scalars().unique().all()
    return rounds

async def get_round(db: AsyncSession, round_id: int) -> round_model.Round:
    result = await db.execute(
        select(round_model.Round)
        .options(
            selectinload(round_model.Round.rebuttals),
            selectinload(round_model.Round.speeches)
            .selectinload(round_model.Speech.ADUs)
            .selectinload(round_model.ADU.segments),
        )
        .filter(round_model.Round.id == round_id)
    )
    round = result.scalars().unique().first()
    return round

# 非同期でspeech_idのスピーチのSegmentを更新
async def update_speech_asr(
    db: AsyncSession, background_tasks:BackgroundTasks, speech_id: int, segments: List[round_schema.SegmentCreate]
) -> List[round_model.Segment]:
    db_segments = [
        round_model.Segment(
            start=segment.start, end=segment.end, text=segment.text, speech_id=speech_id
        )
        for segment in segments
    ]
    db.add_all(db_segments)
    await db.commit()
    for db_segment in db_segments:
        await db.refresh(db_segment)
    background_tasks.add_task(argument_mining_by_llm, db, db_segments, speech_id)
    return db_segments

# 同期的にspeech_idのスピーチのSegmentを更新し、返り値としてADUを返す
def update_speech_asr_sync(
    db: AsyncSession, speech_id: int, segments: List[round_schema.SegmentCreate]
) -> List[round_model.ADU]:
    db_segments = [
        round_model.Segment(
            start=segment.start, end=segment.end, text=segment.text, speech_id=speech_id
        )
        for segment in segments
    ]
    db.add_all(db_segments)
    db.commit()
    for db_segment in db_segments:
        db.refresh(db_segment)
    ADUs = argument_mining_by_llm_sync(db, db_segments, speech_id)
    logger.info("This is our presenttaion: %s", ADUs)

    return ADUs
    
async def update_round_asr(
    db: AsyncSession, background_tasks: BackgroundTasks, round_id: int, segments_list: List[List[round_schema.SegmentCreate]]
) -> List[List[round_model.Segment]]:
    #ここでは一切dbに触れない
    #round_idのspeech_idのリストを取得
    result = await db.execute(
        select(round_model.Speech).filter(round_model.Speech.round_id == round_id)
    )
    speeches = result.scalars().unique().all()
    speech_ids = [speech.id for speech in speeches]
    logger.info("segments_list is: %s", speech_ids)
    logger.info("segments_list is: %s", segments_list)
    
    #全てのspeech_idに対して、update_speech_asrを実行
    db_segments_list = []
    for i, speech_id in enumerate(speech_ids):
        db_segments = await update_speech_asr(db, background_tasks, speech_id, segments_list[i])
    db_segments_list = [db_segments]
    return db_segments_list

def update_round_asr_sync(
    db: Session, round_id: int, segments_list: List[List[round_schema.SegmentCreate]]
) -> List[round_model.ADU]:
    result = db.execute(
        select(round_model.Speech).filter(round_model.Speech.round_id == round_id)
    )
    speeches = result.scalars().unique().all()
    speech_ids = [speech.id for speech in speeches]

    if len(speech_ids)!=len(segments_list):
        raise ValueError("speech_ids and segments_list length must be the same")
    
    ADUs_list = []
    for speech_id, segments in zip(speech_ids, segments_list):
        ADUs_list.append(update_speech_asr_sync(db, speech_id, segments))
    
    speech_inputs = [] #promptで使う反論
    rebuttal_identify_prompts = []
    adu_id = 0
    for speech_id, speech in enumerate(ADUs_list):
        tmp_adu_list = []
        for adu in speech:
            tmp_adu_dict = {}
            tmp_adu_dict[adu_id] = adu.transcript # {1:"xxx", 2:"yyy"}の形式にするために辞書を使用
            tmp_adu_list.append(tmp_adu_dict)

            adu.sequence_id = adu_id #このaduのレコードに、sequence_idを追加。反論生成時の入力との一貫性を担保するため、このタイミングで計算・追加する
            db.add(adu)
            adu_id += 1 #超注意！！！adu_idの更新はこのループの一番最後に行う！！！！
        speech_inputs.append(tmp_adu_list)

    rebuttal_id_prompt_base = "Identify all rebuttals present from the following speech, and return them as a list of tuples, where each tuple represents a rebuttal and contains the id of rebuttal source and the id of rebuttal target."
    if len(speech_ids) == 6:
        rebuttal_identify_prompts.append(f"{rebuttal_id_prompt_base}. The 1st opposition speech's argument units are: {speech_inputs[1]}. This speech targets the 1st proposition, which contains these argument units: {speech_inputs[0]}. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST OF TUPLES AND DO NOT INSERT A LINE BREAK.")
        rebuttal_identify_prompts.append(f"{rebuttal_id_prompt_base}. The 2nd proposition speech's argument units are: {speech_inputs[2]}. For its rebuttal, this speech targets the 1st opposition, whose argument units are {speech_inputs[1]}. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST OF TUPLES AND DO NOT INSERT A LINE BREAK.")        
        rebuttal_identify_prompts.append(f"{rebuttal_id_prompt_base}. The 2nd opposition speech's argument units are: {speech_inputs[3]}. For its rebuttal, this speech targets the 2nd proposition, whose argument units are {speech_inputs[2]} and the 1st proposition, whose argument units are {speech_inputs[0]}. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST OF TUPLES AND DO NOT INSERT A LINE BREAK.")
        rebuttal_identify_prompts.append(f"{rebuttal_id_prompt_base}. The 3rd opposition speech's argument units are: {speech_inputs[4]}. For its rebuttal, this speech targets the 2nd proposition, whose argument units are {speech_inputs[2]} and the 1st proposition, whose argument units are {speech_inputs[0]}. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST OF TUPLES AND DO NOT INSERT A LINE BREAK.")
        rebuttal_identify_prompts.append(f"{rebuttal_id_prompt_base}. The 3nd proposition speech's argument units are: {speech_inputs[5]}. For its rebuttal, this speech targets the 3rd opposition, whose argument units are {speech_inputs[4]}, the 2nd opposition, whose argument units are {speech_inputs[3]}, and the 1st opposition, whose argument units are {speech_inputs[1]}. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST OF TUPLES AND DO NOT INSERT A LINE BREAK.")
        
    db.commit()
    logger.info("This is our rebuttal_input : %s", str(rebuttal_identify_prompts))

    #ついに反論を生成する
    rebuttals = identify_rebuttal_sync(db, prompts = rebuttal_identify_prompts, round_id=round_id)
    # 関心グチャグチャだけど、どうしようかな。現状、identify関数内でdbを更新

    return [] #リファクタ必須やな


async def get_speech_asr(db: AsyncSession, speech_id: int) -> round_model.Segment:
    result = await db.execute(
        select(round_model.Segment)
        .join(round_model.Speech)
        .join(round_model.Round)
        .filter(round_model.Round.id == speech_id)
    )
    segments = result.scalars().unique().all()
    return segments