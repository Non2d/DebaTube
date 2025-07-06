from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from database import Base
from datetime import datetime
import pandas as pd

class Sentence(Base):
    __tablename__ = 'sentences'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    round_id = Column(Integer, nullable=False)
    start = Column(Float)
    end = Column(Float)
    speaker = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime)

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
        while speaker_index < speaker_count and speaker.loc[speaker_index, 'end'] < word_row['start']:
            speaker_index += 1
        if speaker_index < speaker_count and speaker.loc[speaker_index, 'start'] <= word_row['end']:
            words.at[i, 'speaker'] = speaker.loc[speaker_index, 'speaker']

    speaker_column = words.pop('speaker')
    words.insert(0, 'speaker', speaker_column)

    return words

def find_sentence_tails(words):
    """
    単語データに対して文末を検出する関数（2単語以上の接続詞対応版）。
    """
    texts = words['text'].tolist()
    tails = []
   
    MIN_SEGMENT_WORDS = 5
    MIN_SENTENCE_WORDS = 20
   
    STRONG_CONNECTORS = {
        'however', 'therefore', 'moreover', 'furthermore', 'then',
        'firstly', 'secondly', 'thirdly', 'forthly', 'lastly', 'actually', 'likewise',
        'thus', 'hence', 'consequently', 'nevertheless', 'nonetheless',
        'meanwhile', 'additionally', 'finally', 'initially', 'subsequently',
        'in addition', 'for example', 'for instance', 'in conclusion',
        'in summary', 'on the other hand', 'in contrast', 'as a result',
        'in fact', 'after all', 'above all', 'in particular',
        'at first', 'at last', 'in short', 'to summarize',
        'on the contrary', 'as a consequence', 'in other words',
        'to put it simply', 'to be specific', 'first of all',
        'last but not least', 'more specifically'
    }
   
    WEAK_CONNECTORS = {
        'but', 'because', 'although', 'though', 'where', 'when',
        'while', 'if', 'unless', 'until', 'which', 'also', 'and', 'or',
        'so', 'yet', 'since', 'as', 'given', 'provided', 'assuming', 'meaning',
        'suppose', 'say', 'note', 'see', 'consider', 'remember',
        'actually', 'basically', 'essentially', 'importantly',
        'specifically', 'particularly', 'especially', 'notably',
        'okay', 'alright', 'well', 'now', 'look', 'yeah', 'um', 'right',
        'even though', 'as if', 'as though', 'so that', 'such that',
        'given that', 'provided that', 'assuming that', 'in case',
        'by the way', 'you know', 'i mean', 'that is',
        'let me', 'let us', 'let\'s say', 'you\'re'
    }
    
    strong_by_length = {}
    weak_by_length = {}
    
    for conn in STRONG_CONNECTORS:
        length = len(conn.split())
        if length not in strong_by_length:
            strong_by_length[length] = set()
        strong_by_length[length].add(conn)
    
    for conn in WEAK_CONNECTORS:
        length = len(conn.split())
        if length not in weak_by_length:
            weak_by_length[length] = set()
        weak_by_length[length].add(conn)
    
    max_connector_length = max(
        max(strong_by_length.keys()) if strong_by_length else 0,
        max(weak_by_length.keys()) if weak_by_length else 0
    )
   
    for i, word in enumerate(texts):
        if word.strip().endswith(('.', '!', '?')):
            tails.append(i)
            continue
           
        if i > 0:
            last_tail = tails[-1] if tails else -1
            current_segment_length = i - last_tail - 1
            
            found_connector = False
            connector_type = None
            
            for length in range(max_connector_length, 0, -1):
                if i + length - 1 < len(texts):
                    phrase = ' '.join(texts[j].lower().strip().rstrip(',') 
                                    for j in range(i, i + length))
                    
                    if length in strong_by_length and phrase in strong_by_length[length]:
                        found_connector = True
                        connector_type = 'strong'
                        break
                    
                    if length in weak_by_length and phrase in weak_by_length[length]:
                        found_connector = True
                        connector_type = 'weak'
                        break
            
            if found_connector:
                if connector_type == 'strong':
                    if current_segment_length >= MIN_SEGMENT_WORDS:
                        tails.append(i - 1)
                
                elif connector_type == 'weak':
                    if current_segment_length >= MIN_SEGMENT_WORDS:
                        next_end = next((j for j in range(i+1, len(texts))
                                       if texts[j].strip().endswith(('.', '!', '?'))),
                                      len(texts) - 1)
                        total_sentence_length = next_end - last_tail
                       
                        if total_sentence_length >= MIN_SENTENCE_WORDS:
                            tails.append(i - 1)
   
    tails.append(len(texts) - 1)
    return sorted(set(tails))

def create_sentences_from_words_and_speakers(words_data, speaker_data):
    """
    speech_recognitionとspeaker_diarizationのデータから文を作成する関数。
    
    Args:
        words_data: SpeechRecognitionのクエリ結果
        speaker_data: SpeakerDiarizationのクエリ結果
    
    Returns:
        list: 文のリスト [{"speaker": str, "start": float, "end": float, "text": str}]
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
    sentence_tails = find_sentence_tails(words_with_speakers)
    
    sentences = []
    start_idx = 0
    
    for end_idx in sentence_tails:
        if start_idx >= len(words_with_speakers) or end_idx >= len(words_with_speakers):
            continue
        
        sentence_words = words_with_speakers.iloc[start_idx:end_idx+1]
        
        if len(sentence_words) == 0:
            start_idx = end_idx + 1
            continue
        
        sentence_text = "".join(sentence_words['text'])
        sentence_start_time = sentence_words['start'].iloc[0]
        sentence_end_time = sentence_words['end'].iloc[-1]
        sentence_speaker = sentence_words['speaker'].iloc[0]
        
        sentences.append({
            'speaker': sentence_speaker,
            'start': sentence_start_time,
            'end': sentence_end_time,
            'text': sentence_text
        })
        
        start_idx = end_idx + 1
    
    return sentences