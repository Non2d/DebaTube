FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ .
CMD ["sh", "-c", "python migrate.py && uvicorn main:app --reload --host 0.0.0.0 --port 8080"]