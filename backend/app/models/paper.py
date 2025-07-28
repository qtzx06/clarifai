"""
Data models for research papers and analysis
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class AnalysisStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class VideoStatus(str, Enum):
    NOT_GENERATED = "not_generated"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"

class Concept(BaseModel):
    id: str
    name: str
    description: str
    importance_score: float
    page_numbers: List[int]
    text_snippets: List[str]
    related_concepts: List[str] = []

class VideoClip(BaseModel):
    type: str = "manim"  # Only manim for now
    code: str
    voice_over: str
    duration: Optional[float] = None

class VideoConfig(BaseModel):
    paper_id: str
    clips: List[VideoClip]
    quality: str = "medium_quality"
    total_duration: Optional[float] = None

class Paper(BaseModel):
    id: str
    title: str
    authors: List[str] = []
    abstract: str = ""
    content: str
    uploaded_at: datetime
    file_path: str
    analysis_status: AnalysisStatus = AnalysisStatus.PENDING
    video_status: VideoStatus = VideoStatus.NOT_GENERATED
    
    # Analysis results
    concepts: List[Concept] = []
    key_insights: List[str] = []
    
    # Video generation
    video_config: Optional[VideoConfig] = None
    video_path: Optional[str] = None
    clips_paths: List[str] = []

class PaperUpload(BaseModel):
    filename: str
    file_size: int
    content_type: str

class AnalysisRequest(BaseModel):
    paper_id: str
    include_video_generation: bool = False

class ClarificationRequest(BaseModel):
    paper_id: str
    text_snippet: str
    context: Optional[str] = None

class VideoGenerationRequest(BaseModel):
    paper_id: str
    quality: str = "medium_quality"
    regenerate: bool = False

class ChatMessage(BaseModel):
    id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime
    paper_id: str

class ChatRequest(BaseModel):
    paper_id: str
    message: str
    context: Optional[str] = None

class ChatResponse(BaseModel):
    message: ChatMessage
    paper_id: str
    context_used: bool = False