"""
Configuration settings for Clarifai backend
"""
import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "Clarifai"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # API settings
    ALLOWED_HOSTS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # File storage
    UPLOAD_DIR: str = "storage"
    VIDEO_DIR: str = "videos"
    CLIPS_DIR: str = "clips"
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # AI Model APIs
    BREV_NVIDIA_API_KEY: str = ""
    BREV_NVIDIA_BASE_URL: str = "https://brev.nvidia.com/api"
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # Voice synthesis
    MAGPIE_TTS_API_KEY: str = ""
    LMNT_API_KEY: str = ""
    DEFAULT_VOICE_ID: str = "morgan"
    
    # Manim settings
    MANIM_QUALITY: str = "medium_quality"  # low_quality, medium_quality, high_quality
    MANIM_OUTPUT_DIR: str = "clips"
    
    # Database (for future use)
    DATABASE_URL: str = "sqlite:///./clarifai.db"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()

# Ensure directories exist
for directory in [settings.UPLOAD_DIR, settings.VIDEO_DIR, settings.CLIPS_DIR]:
    os.makedirs(directory, exist_ok=True)