"""
Upload API endpoints for PDF file handling
"""
import os
import uuid
import asyncio
from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pathlib import Path

from ...core.config import settings
from ...models.paper import Paper, PaperResponse, AnalysisStatus, Concept
from ...services.pdf_parser import PDFParser
from ...services.gemini_service import GeminiService

router = APIRouter()

# In-memory storage for demo (replace with database in production)
papers_db: Dict[str, Paper] = {}

# Initialize services
pdf_parser = PDFParser()
gemini_service = GeminiService()

@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Upload PDF file and start processing
    """
    # Validate file
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    if not file.size or file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File size must be less than {settings.MAX_FILE_SIZE} bytes")
    
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
        
        # Start background processing
        background_tasks.add_task(process_paper, paper_id)
        
        return {
            "message": "File uploaded successfully",
            "paper_id": paper_id,
            "filename": file.filename,
            "status": "processing"
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
        paper_responses.append(PaperResponse(
            id=paper.id,
            title=paper.title or paper.filename,
            authors=paper.authors,
            abstract=paper.abstract,
            analysis_status=paper.analysis_status.value,
            video_status=paper.video_status.value,
            upload_time=paper.upload_time,
            concepts_count=len(paper.concepts),
            has_video=bool(paper.video_path)
        ))
    
    return {
        "papers": paper_responses,
        "total": len(paper_responses)
    }

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
    return {
        "paper_id": paper_id,
        "analysis_status": paper.analysis_status.value,
        "video_status": paper.video_status.value,
        "concepts_count": len(paper.concepts),
        "has_content": bool(paper.content),
        "has_video": bool(paper.video_path)
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

        ai_metadata = await gemini_service.extract_paper_metadata_with_gemini(paper.content)

        paper.title = ai_metadata.get("title") or parse_result["title"] or paper.filename
        paper.authors = ai_metadata.get("authors") or parse_result["authors"]
        paper.abstract = ai_metadata.get("abstract") or parse_result["abstract"]

        paper.analysis_status = AnalysisStatus.COMPLETED
        print(f"Paper processing completed: {paper.title}")

    except Exception as e:
        print(f"Error processing paper {paper_id}: {e}")
        paper.analysis_status = AnalysisStatus.FAILED

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
            "Cache-Control": "public, max-age=3600"
        }
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
        
        return {"message": "Paper deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")