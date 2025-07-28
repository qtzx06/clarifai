"""
Upload endpoints for PDF files
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import os
import uuid
from datetime import datetime
from typing import Dict, Any

from ...models.paper import Paper, PaperUpload, AnalysisStatus
from ...services.pdf_parser import PDFParser
from ...core.config import settings

router = APIRouter()

# In-memory storage for demonstration (replace with database in production)
papers_db: Dict[str, Paper] = {}

@router.post("/upload")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
) -> JSONResponse:
    """
    Upload a PDF file for analysis
    """
    # Validate file
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size too large")
    
    try:
        # Generate unique paper ID
        paper_id = str(uuid.uuid4())
        
        # Save file
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, f"{paper_id}.pdf")
        
        # Read and save file content
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Parse PDF in background
        background_tasks.add_task(parse_pdf_background, paper_id, file_path, file.filename)
        
        # Create paper record
        paper = Paper(
            id=paper_id,
            title="Processing...",
            authors=[],
            abstract="",
            content="",
            uploaded_at=datetime.now(),
            file_path=file_path,
            analysis_status=AnalysisStatus.PROCESSING
        )
        
        papers_db[paper_id] = paper
        
        return JSONResponse({
            "paper_id": paper_id,
            "filename": file.filename,
            "status": "uploaded",
            "message": "PDF uploaded successfully. Processing in background."
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str) -> Paper:
    """
    Get paper details by ID
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
        "analysis_status": paper.analysis_status,
        "video_status": paper.video_status,
        "title": paper.title,
        "concepts_count": len(paper.concepts),
        "has_video": paper.video_path is not None
    }

@router.get("/papers")
async def list_papers() -> Dict[str, Any]:
    """
    List all uploaded papers
    """
    papers_list = []
    for paper_id, paper in papers_db.items():
        papers_list.append({
            "id": paper_id,
            "title": paper.title,
            "authors": paper.authors,
            "uploaded_at": paper.uploaded_at,
            "analysis_status": paper.analysis_status,
            "video_status": paper.video_status
        })
    
    return {
        "papers": papers_list,
        "total": len(papers_list)
    }

async def parse_pdf_background(paper_id: str, file_path: str, filename: str):
    """
    Background task to parse PDF and extract content
    """
    try:
        parser = PDFParser()
        result = await parser.extract_text_and_metadata(file_path)
        
        # Update paper record
        if paper_id in papers_db:
            paper = papers_db[paper_id]
            paper.title = result.get('title', filename)
            paper.authors = result.get('authors', [])
            paper.abstract = result.get('abstract', '')
            paper.content = result.get('content', '')
            paper.analysis_status = AnalysisStatus.COMPLETED
            
            print(f"Successfully parsed PDF for paper {paper_id}: {paper.title}")
        
    except Exception as e:
        print(f"Error parsing PDF for paper {paper_id}: {e}")
        if paper_id in papers_db:
            papers_db[paper_id].analysis_status = AnalysisStatus.FAILED