"""
Clarifai - Configuration settings
Using Gemini 2.5 API for all AI functionality
"""

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
    ALLOWED_HOSTS: str = "http://localhost:3000,http://127.0.0.1:3000,https://localhost:3000"

    @property
    def allowed_origins(self) -> List[str]:
        """Parse ALLOWED_HOSTS string into list - handles both JSON arrays and comma-separated strings"""
        if not self.ALLOWED_HOSTS:
            return ["*"]  # Allow all in development if not set
        
        # Try to parse as JSON first (in case it's stored as JSON string)
        try:
            import json
            if self.ALLOWED_HOSTS.strip().startswith("["):
                origins = json.loads(self.ALLOWED_HOSTS)
                return origins if isinstance(origins, list) else ["*"]
        except (json.JSONDecodeError, ValueError):
            pass
        
        # Otherwise, split by comma
        origins = [origin.strip().strip('"').strip("'") for origin in self.ALLOWED_HOSTS.split(",") if origin.strip()]
        return origins if origins else ["*"]

    # File Storage
    MAX_FILE_SIZE: int = 52428800  # 50MB
    UPLOAD_DIR: str = "storage"
    VIDEO_DIR: str = "videos"
    CLIPS_DIR: str = "clips"

    # Manim Settings
    MANIM_QUALITY: str = "medium_quality"

    # Create directories
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create directories relative to backend folder
        backend_dir = Path(__file__).parent.parent.parent
        for directory in [self.UPLOAD_DIR, self.VIDEO_DIR, self.CLIPS_DIR]:
            (backend_dir / directory).mkdir(parents=True, exist_ok=True)

    class Config:
        # Look for .env in project root (3 levels up from backend/app/core/config.py)
        env_file = str(Path(__file__).parent.parent.parent.parent / ".env")
        case_sensitive = True


# Global settings instance
settings = Settings()

# Validate Gemini API key
if not settings.GEMINI_API_KEY and not settings.DEBUG:
    raise ValueError("GEMINI_API_KEY is required for production")
