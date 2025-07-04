from fastapi import FastAPI
from routers import sentences, audio, nlp
import uvicorn

app = FastAPI(title="NLP Service", version="1.0.0")

app.include_router(sentences.router, prefix="/api/v1")
app.include_router(audio.router, prefix="/api/v1")
app.include_router(nlp.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "NLP Service is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8090)