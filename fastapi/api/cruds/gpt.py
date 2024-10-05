from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
# from schemas.round import RebuttalResponse
from log_config import logger

load_dotenv()
client = OpenAI()

class Segment(BaseModel):
    start: float
    end: float
    text: str

class FirstSegmentIds(BaseModel):
    segment_ids: list[int]

# segmentのリストから、各argument_unitの最後のsegmentのidを取得
async def segment2argment_units(speech: list[Segment]) -> FirstSegmentIds:
    segments = ""
    for id, segment in enumerate(speech):
        segments += f"{id}:{segment.text};"

    response = client.beta.chat.completions.parse(
        model="gpt-4o-2024-08-06",
        messages=[
            {"role": "system", "content": "Regroup the given transcript of competitive debates into argumentative units and return the first segment's id of each unit. Argument units are elementary factors of debates."},
            {"role": "user", "content": f"The given transcript is as follows: {segments}"},
        ],
        response_format=FirstSegmentIds,
    )

    logger.info(f"response: {response}")
    first_seg_ids = response.choices[0].message.parsed.segment_ids
    return first_seg_ids

class Rebuttal(BaseModel):
    src: int
    tgt: int

async def argument_units2rebuttals():
    pass