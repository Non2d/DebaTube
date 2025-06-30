from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from routers import round

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()


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

app.include_router(round.router)