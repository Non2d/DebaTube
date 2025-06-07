import json
from typing import List
from datetime import datetime
from dataclasses import dataclass

# debate_scripts.jsonファイルを取得して読み込む
with open('debate_scripts.json', 'r', encoding='utf-8') as f:
    debate_scripts = json.load(f)

@dataclass
class Rebuttal:
    src: int
    tgt: int

@dataclass
class ArgumentUnit:
    sequence_id: int
    start: float
    end: float
    text: str

@dataclass
class Speech:
    argument_units: List[ArgumentUnit]

@dataclass
class BatchRound:
    video_id: str
    title: str
    description: str
    motion: str
    date_uploaded: str
    channel_id: str
    tag: str
    speeches: List[Speech]
    pois: List[int]
    rebuttals: List[Rebuttal]

batch_rounds: List[BatchRound] = []

for debate_script in debate_scripts:
    batch_round = BatchRound(
        video_id=debate_script['source']['URL'].split('?v=')[-1],
        title=debate_script['source']['title'],
        description=debate_script['key'],
        motion=debate_script['motion']['original'],
        date_uploaded=datetime.now().isoformat(),
        channel_id="unknown",
        tag="soturon",
        speeches=[],
        pois=[],
        rebuttals=[]
    )
    
    au_index = 0
    for speech in debate_script['speeches']:
        argument_units = []
        for au in speech['ADUs']:
            argument_units.append(
                ArgumentUnit(
                    sequence_id=au['id'],
                    start=au_index,
                    end=au_index + 1,
                    text=au['transcript'],
                )
            )
            au_index += 1
        
        batch_round.speeches.append(Speech(argument_units=argument_units))

    for poi_id in debate_script['POIs']:
        batch_round.pois.append(poi_id)
    
    for rebuttal in debate_script['attacks']:
        batch_round.rebuttals.append(
            Rebuttal(
                src=rebuttal['from'],
                tgt=rebuttal['to']
            )
        )

    batch_rounds.append(batch_round)


# Convert batch_rounds to JSON format and save to file
with open('batch_rounds.json', 'w', encoding='utf-8') as f:
    json.dump([{
        'video_id': r.video_id,
        'title': r.title,
        'description': r.description,
        'motion': r.motion,
        'date_uploaded': r.date_uploaded,
        'channel_id': r.channel_id,
        'tag': r.tag,
        'speeches': [{
            'argument_units': [{
                'sequence_id': au.sequence_id,
                'start': au.start,
                'end': au.end,
                'text': au.text
            } for au in speech.argument_units]
        } for speech in r.speeches],
        'pois': r.pois,
        'rebuttals': [{
            'src': reb.src,
            'tgt': reb.tgt
        } for reb in r.rebuttals]
    } for r in batch_rounds], f, ensure_ascii=False, indent=2)

print(f"Exported {len(batch_rounds)} batch rounds to batch_rounds.json")
