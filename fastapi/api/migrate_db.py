import time
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from models.round import Base
import models.round as round_db_model
import json

DB_URL = "mysql+pymysql://root@db:3306/debate?charset=utf8"
engine = create_engine(DB_URL, echo=True)
Session = sessionmaker(bind=engine)

def wait_for_db_connection(max_retries=5, wait_interval=5):
    retries = 0
    while retries < max_retries:
        try:
            # Try to connect to the database
            engine.connect()
            print("Database connection successful")
            return True
        except OperationalError:
            retries += 1
            print(f"Database connection failed. Retrying in {wait_interval} seconds...")
            time.sleep(wait_interval)
    print("Could not connect to the database. Exiting.")
    return False

def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

# def is_db_empty(session):
#     return session.query(round_db_model.Round).count() == 0

# def batch_create_round(db):
#     with open('batch_round.json', 'r', encoding='utf-8') as f:
#         round_json = json.load(f)
    
#     print(round_json["speeches"])

#     speeches = [round_db_model.Speech(**speech) for speech in round_json["speeches"]]
#     rebuttals = [round_db_model.Rebuttal(**rebuttal) for rebuttal in round_json["rebuttals"]]

#     round = round_db_model.Round(
#         title=round_json["title"],
#         motion=round_json["motion"],
#         rebuttals=rebuttals,
#         pois=[],
#         speeches=speeches
#     )
#     db.add(round)
#     db.commit()

if __name__ == "__main__":
    if wait_for_db_connection():
        # session = Session()
        # try:
        #     if is_db_empty(session):
        #         batch_create_round(session)
        #     else:
        #         print("Database is not empty. Skipping batch creation.")
        # except Exception as e:
        #     print(f"An error occurred: {e}")
        #     session.rollback()
        # finally:
        #     session.close()
        # reset_database()
        pass
    else:
        print("Exiting due to database connection failure.")