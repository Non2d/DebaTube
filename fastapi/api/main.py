from fastapi import FastAPI

from routers import round#, done#, debate

app = FastAPI()
app.include_router(round.router)
# app.include_router(done.router)
# app.include_router(debate.router)