import time
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from models.round import Base
import models.round as round_db_model
import json

import os
from dotenv import load_dotenv
load_dotenv()

MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_HOST = "db" #yamlで設定したDBサービス名
MYSQL_DATABASE = "debate"

PROD_DB_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DATABASE}?charset=utf8"

DEV_DB_URL = "mysql+pymysql://root@db:3306/debate?charset=utf8"

DB_URL = PROD_DB_URL if os.getenv("ENV") == "production" else DEV_DB_URL

engine = create_engine(DB_URL, echo=True)
Session = sessionmaker(bind=engine)

def wait_for_db_connection(max_retries=5, wait_interval=5):
    retries = 0
    while retries < max_retries:
        try:
            engine.connect()
            print("Database connection successful")
            return True
        except OperationalError:
            retries += 1
            print(f"Database connection failed. Retrying in {wait_interval} seconds...")
            time.sleep(wait_interval)
    print("Could not connect to the database. Exiting.")
    return False

def restart_database():
    # Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    if wait_for_db_connection():
        restart_database()
        pass
    else:
        print("Exiting due to database connection failure.")