"""
Paper model for Clarifai
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from enum import Enum
import uuid
from datetime import datetime

class AnalysisStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class VideoStatus(str, Enum):
    NOT_STARTED = "not_started"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"

class ConceptVideo(BaseModel):
    concept_id: str
    concept_name: str
    status: VideoStatus
    video_path: Optional[str] = None
    clips_paths: List[str] = []
    created_at: datetime
    logs: List[str] = []

class Concept(BaseModel):
    id: str
    name: str
    description: str
    importance_score: float
    page_numbers: List[int] = []
    text_snippets: List[str] = []
    related_concepts: List[str] = []
    concept_type: str = "conceptual"

class Paper(BaseModel):
    id: str
    title: str
    authors: List[str] = []
    abstract: str = ""
    content: str = ""
    filename: str
    file_path: str
    upload_time: datetime
    analysis_status: AnalysisStatus = AnalysisStatus.PENDING
    video_status: VideoStatus = VideoStatus.NOT_STARTED
    
    # Analysis results
    concepts: List[Concept] = []
    insights: List[str] = []
    methodology: str = ""
    full_analysis: str = ""
    
    # Video information (legacy - for backward compatibility)
    video_path: Optional[str] = None
    clips_paths: List[str] = []
    
    # NEW: Concept-specific video tracking
    concept_videos: Dict[str, ConceptVideo] = {}
    
    @classmethod
    def create_new(cls, filename: str, file_path: str) -> "Paper":
        """Create a new paper instance with generated ID"""
        return cls(
            id=str(uuid.uuid4()),
            title="",
            filename=filename,
            file_path=file_path,
            upload_time=datetime.now()
        )

class PaperResponse(BaseModel):
    """Response model for paper API endpoints"""
    id: str
    title: str
    authors: List[str]
    abstract: str
    analysis_status: str
    video_status: str
    upload_time: datetime
    concepts_count: int = 0
    has_video: bool = False

class ConceptResponse(BaseModel):
    """Response model for concepts API"""
    concepts: List[Concept]
    total_count: int

class VideoStatusResponse(BaseModel):
    """Response model for video status"""
    paper_id: str
    video_status: str
    video_path: Optional[str] = None
    clips_count: int = 0
    clips_paths: List[str] = []
    has_video_config: bool = False