"""
Paper model for Clarifai
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, field_serializer
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
    captions: List[Dict[str, Any]] = []


class Concept(BaseModel):
    id: str
    name: str
    description: str
    importance_score: float
    page_numbers: List[int] = []
    text_snippets: List[str] = []
    related_concepts: List[str] = []
    concept_type: str = "conceptual"
    code: Optional[str] = None  # Generated Python code implementation
    
    def model_dump(self, **kwargs):
        """Override model_dump to use 'type' instead of 'concept_type' for frontend compatibility"""
        data = super().model_dump(**kwargs)
        if 'concept_type' in data:
            data['type'] = data.pop('concept_type')
        return data
    
    def model_dump_json(self, **kwargs):
        """Override model_dump_json to use 'type' instead of 'concept_type'"""
        import json
        data = self.model_dump(**kwargs)
        return json.dumps(data, default=str)


class Paper(BaseModel):
    id: str
    user_id: Optional[str] = None  # User who uploaded the paper
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
    def create_new(cls, filename: str, file_path: str, user_id: Optional[str] = None) -> "Paper":
        """Create a new paper instance with generated ID"""
        return cls(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title="",
            filename=filename,
            file_path=file_path,
            upload_time=datetime.now(),
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
