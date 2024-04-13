from fastapi import FastAPI

from routers import task, done, debate

app = FastAPI()
app.include_router(task.router)
app.include_router(done.router)
app.include_router(debate.router)