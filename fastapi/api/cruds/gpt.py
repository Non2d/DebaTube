from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from dotenv import load_dotenv
from log_config import logger

import asyncio

load_dotenv()
client = AsyncOpenAI()

class Segment(BaseModel):
    start: float
    end: float
    text: str

class FirstSegmentIds(BaseModel):
    segment_ids: list[int] =  Field(..., description="The list of first segment's id in each argumentative unit.")

# segmentのリストから、各argument_unitの最後のsegmentのidを取得
async def segment2argument_units(speech: list[Segment]) -> list[FirstSegmentIds]:
    prompt_segments = ""
    for id, segment in enumerate(speech):
        prompt_segments += f"{id}:{segment.text}\n"

    response = await client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Regroup the given segments into argumentative units of 1 to 5 segments each and return the list of the first segment's id in each unit. The scheme of output is just a list of indices. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST."},
            {"role": "user", "content": "NO ARGUMENT UNIT CAN HAVE MORE THAN 5 SEGMENTS."},
            {"role": "user", "content": "Argumentative units are elementary argumentation factors, such as claims, cases, and rebuttals."},
            {"role": "user", "content": f"Given segments: {prompt_segments}"},
        ],
        response_format=FirstSegmentIds,
    )

    first_seg_ids = response.choices[0].message.parsed.segment_ids

    logger.info(f"firstSegIds: {first_seg_ids}")

    return first_seg_ids

#キャッシュが悪さして大爆発した
async def segment2argument_units_unstructured(speech: list[Segment]) -> list[list[Segment]]:
    prompt_segments = ""
    for id, segment in enumerate(speech):
        prompt_segments += f"{id}:{segment.text}\n"

    response = await client.chat.completions.create(
        model="gpt-4o-2024-08-06",
        messages=[
            {"role": "user", "content": "Regroup the given segments into argumentative units of 1 to 5 segments each. The scheme of output is a list of lists of segments."},
            {"role": "user", "content": "NO ARGUMENT UNIT CAN HAVE MORE THAN 5 SEGMENTS."},
            {"role": "user", "content": "Argumentative units are elementary argumentation factors, such as claims, cases, and rebuttals."},
            {"role": "user", "content": f"Given segments: {prompt_segments}"},
        ],
    )

    first_seg_ids_text = response.choices[0].message.content
    logger.info(f"firstSegIds: {first_seg_ids_text}")

    first_seg_ids = [int(id) for id in first_seg_ids_text[1:-1].split(",")]
    
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
    
    tasks = [
    argument_units2rebuttals(speeches[pair[0]], speeches[pair[1]])
    for pair in rebuttal_speech_pair_ids
    ]

    results = await asyncio.gather(*tasks)

    rebuttals=[]
    for result in results:
        rebuttals += result
    
    sorted_rebuttals = sorted(rebuttals, key=lambda x: (x.src, x.tgt)) # srcの順でソート->srcが同じならtgtの順でソート

    return sorted_rebuttals


async def argument_units2rebuttals(src_speech: list[ArgumentUnit], tgt_speech: list[ArgumentUnit]) -> list[Rebuttal]:
    prompt_src = ""
    prompt_tgt = ""

    for argument_unit in src_speech.argument_units:
        prompt_src += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    for argument_unit in tgt_speech.argument_units:
        prompt_tgt += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    
    response = await client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06",
        messages=[
            {"role": "user", "content": "Identify all rebuttals present from the following speech, and return them as a list of tuples in the form of [source_id, target_id]."},
            {"role": "user", "content": "Each argument unit can rebut to at most one opponent's argument unit."},
            {"role": "user", "content": "Note that rebuttals are direct response to the opponents, typically starting with rephrasing the opponents' arguments they are focusing on."},
            {"role": "user", "content": f"Source speech: {prompt_src}"},
            {"role": "user", "content": f"Target speech: {prompt_tgt}"},
        ],
        response_format=Rebuttals,
    )

    rebuttals = response.choices[0].message.parsed.rebuttals

    return rebuttals

async def digest2motion(digest: str) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "Given a transcript of a competitive debate round, tell me the motion of this round in the form of This house ..."},
            {"role": "user", "content": "DO NOT RETURN ANYTHING OTHER THAN THE MOTION."},
            {"role": "user", "content": "Transcript: "+str(digest)},
        ],
    )

    motion = response.choices[0].message.content

    result = "<GPT prop> " + motion

    return result