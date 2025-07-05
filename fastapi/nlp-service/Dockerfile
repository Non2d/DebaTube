FROM python:3.11-slim
WORKDIR /app

# Install system dependencies including CUDA toolkit (if available)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch with CUDA support
RUN pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

COPY requirements.txt .
RUN pip3 install -r requirements.txt
COPY app/ .
CMD ["sh", "-c", "python3 migrate.py && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8080"]