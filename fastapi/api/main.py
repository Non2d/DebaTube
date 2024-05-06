from fastapi import FastAPI, Request, status

from routers import round

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(RequestValidationError)
async def handler(request:Request, exc:RequestValidationError):
    print(exc)
    return JSONResponse(content={}, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)

app.include_router(round.router)
# app.include_router(done.router)
# app.include_router(debate.router)