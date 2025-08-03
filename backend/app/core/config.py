"""
Clarifai - Configuration settings
Using Gemini 2.5 API for all AI functionality
"""
import os
from typing import List
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # App Info
    APP_NAME: str = "Clarifai API"
    VERSION: str = "2.0.0"
    DEBUG: bool = True
    
    # Gemini API Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # CORS Settings
    ALLOWED_HOSTS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000"
    ]
    
    # File Storage
    MAX_FILE_SIZE: int = 52428800  # 50MB
    UPLOAD_DIR: str = "storage"
    VIDEO_DIR: str = "backend/videos"
    CLIPS_DIR: str = "backend/clips"
    
    # Manim Settings
    MANIM_QUALITY: str = "medium_quality"
    
    # Create directories
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        for directory in [self.UPLOAD_DIR, self.VIDEO_DIR, self.CLIPS_DIR]:
            Path(directory).mkdir(exist_ok=True)
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings()

# Validate Gemini API key
if not settings.GEMINI_API_KEY and not settings.DEBUG:
    raise ValueError("GEMINI_API_KEY is required for production")