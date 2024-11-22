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

repeated_num = 4
try_num = 10

# class FirstSegmentIds(BaseModel):
#     segment_ids: list[int] =  Field(..., description="The list of first segment's id in each argumentative unit.")
#     argument_topics: list[str] = Field(..., description="The theme of the argumentative unit.")
#     reasonings: list[str] = Field(..., description="The reasoning as to why GPT thinks the segments belong to an argumentative unit.")

class ArgumentUnitMetaData(BaseModel):
    first_segment_id: int = Field(..., description="The first segment's id in the argumentative unit.")
    argument_topic: str = Field(..., description="The theme of the argumentative unit.")
    reasoning: str = Field(..., description="The reasoning as to why GPT thinks the segments belong to an argumentative unit.")

class ArgumentUnitMetaDataList(BaseModel):
    argument_units: list[ArgumentUnitMetaData] = Field(..., description="The list of argument units with metadata.")

# segmentのリストから、各argument_unitの最後のsegmentのidを取得
async def segment2argument_units(speech: list[Segment]) -> list[int]:
    prompt_segments = ""
    for id, segment in enumerate(speech):
        prompt_segments += f"{id}:{segment.text}\n"

    response = await client.beta.chat.completions.parse(
        model="gpt-4o-2024-11-20",
        messages=[
            {"role": "user", "content": "Regroup the given segments into argumentative units of 1 to 5 segments each and return the list of the first segment's id in each unit. The scheme of output is just a list of indices. YOU MUST NOT RETURN ANYTHING OTHER THAN THE LIST."},
            {"role": "user", "content": "NO ARGUMENT UNIT CAN HAVE MORE THAN 5 SEGMENTS."},
            {"role": "user", "content": "Argumentative units are elementary argumentation factors, such as claims, cases, and rebuttals."},
            {"role": "user", "content": f"Given segments: {prompt_segments}"},
        ],
        # response_format=FirstSegmentIds,
        response_format=ArgumentUnitMetaDataList,
    )
    
    # first_seg_ids = response.choices[0].message.parsed.segment_ids
    # au_topic = response.choices[0].message.parsed.argument_topic
    # au_decision_reasoning = response.choices[0].message.parsed.reasoning

    # logger.info(f"firstSegIds: {first_seg_ids}")
    # logger.info(f"argument_topic: {au_topic}")
    # logger.info(f"reasoning: {au_decision_reasoning}")

    first_seg_ids = [argument_unit.first_segment_id for argument_unit in response.choices[0].message.parsed.argument_units]
    argument_topics = [argument_unit.argument_topic for argument_unit in response.choices[0].message.parsed.argument_units]
    reasonings = [argument_unit.reasoning for argument_unit in response.choices[0].message.parsed.argument_units]
    
    logger.info("argument unit meta data---------------------------------")
    logger.info(f"firstSegIds: {first_seg_ids}")
    logger.info(f"argument_topics: {argument_topics}")
    logger.info(f"reasonings: {reasonings}")
    logger.info("---------------------------------------------------------")

    return first_seg_ids

