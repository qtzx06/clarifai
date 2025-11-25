"""
Storage service abstraction - supports both JSON and database storage
"""

from typing import Dict, Optional, List
from pathlib import Path
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import OperationalError

from ..core.config import settings
from ..models.paper import Paper as PydanticPaper, Concept as PydanticConcept, ConceptVideo, AnalysisStatus, VideoStatus
from ..database.models import (
    Paper as DBPaper, Concept as DBConcept, VideoGeneration,
    AnalysisStatusEnum, VideoStatusEnum, User
)
from ..database import get_db

PERSISTENCE_FILE = Path("storage/papers_db.json")

# Global flag to determine storage mode
USE_DATABASE = bool(settings.SUPABASE_DATABASE_URL)

# Track if database connection has failed (to avoid repeated error logs)
_db_connection_failed = False

# In-memory cache for JSON mode
_papers_cache: Dict[str, PydanticPaper] = {}


def _load_papers_from_json():
    """Load papers from JSON file"""
    global _papers_cache
    if PERSISTENCE_FILE.exists():
        try:
            with open(PERSISTENCE_FILE, "r") as f:
                data = json.load(f)
                _papers_cache = {}
                for paper_id, paper_data in data.items():
                    # Convert datetime strings
                    if "upload_time" in paper_data and isinstance(paper_data["upload_time"], str):
                        paper_data["upload_time"] = datetime.fromisoformat(paper_data["upload_time"])
                    
                    # Handle ConceptVideo datetime fields
                    if "concept_videos" in paper_data:
                        for concept_id, video_data in paper_data["concept_videos"].items():
                            if "created_at" in video_data and isinstance(video_data["created_at"], str):
                                video_data["created_at"] = datetime.fromisoformat(video_data["created_at"])
                    
                    if "user_id" not in paper_data:
                        paper_data["user_id"] = None
                    
                    _papers_cache[paper_id] = PydanticPaper(**paper_data)
        except Exception as e:
            print(f"Error loading papers from JSON: {e}")
            _papers_cache = {}


def _save_papers_to_json():
    """Save papers to JSON file"""
    try:
        PERSISTENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
        data = {}
        for paper_id, paper in _papers_cache.items():
            data[paper_id] = paper.model_dump(mode='json')
        with open(PERSISTENCE_FILE, "w") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving papers to JSON: {e}")


# Load on module import (JSON mode only)
if not USE_DATABASE:
    _load_papers_from_json()


def _pydantic_to_db_paper(pydantic: PydanticPaper, db: Session, user_id: uuid.UUID) -> DBPaper:
    """Convert Pydantic Paper to database Paper"""
    paper_uuid = uuid.UUID(pydantic.id)
    
    db_paper = DBPaper(
        id=paper_uuid,
        user_id=user_id,
        title=pydantic.title or "",
        authors=pydantic.authors or [],
        abstract=pydantic.abstract or "",
        filename=pydantic.filename,
        file_path=pydantic.file_path,
        upload_time=pydantic.upload_time,
        analysis_status=AnalysisStatusEnum(pydantic.analysis_status.value),
        video_status=VideoStatusEnum(pydantic.video_status.value),
        content=pydantic.content or "",
        full_analysis=pydantic.full_analysis or "",
        methodology=pydantic.methodology or "",
        insights=pydantic.insights or [],
        video_path=pydantic.video_path,
        clips_paths=pydantic.clips_paths or []
    )
    return db_paper


