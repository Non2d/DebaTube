import time
from sqlalchemy import create_engine
from models.task import Base

DB_URL = "mysql+pymysql://root@db:3306/demo?charset=utf8" #demoデータベース
engine = create_engine(DB_URL, echo=True)


def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    time.sleep(5)  # Wait for 5 seconds before trying to connect to the database
    reset_database()