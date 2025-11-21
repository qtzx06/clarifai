"""
Upload API endpoints for PDF file handling
"""

import os
import uuid
import json
from typing import Dict, Any
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from ...core.config import settings
from ...core.auth import verify_api_key
from ...models.paper import Paper, PaperResponse, AnalysisStatus, Concept
from ...services.pdf_parser import PDFParser
from ...services.gemini_service import GeminiService

router = APIRouter()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Persistence file path
PERSISTENCE_FILE = Path("storage/papers_db.json")

# In-memory storage (loaded from disk on startup)
papers_db: Dict[str, Paper] = {}


def load_papers_from_disk():
    """Load papers from JSON file on startup"""
    global papers_db
    if PERSISTENCE_FILE.exists():
        try:
            with open(PERSISTENCE_FILE, "r") as f:
                data = json.load(f)
                papers_db = {}
                for paper_id, paper_data in data.items():
                    # Convert datetime strings back to datetime objects
                    from datetime import datetime
                    if "upload_time" in paper_data and isinstance(paper_data["upload_time"], str):
                        paper_data["upload_time"] = datetime.fromisoformat(paper_data["upload_time"])
                    
                    # Handle ConceptVideo datetime fields
                    if "concept_videos" in paper_data:
                        for concept_id, video_data in paper_data["concept_videos"].items():
                            if "created_at" in video_data and isinstance(video_data["created_at"], str):
                                video_data["created_at"] = datetime.fromisoformat(video_data["created_at"])
                    
                    # Reconstruct Paper object from dict
                    paper = Paper(**paper_data)
                    papers_db[paper_id] = paper
            print(f"Loaded {len(papers_db)} papers from disk")
        except Exception as e:
            print(f"Error loading papers from disk: {e}")
            import traceback
            traceback.print_exc()
            papers_db = {}


def save_papers_to_disk():
    """Save papers to JSON file"""
    try:
        # Ensure directory exists
        PERSISTENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert Paper objects to dicts
        data = {}
        for paper_id, paper in papers_db.items():
            data[paper_id] = paper.model_dump(mode='json')
        
        with open(PERSISTENCE_FILE, "w") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving papers to disk: {e}")


# Load papers on module import
load_papers_from_disk()

# Initialize services
pdf_parser = PDFParser()
gemini_service = GeminiService()


@router.post("/upload")
@limiter.limit("5/hour")
async def upload_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key)
) -> Dict[str, Any]:
    """
    Upload PDF file and start processing
    Rate limit: 5 uploads per hour per IP
    Requires API key authentication
    """
    # Validate file
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    if not file.size or file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size must be less than {settings.MAX_FILE_SIZE} bytes",
        )

    try:
        # Generate unique filename
        paper_id = str(uuid.uuid4())
        filename = f"{paper_id}_{file.filename}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)

        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Create paper record
        paper = Paper.create_new(filename=file.filename, file_path=file_path)
        paper.id = paper_id
        papers_db[paper_id] = paper
        save_papers_to_disk()  # Save immediately

        # Start background processing
        background_tasks.add_task(process_paper, paper_id)

        return {
            "id": paper_id,
            "filename": file.filename,
            "title": "",
            "authors": [],
            "abstract": "",
            "uploaded_at": paper.upload_time.isoformat(),
            "status": "uploaded",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/papers")
async def list_papers() -> Dict[str, Any]:
    """
    List all uploaded papers
    """
    paper_responses = []
    for paper in papers_db.values():
        paper_responses.append(
            PaperResponse(
                id=paper.id,
                title=paper.title or paper.filename,
                authors=paper.authors,
                abstract=paper.abstract,
                analysis_status=paper.analysis_status.value,
                video_status=paper.video_status.value,
                upload_time=paper.upload_time,
                concepts_count=len(paper.concepts),
                has_video=bool(paper.video_path),
            )
        )

    return {"papers": paper_responses, "total": len(paper_responses)}


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str) -> Paper:
    """
    Get specific paper details
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    return papers_db[paper_id]


@router.get("/papers/{paper_id}/status")
async def get_paper_status(paper_id: str) -> Dict[str, Any]:
    """
    Get paper processing status
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]

    # Map backend status to frontend expected values
    status_map = {
        "pending": "uploaded",
        "processing": "analyzing",
        "completed": "analyzed",
        "failed": "error"
    }

    return {
        "id": paper_id,
        "filename": paper.filename,
        "title": paper.title,
        "authors": paper.authors,
        "abstract": paper.abstract,
        "uploaded_at": paper.upload_time.isoformat(),
        "status": status_map.get(paper.analysis_status.value, "uploaded"),
        "analysis_status": paper.analysis_status.value,
        "video_status": paper.video_status.value,
        "concepts_count": len(paper.concepts),
        "has_content": bool(paper.content),
        "has_video": bool(paper.video_path),
    }


