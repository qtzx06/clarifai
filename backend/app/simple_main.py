"""
Simple test FastAPI app without pydantic-settings
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Create minimal FastAPI app
app = FastAPI(title="Clarifai Test", version="2.0.0")

# Basic CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Clarifai Test - Backend Running", "status": "ok"}

@app.get("/health")
async def health():
    return {"status": "healthy", "gemini_key": bool(os.getenv("GEMINI_API_KEY"))}