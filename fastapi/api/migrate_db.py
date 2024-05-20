import time
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from models.round import Base

DB_URL = "mysql+pymysql://root@db:3306/debate_manager?charset=utf8"
engine = create_engine(DB_URL, echo=True)

# リトライロジックを追加
def wait_for_db_connection(max_retries=15, wait_interval=5):
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

if __name__ == "__main__":
    if wait_for_db_connection():
        reset_database()
    else:
        print("Exiting due to database connection failure.")