async def process_paper(paper_id: str):
    """
    Background task to process uploaded paper
    """
    if paper_id not in papers_db:
        return

    paper = papers_db[paper_id]

    try:
        paper.analysis_status = AnalysisStatus.PROCESSING

        print(f"Parsing PDF for paper {paper_id}")
        parse_result = await pdf_parser.parse_pdf(paper.file_path)

        if not parse_result["success"]:
            paper.analysis_status = AnalysisStatus.FAILED
            return

        paper.content = parse_result["content"]

        ai_metadata = await gemini_service.extract_paper_metadata_with_gemini(
            paper.content
        )

        paper.title = (
            ai_metadata.get("title") or parse_result["title"] or paper.filename
        )
        paper.authors = ai_metadata.get("authors") or parse_result["authors"]
        # Use generated summary (stored as "abstract" for compatibility)
        # If summary generation failed, fall back to extracted abstract
        paper.abstract = ai_metadata.get("abstract") or parse_result.get("abstract", "")

        # Extract concepts automatically during processing
        print(f"Extracting concepts for paper {paper_id}")
        try:
            concepts_data = await gemini_service.generate_concepts_with_gemini(
                paper.content
            )

            print(f"Raw concepts from Gemini: {len(concepts_data)} concepts")
            for concept in concepts_data:
                print(
                    f"   - '{concept.get('name', 'NO_NAME')}': {concept.get('description', 'NO_DESC')[:50]}..."
                )

            # Filter out generic/fallback concepts
            valid_concepts_data = []
            for concept_data in concepts_data:
                name = concept_data.get("name", "")
                description = concept_data.get("description", "")

                # Filter out obvious generic patterns
                is_generic = (
                    not name
                    or not description
                    or len(name) <= 3
                    or len(description) <= 10
                    or name.lower().startswith("key concept from")
                    or "temporarily unavailable" in description.lower()
                    or "clear, descriptive name" in description.lower()
                    or "Research Implementation Details" in name
                    or "Performance Optimization Strategy" in name
                    or "Experimental Design Framework" in name
                    or "Technical Analysis Method" in name
                    or "Data Processing Technique" in name
                    or "Statistical Evaluation Approach" in name
                )

                if not is_generic:
                    valid_concepts_data.append(concept_data)
                    print(f"Valid concept: '{name}'")
                else:
                    print(f"Filtered out generic concept: '{name}'")

            # Convert to Concept objects
            paper.concepts = []
            for concept_data in valid_concepts_data:
                concept = Concept(
                    id=str(uuid.uuid4()),
                    name=concept_data["name"],
                    description=concept_data["description"],
                    importance_score=concept_data["importance_score"],
                    page_numbers=[],
                    text_snippets=[],
                    related_concepts=[],
                    concept_type=concept_data.get("concept_type", "conceptual"),
                )
                paper.concepts.append(concept)

            print(f"Extracted {len(paper.concepts)} valid concepts for paper: {paper.title}")
        except Exception as e:
            print(f"Concept extraction failed (non-fatal): {e}")
            # Don't fail the whole processing if concept extraction fails
            paper.concepts = []

        paper.analysis_status = AnalysisStatus.COMPLETED
        print(f"Paper processing completed: {paper.title}")
        save_papers_to_disk()  # Save after processing completes

    except Exception as e:
        print(f"Error processing paper {paper_id}: {e}")
        paper.analysis_status = AnalysisStatus.FAILED
        save_papers_to_disk()  # Save even on failure


@router.get("/papers/{paper_id}/pdf")
async def serve_pdf(paper_id: str):
    """
    Serve PDF file for embedded viewing
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]

    if not os.path.exists(paper.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found")

    return FileResponse(
        path=paper.file_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={paper.filename}",
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str) -> Dict[str, str]:
    """
    Delete paper and associated files
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]

    try:
        # Delete file
        if os.path.exists(paper.file_path):
            os.remove(paper.file_path)

        # Delete video files if they exist
        if paper.video_path and os.path.exists(paper.video_path):
            os.remove(paper.video_path)

        # Remove from database
        del papers_db[paper_id]

        # Persist deletion to disk
        save_papers_to_disk()

        return {"message": "Paper deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
