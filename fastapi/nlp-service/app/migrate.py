import time
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from database import Base
import os
from dotenv import load_dotenv
# モデルをインポートしてテーブルを作成
from models.whisper import SpeechRecognition
from models.pyannote import SpeakerDiarization
from models.sentence import Sentence
from models.job_manager import Job

load_dotenv()

MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_HOST = "localhost:3307"
MYSQL_DATABASE = "nlp"

DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DATABASE}?charset=utf8"
engine = create_engine(DB_URL, echo=True)
Session = sessionmaker(bind=engine)

def wait_for_db_connection(max_retries=5, wait_interval=5):
    retries = 0
    while retries < max_retries:
        try:
            engine.connect()
            print("NLP Database connection successful")
            return True
        except OperationalError:
            retries += 1
            print(f"NLP Database connection failed. Retrying in {wait_interval} seconds...")
            time.sleep(wait_interval)
    print("Could not connect to the NLP database. Exiting.")
    return False

def restart_database():
    models = [SpeechRecognition, SpeakerDiarization, Sentence, Job]
    print(f"Models loaded: {[model.__tablename__ for model in models]}")
    print(f"Registered tables: {list(Base.metadata.tables.keys())}")
    
    # Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    print("Database tables created successfully")
    
if __name__ == "__main__":
    if wait_for_db_connection():
        restart_database()
    else:
        print("Exiting due to database connection failure.")