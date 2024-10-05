from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from dotenv import load_dotenv
from log_config import logger
from typing import List

load_dotenv()
client = AsyncOpenAI()

class Segment(BaseModel):
    start: float
    end: float
    text: str

class FirstSegmentIds(BaseModel):
    segment_ids: list[int] =  Field(..., description="The list of first segment's id in each argumentative unit.")

# segmentのリストから、各argument_unitの最後のsegmentのidを取得
async def segment2argment_units(speech: list[Segment]) -> list[FirstSegmentIds]:
    prompt_segments = ""
    for id, segment in enumerate(speech):
        prompt_segments += f"{id}:{segment.text}\n"

    response = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Regroup the given segments to argumentat units and return the list of first segment's id in each unit. The scheme of output is just a list of index. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST."},
            {"role": "user", "content": "Argumentative units are elementary argumentation factors, such as claims, cases, and rebuttals. Note that especially numbering indicates the border of each argumentative unit."},
            {"role": "user", "content": f"Given segments: {prompt_segments}"},
        ],
        response_format=FirstSegmentIds,
    )

    first_seg_ids = response.choices[0].message.parsed.segment_ids

    logger.info(f"firstSegIds: {first_seg_ids}")

    return first_seg_ids

class ArgumentUnit(BaseModel):
    sequence_id: int
    start: float
    end: float
    text: str

class Rebuttal(BaseModel):
    src: int
    tgt: int

class Rebuttals(BaseModel):
    rebuttals: list[Rebuttal]=Field(..., description="The list of rebuttals in the form of [source_id, target_id].")

async def speeches2rebuttals(speeches: list[list[Segment]]) -> list[Rebuttal]:
    rebuttal_speech_pair_ids = []
    if len(speeches)==6:
        rebuttal_speech_pair_ids = [(1,0),(2,1),(3,0),(3,2),(4,0),(4,2),(5,1),(5,3),(5,4)]
    elif len(speeches)==8:
        rebuttal_speech_pair_ids = [(1,0),(2,1),(3,0),(3,2),(4,1),(4,3),(5,0),(5,2),(5,4),(6,0),(6,2),(6,4),(7,1),(7,3),(7,5),(7,6)]
    
    rebuttals = []
    for pair in rebuttal_speech_pair_ids:
        rebuttals += await argument_units2rebuttals(speeches[pair[0]], speeches[pair[1]])
    
    return rebuttals


async def argument_units2rebuttals(src_speech: list[ArgumentUnit], tgt_speech: list[ArgumentUnit]) -> list[Rebuttal]:
    prompt_src = ""
    for argument_unit in src_speech:
        prompt_src += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    prompt_tgt = ""
    for argument_unit in tgt_speech:
        prompt_tgt += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    
    response = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Identify all rebuttals present from the following speech, and return them as a list of tuples in the form of [source_id, target_id]."},
            {"role": "user", "content": f"Source speech: {prompt_src}"},
            {"role": "user", "content": f"Target speech: {prompt_tgt}"},
        ],
        response_format=Rebuttals,
    )

    rebuttals = response.choices[0].message.parsed.rebuttals

    return rebuttals