#キャッシュが悪さして大爆発した
async def segment2argument_units_unstructured(speech: list[Segment]) -> list[list[Segment]]:
    prompt_segments = ""
    for id, segment in enumerate(speech):
        prompt_segments += f"{id}:{segment.text}\n"

    response = await client.chat.completions.create(
        model="gpt-4o-2024-11-20",
        messages=[
            {"role": "user", "content": "Regroup the given segments into argumentative units. The scheme of output is a list of lists of segments."},
            {"role": "user", "content": "An argument unit is consisted of 1 to 5 segments."},
            {"role": "user", "content": "Argumentative units are elementary argumentation factors, such as claims, cases, and rebuttals, which is the minimal range of argumentation that can be attacked by a very specified counterargument."},
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

    #被りを見つける用
    def __eq__(self, other):
        if isinstance(other, Rebuttal):
            return self.src == other.src and self.tgt == other.tgt
        return False

    def __hash__(self):
        return hash((self.src, self.tgt))

class Rebuttals(BaseModel):
    rebuttals: list[Rebuttal]=Field(..., description="The list of rebuttals in the form of [source_id, target_id].")

async def speeches2rebuttals(speeches: list[list[Segment]]) -> list[Rebuttal]:
    rebuttal_speech_pair_ids = []
    if len(speeches)==6:
        rebuttal_speech_pair_ids = [(1,0),(2,1),(3,0),(3,2),(4,0),(4,2),(5,1),(5,3),(5,4)]
    elif len(speeches)==8:
        rebuttal_speech_pair_ids = [(1,0),(2,1),(3,0),(3,2),(4,1),(4,3),(5,0),(5,2),(5,4),(6,0),(6,2),(6,4),(7,1),(7,3),(7,5),(7,6)]
    
    tasks = [
    argument_units2rebuttals_repeated_combined(speeches[pair[0]], speeches[pair[1]]) #切り替え
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
        model="gpt-4o-2024-11-20",
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

def find_common_rebuttals(rebuttals_list: list[list[Rebuttal]]) -> list[Rebuttal]:
    rebuttal_count = {}
    for rebuttals in rebuttals_list:
        for rebuttal in rebuttals:
            if rebuttal in rebuttal_count:
                rebuttal_count[rebuttal] += 1
            else:
                rebuttal_count[rebuttal] = 1

    common_rebuttals = [rebuttal for rebuttal, count in rebuttal_count.items() if count >= repeated_num]
    return common_rebuttals
async def argument_units2rebuttals_repeated(src_speech: list[ArgumentUnit], tgt_speech: list[ArgumentUnit]) -> list[Rebuttal]:
    prompt_src = ""
    prompt_tgt = ""

    for argument_unit in src_speech.argument_units:
        prompt_src += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    for argument_unit in tgt_speech.argument_units:
        prompt_tgt += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    
    completions = await client.beta.chat.completions.parse(
        model="gpt-4o-2024-11-20",
        messages=[
            {"role": "user", "content": "Identify all rebuttals present from the following speech, and return them as a list of tuples in the form of [source_id, target_id]."},
            {"role": "user", "content": "Each argument unit can rebut to at most one opponent's argument unit."},
            {"role": "user", "content": "Note that rebuttals are direct response to the opponents, typically starting with rephrasing the opponents' arguments they are focusing on."},
            {"role": "user", "content": f"Source speech: {prompt_src}"},
            {"role": "user", "content": f"Target speech: {prompt_tgt}"},
        ],
        n=try_num,
        response_format=Rebuttals,
    )

    rebuttals_list = []
    for choice in completions.choices:
        logger.info(choice.message.parsed.rebuttals)
        rebuttals_list.append(choice.message.parsed.rebuttals)

    repeated_rebuttals = find_common_rebuttals(rebuttals_list)
    rebuttals = repeated_rebuttals
    return rebuttals

async def argument_units2rebuttals_repeated_combined(src_speech: list[ArgumentUnit], tgt_speech: list[ArgumentUnit]) -> list[Rebuttal]:
    prompt_src = ""
    prompt_tgt = ""

    for argument_unit in src_speech.argument_units:
        prompt_src += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    for argument_unit in tgt_speech.argument_units:
        prompt_tgt += f"{argument_unit.sequence_id}:{argument_unit.text}\n"
    
    completions = await client.beta.chat.completions.parse(
        model="gpt-4o-2024-11-20",
        messages=[
            {"role": "user", "content": "Identify all rebuttals present from the following speech, and return them as a list of tuples in the form of [source_id, target_id]."},
            {"role": "user", "content": "Each argument unit can rebut to at most one opponent's argument unit."},
            {"role": "user", "content": "Note that rebuttals are direct response to the opponents, typically starting with rephrasing the opponents' arguments they are focusing on."},
            {"role": "user", "content": f"Source speech: {prompt_src}"},
            {"role": "user", "content": f"Target speech: {prompt_tgt}"},
        ],
        n=try_num,
        response_format=Rebuttals,
    )

    rebuttals = []
    for choice in completions.choices:
        logger.info(choice.message.parsed.rebuttals)
        for rebuttal in choice.message.parsed.rebuttals:
            rebuttals.append(rebuttal)

    return rebuttals

async def digest2motion(digest: str) -> str:
    response = await client.chat.completions.create(
        model="gpt-4o-2024-11-20",
        messages=[
            {"role": "user", "content": "Given a transcript of a competitive debate round, tell me the motion of this round in the form of This house ..."},
            {"role": "user", "content": "DO NOT RETURN ANYTHING OTHER THAN THE MOTION."},
            {"role": "user", "content": "Transcript: "+str(digest)},
        ],
    )

    motion_predicted = response.choices[0].message.content

    # result = "<GPT prop> " + motion

    return motion_predicted

def ratio():
    return f"{repeated_num}/{try_num}"

#正直GPT関係ない
def group_consecutive(numbers):
    if not numbers:
        return []
    
    groups = [[numbers[0]]]

    for i in range(1, len(numbers)):
        if numbers[i] == numbers[i - 1] + 1:  # 前の数値と連続しているか確認
            groups[-1].append(numbers[i])
        else:
            groups.append([numbers[i]])
    
    return groups