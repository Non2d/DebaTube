from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from database import Base
from datetime import datetime
import pandas as pd

# class Speech(Base):
#     __tablename__ = 'speeches'
    
#     id = Column(Integer, primary_key=True, autoincrement=True)
#     round_id = Column(Integer, nullable=False)
#     audio_filename = Column(String(255), nullable=False)
#     start = Column(Float)
#     end = Column(Float)
#     speaker = Column(String(50), nullable=False)
#     created_at = Column(DateTime)

def assign_speakers_to_words(words, speaker):
    """
    話者分離データを単語データに紐づける関数。
    """
    words['speaker'] = None
    words = words.sort_values(by='start').reset_index(drop=True)
    speaker = speaker.sort_values(by='start').reset_index(drop=True)
    speaker_index = 0
    speaker_count = len(speaker)

    for i, word_row in words.iterrows():
        # None値チェックを追加
        if word_row['start'] is None or word_row['end'] is None:
            continue
            
        while (speaker_index < speaker_count and 
               speaker.loc[speaker_index, 'end'] is not None and
               speaker.loc[speaker_index, 'end'] < word_row['start']):
            speaker_index += 1
            
        if (speaker_index < speaker_count and 
            speaker.loc[speaker_index, 'start'] is not None and
            speaker.loc[speaker_index, 'start'] <= word_row['end']):
            words.at[i, 'speaker'] = speaker.loc[speaker_index, 'speaker']

    speaker_column = words.pop('speaker')
    words.insert(0, 'speaker', speaker_column)

    return words

def group_speeches_from_words_and_speakers(words_data, speaker_data):
    """
    speaker_diarizationのタイムスタンプに基づいてspeech_recognitionを分ける関数。
    
    Args:
        words_data: SpeechRecognitionのクエリ結果
        speaker_data: SpeakerDiarizationのクエリ結果
    
    Returns:
        list: 話者別に分けられた音声セグメントのリスト [{"speaker": str, "start": float, "end": float, "text": str}]
    """
    words_df = pd.DataFrame([{
        'start': word.start,
        'end': word.end,
        'text': word.text
    } for word in words_data])
    
    speaker_df = pd.DataFrame([{
        'start': speaker.start,
        'end': speaker.end,
        'speaker': speaker.speaker
    } for speaker in speaker_data])
    
    if words_df.empty or speaker_df.empty:
        return []
    
    words_with_speakers = assign_speakers_to_words(words_df, speaker_df)
    
    speeches = []
    current_speaker = None
    current_start = None
    current_words = []
    
    for _, word_row in words_with_speakers.iterrows():
        # None値チェックを追加
        if word_row['start'] is None or word_row['end'] is None:
            continue
            
        word_speaker = word_row['speaker'] if word_row['speaker'] is not None else "UNKNOWN"
        
        if current_speaker != word_speaker:
            # 前の話者のセグメントを保存
            if current_words:
                speeches.append({
                    'speaker': current_speaker,
                    'start': current_start,
                    'end': current_words[-1]['end'],
                    'text': "".join([w['text'] for w in current_words])
                })
            
            # 新しい話者のセグメントを開始
            current_speaker = word_speaker
            current_start = word_row['start']
            current_words = [{
                'text': word_row['text'],
                'start': word_row['start'],
                'end': word_row['end']
            }]
        else:
            # 同じ話者の単語を追加
            current_words.append({
                'text': word_row['text'],
                'start': word_row['start'],
                'end': word_row['end']
            })
    
    # 最後のセグメントを保存
    if current_words:
        speeches.append({
            'speaker': current_speaker,
            'start': current_start,
            'end': current_words[-1]['end'],
            'text': "".join([w['text'] for w in current_words])
        })
    
    return speeches