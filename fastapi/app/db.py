from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

import os
from dotenv import load_dotenv
load_dotenv()

MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
MYSQL_HOST = "db" #yamlで設定したDBサービス名
MYSQL_DATABASE = "debate"

PROD_DB_URL = f"mysql+aiomysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DATABASE}?charset=utf8"
DEV_DB_URL = "mysql+aiomysql://root@db:3306/debate?charset=utf8"

ASYNC_DB_URL = PROD_DB_URL if os.getenv("ENV") == "production" else DEV_DB_URL

async_engine = create_async_engine(ASYNC_DB_URL, echo=True)
async_session = sessionmaker(
    autocommit=False, autoflush=False, bind=async_engine, class_=AsyncSession
)

Base = declarative_base()

async def get_db():
    session = async_session()
    try:
        yield session
    finally:
        await session.close()