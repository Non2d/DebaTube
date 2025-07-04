FROM python:3.12-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ .

CMD ["sh", "-c", "python migrate.py && uvicorn main:app --reload --host 0.0.0.0 --port 8080"]