def _db_to_pydantic_paper(db_paper: DBPaper) -> PydanticPaper:
    """Convert database Paper to Pydantic Paper"""
    # Load concepts
    concepts = []
    for db_concept in db_paper.concepts:
        concepts.append(PydanticConcept(
            id=str(db_concept.id),
            name=db_concept.name,
            description=db_concept.description,
            importance_score=db_concept.importance_score,
            concept_type=db_concept.concept_type,
            page_numbers=db_concept.page_numbers or [],
            text_snippets=db_concept.text_snippets or [],
            related_concepts=db_concept.related_concepts or [],
            code=db_concept.code  # Include generated code if it exists
        ))
    
    # Load concept videos
    concept_videos = {}
    for video_gen in db_paper.video_generations:
        concept_id = str(video_gen.concept_id)
        concept_videos[concept_id] = ConceptVideo(
            concept_id=concept_id,
            concept_name=video_gen.concept_name,
            status=VideoStatus(video_gen.status.value),
            video_path=video_gen.video_url,
            clips_paths=video_gen.clips_paths or [],
            created_at=video_gen.created_at,
            logs=video_gen.logs or [],
            captions=video_gen.captions or []
        )
    
    return PydanticPaper(
        id=str(db_paper.id),
        user_id=str(db_paper.user_id),
        title=db_paper.title,
        authors=db_paper.authors or [],
        abstract=db_paper.abstract or "",
        content=db_paper.content or "",
        filename=db_paper.filename,
        file_path=db_paper.file_path,
        upload_time=db_paper.upload_time,
        analysis_status=AnalysisStatus(db_paper.analysis_status.value),
        video_status=VideoStatus(db_paper.video_status.value),
        concepts=concepts,
        insights=db_paper.insights or [],
        methodology=db_paper.methodology or "",
        full_analysis=db_paper.full_analysis or "",
        video_path=db_paper.video_path,
        clips_paths=db_paper.clips_paths or [],
        concept_videos=concept_videos
    )


