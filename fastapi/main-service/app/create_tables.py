
import asyncio
from app.db import async_engine, Base
from app.models.round import Round  # Import all models here to register them

async def create_tables():
    async with async_engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully.")

if __name__ == "__main__":
    asyncio.run(create_tables())
