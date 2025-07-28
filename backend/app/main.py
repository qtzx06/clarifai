"""
Clarifai - Research Paper Analysis Tool
Main FastAPI application entry point
Uses Manim for video generation and brev.nvidia.com models
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from .core.config import settings
from .api.endpoints import upload, analysis, video

# Create FastAPI app
app = FastAPI(
    title="Clarifai API",
    description="Research Paper Analysis Tool with Manim-Generated Educational Videos",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for videos and clips
app.mount("/videos", StaticFiles(directory="videos"), name="videos")
app.mount("/clips", StaticFiles(directory="clips"), name="clips")
app.mount("/storage", StaticFiles(directory="storage"), name="storage")

# Include API routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(video.router, prefix="/api", tags=["video"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to Clarifai - Research Paper Analysis Tool",
        "description": "Upload papers, extract key concepts, generate educational videos with Manim",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "features": {
            "pdf_parsing": "PyMuPDF",
            "video_generation": "Manim",
            "ai_models": "brev.nvidia.com",
            "voice_synthesis": "Magpie TTS Flow"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )