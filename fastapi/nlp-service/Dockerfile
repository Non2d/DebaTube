FROM nvidia/cuda:12.1-runtime-ubuntu22.04
WORKDIR /app
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip3 install -r requirements.txt
COPY app/ .
CMD ["sh", "-c", "python3 migrate.py && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8080"]