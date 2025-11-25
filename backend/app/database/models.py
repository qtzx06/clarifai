"""
SQLAlchemy models for Supabase PostgreSQL database
"""

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from datetime import datetime
import enum

Base = declarative_base()


class AnalysisStatusEnum(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoStatusEnum(str, enum.Enum):
    NOT_STARTED = "not_started"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    """User model - syncs with Supabase Auth"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    google_id = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    papers = relationship("Paper", back_populates="user", cascade="all, delete-orphan")
    video_generations = relationship("VideoGeneration", back_populates="user", cascade="all, delete-orphan")


class Paper(Base):
    """Paper model - research papers uploaded by users"""
    __tablename__ = "papers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Metadata
    title = Column(String(500), nullable=False, default="")
    authors = Column(ARRAY(String), default=list)
    abstract = Column(Text, default="")
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    upload_time = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Analysis status
    analysis_status = Column(SQLEnum(AnalysisStatusEnum), default=AnalysisStatusEnum.PENDING, nullable=False)
    video_status = Column(SQLEnum(VideoStatusEnum), default=VideoStatusEnum.NOT_STARTED, nullable=False)

    # Content
    content = Column(Text, default="")
    full_analysis = Column(Text, default="")
    methodology = Column(Text, default="")
    insights = Column(ARRAY(String), default=list)

    # Legacy video fields (for backward compatibility)
    video_path = Column(String(500), nullable=True)
    clips_paths = Column(ARRAY(String), default=list)

    # Relationships
    user = relationship("User", back_populates="papers")
    concepts = relationship("Concept", back_populates="paper", cascade="all, delete-orphan")
    video_generations = relationship("VideoGeneration", back_populates="paper", cascade="all, delete-orphan")


class Concept(Base):
    """Concept model - key concepts extracted from papers"""
    __tablename__ = "concepts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)

    # Concept data
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    importance_score = Column(Float, default=0.0)
    concept_type = Column(String(100), default="conceptual")

    # Optional metadata
    page_numbers = Column(ARRAY(Integer), default=list)
    text_snippets = Column(ARRAY(Text), default=list)
    related_concepts = Column(ARRAY(String), default=list)
    code = Column(Text, nullable=True)  # Generated Python code implementation

    # Relationships
    paper = relationship("Paper", back_populates="concepts")
    video_generations = relationship("VideoGeneration", back_populates="concept", cascade="all, delete-orphan")


class VideoGeneration(Base):
    """Video generation tracking - for rate limiting and history"""
    __tablename__ = "video_generations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Video data
    concept_name = Column(String(500), nullable=False)
    status = Column(SQLEnum(VideoStatusEnum), default=VideoStatusEnum.GENERATING, nullable=False)
    video_url = Column(String(1000), nullable=True)  # Vercel Blob URL

    # Metadata
    clips_paths = Column(ARRAY(String), default=list)
    captions = Column(JSON, default=list)  # List of caption dicts
    logs = Column(ARRAY(Text), default=list)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="video_generations")
    paper = relationship("Paper", back_populates="video_generations")
    concept = relationship("Concept", back_populates="video_generations")
