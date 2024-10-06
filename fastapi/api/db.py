from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

ASYNC_DB_URL = "mysql+aiomysql://root@db:3306/debate?charset=utf8"
DB_URL = "mysql+pymysql://root@db:3306/debate?charset=utf8"

engine=create_engine(DB_URL, echo=True)

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

#同期的にデータベースを取得する関数。初期化のマイグレーションで使う
def get_db_sync():
    Session = sessionmaker(bind=engine)
    return Session()