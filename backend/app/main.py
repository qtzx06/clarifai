"""
Clarifai - Research Paper Analysis Tool
Main FastAPI application entry point with Gemini 2.5 integration
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from .core.config import settings
from .api.endpoints import upload, analysis, video

# Create FastAPI app
app = FastAPI(
    title="Clarifai API",
    description="Research Paper Analysis Tool with Gemini 2.5 AI and Manim-Generated Educational Videos",
    version="2.0.0",
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

# Create directories
for directory in [settings.UPLOAD_DIR, settings.VIDEO_DIR, settings.CLIPS_DIR]:
    Path(directory).mkdir(exist_ok=True)

# Mount static files for videos and clips
if os.path.exists(settings.VIDEO_DIR):
    app.mount("/videos", StaticFiles(directory=settings.VIDEO_DIR), name="videos")
if os.path.exists(settings.CLIPS_DIR):
    app.mount("/clips", StaticFiles(directory=settings.CLIPS_DIR), name="clips")
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/storage", StaticFiles(directory=settings.UPLOAD_DIR), name="storage")

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
        "version": "2.0.0",
        "ai_service": "Google Gemini 2.5 Flash",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "features": {
            "pdf_parsing": "PyMuPDF",
            "video_generation": "Manim",
            "ai_service": "Google Gemini 2.5 Flash",
            "deployment_ready": "Google Cloud Run + Cloud Storage"
        },
        "gemini_configured": bool(settings.GEMINI_API_KEY)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )