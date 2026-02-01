"""
API clients initialization
All external API clients are initialized here and imported by routers
"""
import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai.types import HttpOptions
from groq import Groq, AsyncGroq
from openai import OpenAI, AsyncOpenAI

# Load environment variables
load_dotenv()

# OpenAI clients
client = OpenAI()
async_client = AsyncOpenAI()

# Groq clients
groq_client = Groq()
async_groq_client = AsyncGroq()

# Google AI Studio Gemini client (uses API key)
client_studio_gemini = genai.Client(vertexai=False)

# Vertex AI Gemini client (uses service account)
vertex_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
with open(vertex_credentials_path, 'r') as f:
    credentials_data = json.load(f)
    vertex_project_id = credentials_data.get("project_id")

client_vertex_gemini = genai.Client(
    vertexai=True,
    project=vertex_project_id,
    location="global",
    http_options=HttpOptions(api_version="v1")
)
