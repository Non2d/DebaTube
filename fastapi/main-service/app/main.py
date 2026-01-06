from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from routers import round, audio2adu, sub_apis, audio_save, external_video

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from contextlib import asynccontextmanager
import asyncio
from sqlalchemy import text
from db import async_engine
from log_config import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Wait for DB connection
    retries = 30
    wait_seconds = 2
    logger.info(f"Waiting for database connection... (max retries: {retries})")
    
    for i in range(retries):
        try:
            async with async_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info("Database connection established!")
            break
        except Exception as e:
            if i < retries - 1:
                logger.info(f"Database not ready yet, retrying in {wait_seconds}s... ({i+1}/{retries})")
                await asyncio.sleep(wait_seconds)
            else:
                logger.error("Could not connect to database after maximum retries.")
                raise e
    
    yield
    
    # Shutdown (if needed)
    pass

app = FastAPI(lifespan=lifespan)


origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://vps4.nkmr.io",
    "https://vps4.nkmr.io",
    "http://localhost:7000",
    "http://localhost:8000",
    "http://localhost:9000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def handler(request:Request, exc:RequestValidationError):
    print(exc)
    return JSONResponse(content={}, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)

app.include_router(round.router, tags=["round"])
app.include_router(external_video.router, tags=["external-video"])
app.include_router(audio2adu.router, tags=["audio2adu"])
app.include_router(sub_apis.router, tags=["sub-api"])
app.include_router(audio_save.router, tags=["audio-save"])


# Import logs router inside function or at top, here we do at top but for replace convenience:
from routers import logs
app.include_router(logs.router, prefix="/logs", tags=["logs"])
