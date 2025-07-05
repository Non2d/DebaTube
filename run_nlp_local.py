#!/usr/bin/env python3
import os
import sys
import subprocess

# FastAPI NLP サービスをローカルで実行
def run_nlp_service():
    nlp_service_path = "./fastapi/nlp-service"
    
    if not os.path.exists(nlp_service_path):
        print(f"Error: {nlp_service_path} not found")
        sys.exit(1)
    
    # Change to nlp-service directory
    os.chdir(nlp_service_path)
    
    # Install requirements if needed
    print("Installing requirements...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], check=True)
    
    # Change to app directory
    os.chdir("app")
    
    # Run migration
    print("Running database migration...")
    subprocess.run([sys.executable, "migrate.py"], check=True)
    
    # Start FastAPI server
    print("Starting NLP service on localhost:7791...")
    subprocess.run([
        sys.executable, "-m", "uvicorn", 
        "main:app", 
        "--reload", 
        "--host", "0.0.0.0", 
        "--port", "7791"
    ], check=True)

if __name__ == "__main__":
    run_nlp_service()