class PaperStorage:
    """Storage service for papers - abstracts JSON vs database"""
    
    @staticmethod
    def get_paper(paper_id: str, user_id: Optional[str] = None, skip_ownership_check: bool = False) -> Optional[PydanticPaper]:
        """Get a paper by ID"""
        if USE_DATABASE:
            try:
                db = next(get_db())
                try:
                    paper_uuid = uuid.UUID(paper_id)
                    db_paper = db.query(DBPaper).filter(DBPaper.id == paper_uuid).first()
                    if not db_paper:
                        return None
                    
                    # Check ownership (unless skipped for background tasks)
                    if not skip_ownership_check and user_id and str(db_paper.user_id) != user_id:
                        return None
                    
                    return _db_to_pydantic_paper(db_paper)
                finally:
                    db.close()
            except OperationalError as e:
                global _db_connection_failed
                if not _db_connection_failed:
                    print(f"Warning: Database connection failed, falling back to JSON storage: {e}")
                    _db_connection_failed = True
                # Fall through to JSON mode
                _load_papers_from_json()  # Ensure JSON cache is loaded
        
        # JSON mode (or fallback from database error)
        if not _papers_cache:
            _load_papers_from_json()
        if paper_id not in _papers_cache:
            return None
        paper = _papers_cache[paper_id]
        if not skip_ownership_check and user_id and paper.user_id != user_id:
            return None
        return paper
    
    @staticmethod
    def list_papers(user_id: Optional[str] = None) -> List[PydanticPaper]:
        """List all papers, optionally filtered by user_id"""
        if USE_DATABASE:
            try:
                db = next(get_db())
                try:
                    query = db.query(DBPaper)
                    if user_id:
                        user_uuid = uuid.UUID(user_id)
                        query = query.filter(DBPaper.user_id == user_uuid)
                    else:
                        # In dev mode, show all papers
                        pass
                    
                    db_papers = query.all()
                    return [_db_to_pydantic_paper(p) for p in db_papers]
                finally:
                    db.close()
            except OperationalError as e:
                global _db_connection_failed
                if not _db_connection_failed:
                    print(f"Warning: Database connection failed, falling back to JSON storage: {e}")
                    _db_connection_failed = True
                # Fall through to JSON mode
                _load_papers_from_json()  # Ensure JSON cache is loaded
        
        # JSON mode (or fallback from database error)
        if not _papers_cache:
            _load_papers_from_json()
        papers = list(_papers_cache.values())
        if user_id:
            papers = [p for p in papers if p.user_id == user_id]
        return papers
    
    @staticmethod
    def save_paper(paper: PydanticPaper, user_id: str):
        """Save or update a paper"""
        if USE_DATABASE:
            try:
                db = next(get_db())
                try:
                    user_uuid = uuid.UUID(user_id)
                    paper_uuid = uuid.UUID(paper.id)
                    
                    # Get or create paper
                    db_paper = db.query(DBPaper).filter(DBPaper.id == paper_uuid).first()
                    if db_paper:
                        # Update existing
                        db_paper.title = paper.title or ""
                        db_paper.authors = paper.authors or []
                        db_paper.abstract = paper.abstract or ""
                        db_paper.content = paper.content or ""
                        db_paper.full_analysis = paper.full_analysis or ""
                        db_paper.methodology = paper.methodology or ""
                        db_paper.insights = paper.insights or []
                        db_paper.analysis_status = AnalysisStatusEnum(paper.analysis_status.value)
                        db_paper.video_status = VideoStatusEnum(paper.video_status.value)
                        db_paper.video_path = paper.video_path
                        db_paper.clips_paths = paper.clips_paths or []
                    else:
                        # Create new
                        db_paper = _pydantic_to_db_paper(paper, db, user_uuid)
                        db.add(db_paper)
                    
                    # Update concepts
                    existing_concept_ids = {str(c.id) for c in db_paper.concepts}
                    for pydantic_concept in paper.concepts:
                        concept_uuid = uuid.UUID(pydantic_concept.id)
                        db_concept = db.query(DBConcept).filter(DBConcept.id == concept_uuid).first()
                        if db_concept:
                            # Update
                            db_concept.name = pydantic_concept.name
                            db_concept.description = pydantic_concept.description
                            db_concept.importance_score = pydantic_concept.importance_score
                            db_concept.concept_type = pydantic_concept.concept_type
                            db_concept.page_numbers = pydantic_concept.page_numbers or []
                            db_concept.text_snippets = pydantic_concept.text_snippets or []
                            db_concept.related_concepts = pydantic_concept.related_concepts or []
                            db_concept.code = pydantic_concept.code  # Update code if it exists
                        else:
                            # Create
                            db_concept = DBConcept(
                                id=concept_uuid,
                                paper_id=db_paper.id,
                                name=pydantic_concept.name,
                                description=pydantic_concept.description,
                                importance_score=pydantic_concept.importance_score,
                                concept_type=pydantic_concept.concept_type,
                                page_numbers=pydantic_concept.page_numbers or [],
                                text_snippets=pydantic_concept.text_snippets or [],
                                related_concepts=pydantic_concept.related_concepts or [],
                                code=pydantic_concept.code  # Include code if it exists
                            )
                            db.add(db_concept)
                        existing_concept_ids.discard(str(pydantic_concept.id))
                    
                    # Delete removed concepts
                    for concept_id in existing_concept_ids:
                        concept_uuid = uuid.UUID(concept_id)
                        db.query(DBConcept).filter(DBConcept.id == concept_uuid).delete()
                    
                    # Update concept videos
                    for concept_id, concept_video in paper.concept_videos.items():
                        concept_uuid = uuid.UUID(concept_id)
                        video_gen = db.query(VideoGeneration).filter(
                            VideoGeneration.paper_id == db_paper.id,
                            VideoGeneration.concept_id == concept_uuid
                        ).first()
                        
                        if video_gen:
                            video_gen.status = VideoStatusEnum(concept_video.status.value)
                            video_gen.video_url = concept_video.video_path
                            video_gen.clips_paths = concept_video.clips_paths or []
                            video_gen.captions = concept_video.captions or []
                            video_gen.logs = concept_video.logs or []
                        else:
                            video_gen = VideoGeneration(
                                id=uuid.uuid4(),
                                user_id=user_uuid,
                                paper_id=db_paper.id,
                                concept_id=concept_uuid,
                                concept_name=concept_video.concept_name,
                                status=VideoStatusEnum(concept_video.status.value),
                                video_url=concept_video.video_path,
                                clips_paths=concept_video.clips_paths or [],
                                captions=concept_video.captions or [],
                                logs=concept_video.logs or [],
                                created_at=concept_video.created_at
                            )
                            db.add(video_gen)
                    
                    db.commit()
                except Exception as e:
                    db.rollback()
                    raise e
                finally:
                    db.close()
            except OperationalError as e:
                global _db_connection_failed
                if not _db_connection_failed:
                    print(f"Warning: Database connection failed, falling back to JSON storage: {e}")
                    _db_connection_failed = True
                # Fall through to JSON mode
                _load_papers_from_json()  # Ensure JSON cache is loaded
        
        # JSON mode (or fallback from database error)
        if not _papers_cache:
            _load_papers_from_json()
        _papers_cache[paper.id] = paper
        _save_papers_to_json()
    
    @staticmethod
    def delete_paper(paper_id: str, user_id: Optional[str] = None) -> bool:
        """Delete a paper"""
        if USE_DATABASE:
            try:
                db = next(get_db())
                try:
                    paper_uuid = uuid.UUID(paper_id)
                    db_paper = db.query(DBPaper).filter(DBPaper.id == paper_uuid).first()
                    if not db_paper:
                        return False
                    
                    if user_id and str(db_paper.user_id) != user_id:
                        return False
                    
                    db.delete(db_paper)
                    db.commit()
                    return True
                except Exception as e:
                    db.rollback()
                    raise e
                finally:
                    db.close()
            except OperationalError as e:
                global _db_connection_failed
                if not _db_connection_failed:
                    print(f"Warning: Database connection failed, falling back to JSON storage: {e}")
                    _db_connection_failed = True
                # Fall through to JSON mode
                _load_papers_from_json()  # Ensure JSON cache is loaded
        
        # JSON mode (or fallback from database error)
        if not _papers_cache:
            _load_papers_from_json()
        if paper_id not in _papers_cache:
            return False
        paper = _papers_cache[paper_id]
        if user_id and paper.user_id != user_id:
            return False
        del _papers_cache[paper_id]
        _save_papers_to_json()
        return True
    
    @staticmethod
    def count_user_videos_today(user_id: str) -> int:
        """Count videos generated today by user"""
        if USE_DATABASE:
            try:
                db = next(get_db())
                try:
                    user_uuid = uuid.UUID(user_id)
                    today = datetime.now().date()
                    today_start = datetime.combine(today, datetime.min.time())
                    
                    count = db.query(func.count(VideoGeneration.id)).filter(
                        VideoGeneration.user_id == user_uuid,
                        VideoGeneration.created_at >= today_start,
                        VideoGeneration.status.in_([VideoStatusEnum.COMPLETED, VideoStatusEnum.GENERATING])
                    ).scalar()
                    return count or 0
                finally:
                    db.close()
            except OperationalError:
                # Fall through to JSON mode
                _load_papers_from_json()  # Ensure JSON cache is loaded
        
        # JSON mode (or fallback from database error)
        if not _papers_cache:
            _load_papers_from_json()
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        count = 0
        for paper in _papers_cache.values():
            if paper.user_id == user_id:
                for cv in paper.concept_videos.values():
                    if cv.created_at >= today_start and cv.status.value in ["completed", "generating"]:
                        count += 1
        return count
    
    @staticmethod
    def count_user_concurrent_videos(user_id: str) -> int:
        """Count currently generating videos for user"""
        if USE_DATABASE:
            try:
                db = next(get_db())
                try:
                    user_uuid = uuid.UUID(user_id)
                    count = db.query(func.count(VideoGeneration.id)).filter(
                        VideoGeneration.user_id == user_uuid,
                        VideoGeneration.status == VideoStatusEnum.GENERATING
                    ).scalar()
                    return count or 0
                finally:
                    db.close()
            except OperationalError:
                # Fall through to JSON mode
                _load_papers_from_json()  # Ensure JSON cache is loaded
        
        # JSON mode (or fallback from database error)
        if not _papers_cache:
            _load_papers_from_json()
        count = 0
        for paper in _papers_cache.values():
            if paper.user_id == user_id:
                count += sum(1 for cv in paper.concept_videos.values() if cv.status.value == "generating")
        return count

