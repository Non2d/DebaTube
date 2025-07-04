import time
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from models.nlp import Base  # NLP用のモデルをインポート
import os
from dotenv import load_dotenv

load_dotenv()

MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_ROOT_PASSWORD = os.getenv("MYSQL_ROOT_PASSWORD")
MYSQL_HOST = "nlp_db"  # docker-compose内のDBサービス名
MYSQL_DATABASE = "nlp"

PROD_DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DATABASE}?charset=utf8"
DEV_DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DATABASE}?charset=utf8"

DB_URL = PROD_DB_URL if os.getenv("ENV") == "production" else DEV_DB_URL

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
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    if wait_for_db_connection():
        restart_database()
        pass
    else:
        print("Exiting due to NLP database connection failure.")