from typing import List
from fastapi import APIRouter
import schemas.debate as debate_schema

router = APIRouter()

@router.get("/rounds", response_model=List[debate_schema.Round])
async def list_rounds():
    return [debate_schema.Round(
        id=1,
        source={"title":"【スマホでpolice brutalityを潰そう】mixidea高校定期練習", "URL":"https://www.youtube.com/watch?v=p4tcFAPn2bo"},
        motion= {
            "original": "THW criminalize the payment of ransom to terrorist groups",
            "translated_JP": "本議会は、テロリスト集団に対する身代金の支払いを犯罪とする"
        },
        rebuttals=[{
                "src": 13,
                "dst": 1
            },
            {
                "src": 13,
                "dst": 6
            },
            {
                "src": 16,
                "dst": 1
            }],
        POIs= [11,30],
        speeches= [
            {
                "side": "Gov",
                "ADUs": [
                    {
                        "id": 0,
                        "transcript": "Thank you, Mr. Speaker and ladies and gentlemen in this house. Our side believes that we want to protect most moral people, every people, so every innocent people. And now another thing that's called the technology of hacking system or security camera is developing now and police can capture surprise information in the group of terrorists. So, thanks to those things, we can search those terrorists' move and act. ",
                        "translated_JP": "議長、そしてこの家の紳士淑女の皆様、ありがとうございました。私たちの側は、ほとんどの道徳的な人々、すべての人々、つまりすべての罪のない人々を守りたいと信じています。そして現在、ハッキングシステムや監視カメラと呼ばれる技術が発展しており、警察はテロリスト集団の意外な情報を捉えることができるようになりました。そういったもののおかげで、テロリストの動きや行動を探ることができるのです。"
                    },  {
                        "id": 1,
                        "transcript": "And the payment of ransom is money source of terrorist and criminal group. Huge rate of money source is ransom. Plus, criminal is very malicious. So, in many cases, even if victim's side pays huge money to the terrorist group and criminal groups, the victim will be killed by them. This is a very major case, but the family wants to protect their own family or own child, so they give money.",
                        "translated_JP": "そして身代金の支払いはテロリストや犯罪グループの資金源となっている。巨額の資金源は身代金です。しかも犯人は非常に悪質です。そのため、被害者側がテロ集団や犯罪集団に巨額のお金を支払ったとしても、被害者はテロ集団や犯罪集団によって殺されてしまう場合が多いのです。これは非常に大きな事件ですが、家族は自分の家族、自分の子供を守りたいからお金を出します。"
                    }
                ]
            },
            {
                "side": "Opp",
                "ADUs": [
                    {
                        "id": 2,
                        "transcript": "Thank you, Mr. Speaker and ladies and gentlemen in this house. Our side believes that we want to protect most moral people, every people, so every innocent people. And now another thing that's called the technology of hacking system or security camera is developing now and police can capture surprise information in the group of terrorists. So, thanks to those things, we can search those terrorists' move and act. ",
                        "translated_JP": "議長、そしてこの家の紳士淑女の皆様、ありがとうございました。私たちの側は、ほとんどの道徳的な人々、すべての人々、つまりすべての罪のない人々を守りたいと信じています。そして現在、ハッキングシステムや監視カメラと呼ばれる技術が発展しており、警察はテロリスト集団の意外な情報を捉えることができるようになりました。そういったもののおかげで、テロリストの動きや行動を探ることができるのです。"
                    },  {
                        "id": 3,
                        "transcript": "And the payment of ransom is money source of terrorist and criminal group. Huge rate of money source is ransom. Plus, criminal is very malicious. So, in many cases, even if victim's side pays huge money to the terrorist group and criminal groups, the victim will be killed by them. This is a very major case, but the family wants to protect their own family or own child, so they give money.",
                        "translated_JP": "そして身代金の支払いはテロリストや犯罪グループの資金源となっている。巨額の資金源は身代金です。しかも犯人は非常に悪質です。そのため、被害者側がテロ集団や犯罪集団に巨額のお金を支払ったとしても、被害者はテロ集団や犯罪集団によって殺されてしまう場合が多いのです。これは非常に大きな事件ですが、家族は自分の家族、自分の子供を守りたいからお金を出します。"
                    }
                ]
            }
        ]
    )]

@router.post("/rounds", response_model=debate_schema.RoundCreateResponse)
async def create_round(round_body:debate_schema.RoundCreate):
    return debate_schema.RoundCreateResponse(id=1, **round_body.model_dump())

@router.put("/rounds/{round_id}", response_model=debate_schema.RoundCreateResponse)
async def update_round(round_id:int, round_body:debate_schema.RoundCreate):
    return debate_schema.RoundCreateResponse(id=round_id, **round_body.model_dump())
#将来的にRebuttalだけ更新できるエンドポイントも作成したい!

@router.delete("/rounds/{round_id}", response_model=None)
async def delete_round(round_id:int):
    return