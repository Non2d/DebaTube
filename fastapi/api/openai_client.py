from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from logging_config import logger
from dotenv import load_dotenv

import json
import models.round as round_model

from openai import AsyncOpenAI

load_dotenv()
client = AsyncOpenAI()

async def argumentMiningByLLM(db: AsyncSession, db_segments: List[round_model.Segment], speech_id: int):
    try:
        logger.info("Starting grouping segments to ADUs.")
        #ここでOpenAI APIを呼び出す
        # logger.info("APIKEY: %s", os.getenv("OPENAI_API_KEY"))

        # await asyncio.sleep(5)  # 非同期スリープを使用
        # time.sleep(5) # 同期スリープを使用

        # logger.info("segments: %s", [str({c.key: getattr(segment, c.key) for c in sqlalchemy.inspect(segment).mapper.column_attrs}) for segment in db_segments])

        # segments_list = ast.literal_eval(db_segments.model_dump())
        # formatted_segments_id = ", ".join([f'{segment.id}:"{segment.text}"' for segment in db_segments])
        formatted_segments = ", ".join([f'"{segment.text}"' for segment in db_segments])

        #db_segmentsをひとつのテキストにまとめる
        # unified_segments = " ".join([segment.text for segment in db_segments])
        logger.info("segments: %s", formatted_segments)

        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            response_format={"type":"json_object"},
            messages=[
                {"role": "system", "content": "You are a helpful debater designed to output JSON. You know a lot about competitive debates and deeply analyze the argument structures. The scheme is just a list of segments: [{'last_segment':str}]"},
                {"role": "user", "content": "Please regroup the following segments to argumentative discourse units, and return the first segment's text data in each argumentative discourse unit:"+formatted_segments+". Argumentative discourse unit is a minimal unit of argumentative analysis. It is either a claim or a reasoning of argumentation."}
            ]
        )

        answers = json.loads(response.choices[0].message.content) # ->[{"segment":"A"},{"segment":"B"},{"segment":"C"}]
        # logger.info("Inputs: %s", "Please regroup the following segments to argumentative discourse units: " + formatted_segments)
        logger.info("OpenAI API response: %s", answers)

        # answers = {'paragraphs': [{'segment': '632: So, good afternoon, ladies and gentlemen.'}, {'segment': "633: Today's topic is this house would legalize child labor."}, {'segment': '634: Under the status quo, especially in developing countries, the children are actually exploited by illegal higher people like gangs.'}, {'segment': '635: They are thought as a very cheap force for the coral miner or marifana farmer or something like that.'}, {'segment': '636: And obviously, it is very dangerous.'}, {'segment': '637: This is the result from the very bad situation that actually government make for pursuing ideal.'}, {'segment': '638: Actually, ideal does not help anyone.'}, {'segment': '639: So we stand against that.'}, {'segment': '640: Today, our model is that the government will test the companies to check if they are safe enough, and then the government will allow them to hire children.'}, {'segment': '641: This can be done thanks to the legalization of child labor.'}, {'segment': '642: Moving on to our points, we have two points.'}, {'segment': '643: The first is a very harsh environment about the children or child labor.'}, {'segment': "644: The second is about the parents' right."}, {'segment': '645: So for the first, the life of the children.'}, {'segment': '646: Under the status quo, there are a lot of people who are very poor, living under $5 or some very cheap dollars a day or under such kind of very harsh environment.'}, {'segment': '647: Under those circumstances, especially in developing countries, many children are forced to work for helping their little brother or sister or because no parent to help them because the mother or father or someone is very sick hardly, or such kind of very harsh environment actually exists.'}, {'segment': '648: And their circumstances is very urgent because they are lacking water or they do not have any food to eat.'}, {'segment': '649: And under such kind of situation, if the child go to school because the child labor is illegal, then the time to go to school may kill the family or little brother or such kind of very precious life.'}, {'segment': '650: So we think this is very urgent and we should admit it.'}, {'segment': '651: And under the status quo, in order to get out of such kind of situation, actually illegal groups hire those kind of children, even under the legalization of child labor.'}, {'segment': '652: For example, as my introduction, the gangs can hire those kind of children and they do not care whether the children is happy or fine enough or that, such kind of things.'}, {'segment': '653: Rather, they consider how to exploit those kind of children.'}, {'segment': '654: And furthermore, even if there might be some good people who hire the children, then they will be arrested by police and the children will lose their way to live.'}, {'segment': '655: This is very terrible.'}, {'segment': '656: But after this motion, the legal companies can be allowed to provide many jobs for those kind of children.'}, {'segment': '657: Obviously, it is helpful.'}, {'segment': "658: Moving on to our second point, the parents' right."}, {'segment': '659: In the first place, what is the best for each family can be considered or decided by the parents because the parents know deeply about the situations and which are very different from among some different families.'}, {'segment': '660: And even if the jobs or child labor we suggest is some dangerous or the children may get tired, it is okay because parents, as I told you, parents know better than the government about the circumstances, each circumstance of each family.'}, {'segment': '661: And so, government should not intervene each situation.'}, {'segment': "662: We should, the government's role is to admit the situation, each different situation."}, {'segment': '663: I think the parent is the most responsible and rational actor to decide whether to send them to school or to make them work as a child laborer.'}, {'segment': '664: And we think this is the right to self-defense from poverty.'}, {'segment': '665: And the government should not deprive that fundamental right.'}, {'segment': '666: And they may say that the bad spiral of poverty because the parent is poor and children and grandchildren will be poor or such kind of situation can happen.'}, {'segment': '667: But we think that rejecting the child labor is not a solution to protect them because, as I told you, even if the child labor is legal, there is no chance that the education immediately make them rich or such kind of situation.'}, {'segment': '668: While the older brother or such kind of people who can, such kind of children who can work go to school, then your little brother can be dead because there were no water or such kind of things.'}, {'segment': "669: So, as I told you, the most important thing for this kind of children is that today's money, today's food, and today's water."}, {'segment': '670: And furthermore, we think that, yes, today the government is legalizing the fundamental and exclusive way of protecting their life.'}, {'segment': '671: Thank you for listening.'}]}
        answers = list(answers.values())[0]

        answers_text_list = [list(answer.values())[0] for answer in answers]

        logger.info("ADUs: %s", answers_text_list)

        ADUs = []

        for ADU_text in answers_text_list:
            ADUs.append(round_model.ADU(transcript=ADU_text, speech_id=speech_id))

        db.add_all(ADUs)
        await db.commit() # 普通にdbを扱える

        logger.info("Background tasks completed successfully")
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in background task: {e}")
        raise e
    finally:
        await db.close()  # セッションを明示的に閉じる
        logger.info("Database session closed")