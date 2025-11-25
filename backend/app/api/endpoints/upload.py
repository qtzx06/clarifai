"""
Upload API endpoints for PDF file handling
"""

import os
import uuid
import json
from typing import Dict, Any, Optional
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import FileResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from ...core.config import settings
from ...core.auth import verify_api_key, get_current_user_id
from ...models.paper import Paper, PaperResponse, AnalysisStatus, Concept
from ...services.pdf_parser import PDFParser
from ...services.gemini_service import GeminiService
from ...services.storage import PaperStorage

router = APIRouter()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize services
pdf_parser = PDFParser()
gemini_service = GeminiService()


def verify_paper_access(paper: Paper, user_id: Optional[str]) -> None:
    """
    Verify that the user can access the paper.
    Allows access if:
    - Paper has no user_id (old papers, backward compatibility)
    - User owns the paper (paper.user_id == user_id)
    Raises HTTPException if access is denied.
    """
    if user_id and paper.user_id is not None and paper.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")


@router.post("/upload")
@limiter.limit("5/hour")
async def upload_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
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

        # Create paper record with user_id
        print(f"[UPLOAD] Creating paper {paper_id} with user_id: {user_id}")
        paper = Paper.create_new(filename=file.filename, file_path=file_path, user_id=user_id)
        paper.id = paper_id
        
        # Save to storage (database or JSON)
        if user_id:
            PaperStorage.save_paper(paper, user_id)
        else:
            # For dev mode without user_id, use a default
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")
        
        print(f"[UPLOAD] Paper {paper_id} stored with user_id: {paper.user_id}")

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
async def list_papers(
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    List all uploaded papers for the current user
    """
    papers = PaperStorage.list_papers(user_id=user_id)
    
    paper_responses = []
    for paper in papers:
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
async def get_paper(
    paper_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Paper:
    """
    Get specific paper details
    """
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    verify_paper_access(paper, user_id)
    return paper


@router.get("/papers/{paper_id}/status")
async def get_paper_status(
    paper_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get paper processing status
    """
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    verify_paper_access(paper, user_id)
    
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
    # Skip ownership check for background tasks
    paper = PaperStorage.get_paper(paper_id, skip_ownership_check=True)
    if not paper:
        return

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
        
        # Save to storage
        if paper.user_id:
            PaperStorage.save_paper(paper, paper.user_id)
        else:
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")

    except Exception as e:
        print(f"Error processing paper {paper_id}: {e}")
        paper.analysis_status = AnalysisStatus.FAILED
        
        # Save even on failure
        if paper.user_id:
            PaperStorage.save_paper(paper, paper.user_id)
        else:
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")


@router.get("/papers/{paper_id}/pdf")
async def serve_pdf(
    paper_id: str,
    user_id: Optional[str] = Depends(get_current_user_id)
):
    """
    Serve PDF file for embedded viewing
    """
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    verify_paper_access(paper, user_id)
    
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
async def delete_paper(
    paper_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, str]:
    """
    Delete paper and associated files
    """
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    verify_paper_access(paper, user_id)

    try:
        # Delete file
        if os.path.exists(paper.file_path):
            os.remove(paper.file_path)

        # Delete video files if they exist
        if paper.video_path and os.path.exists(paper.video_path):
            os.remove(paper.video_path)
        
        # Delete concept video files
        for concept_video in paper.concept_videos.values():
            if concept_video.video_path and os.path.exists(concept_video.video_path):
                os.remove(concept_video.video_path)

        # Remove from storage
        PaperStorage.delete_paper(paper_id, user_id)

        return {"message": "Paper deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
