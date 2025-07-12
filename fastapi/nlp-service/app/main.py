from fastapi import FastAPI
from contextlib import asynccontextmanager
from routers import audio, nlp
import uvicorn
from migrate import restart_database, wait_for_db_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    if wait_for_db_connection():
        restart_database()
    else:
        print("Database connection failed during startup")
    yield  # 終了時処理

app = FastAPI(title="NLP Service", version="1.0.0", lifespan=lifespan)

app.include_router(audio.router)
app.include_router(nlp.router)

@app.get("/", tags=["Other"])
def read_root():
    return {"message": "NLP Service is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=7791, reload=True)
