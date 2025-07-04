import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from models.sentence import SpeechRecognition, SpeakerDiarization, create_sentences_from_words_and_speakers
from database import get_db

router = APIRouter()

@router.get("/sentences/{round_id}", response_model=List[Dict[str, Any]])
async def get_sentences_by_round_id(round_id: int, db: Session = Depends(get_db)):
    """
    指定されたround_idの文を取得する
    """
    try:
        # speech_recognitionデータを取得
        words_data = db.query(SpeechRecognition).filter(
            SpeechRecognition.round_id == round_id
        ).order_by(SpeechRecognition.start).all()
        
        # speaker_diarizationデータを取得
        speaker_data = db.query(SpeakerDiarization).filter(
            SpeakerDiarization.round_id == round_id
        ).order_by(SpeakerDiarization.start).all()
        
        if not words_data:
            raise HTTPException(status_code=404, detail="Speech recognition data not found for this round_id")
        
        if not speaker_data:
            raise HTTPException(status_code=404, detail="Speaker diarization data not found for this round_id")
        
        # 文を作成
        sentences = create_sentences_from_words_and_speakers(words_data, speaker_data)
        
        return sentences
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing sentences: {str(e)}")