"""
Analysis API endpoints for paper concept extraction and clarification
"""
import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from ...models.paper import ConceptResponse, Concept
from ...services.gemini_service import GeminiService
from .upload import papers_db  # Import shared papers database

router = APIRouter()

# Initialize services
gemini_service = GeminiService()

class AnalyzeRequest(BaseModel):
    paper_id: str

class ClarifyRequest(BaseModel):
    text_snippet: str
    context: str = ""

@router.post("/papers/{paper_id}/analyze")
async def analyze_paper(paper_id: str) -> Dict[str, Any]:
    """
    Trigger analysis of an uploaded paper
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.content:
        raise HTTPException(status_code=400, detail="Paper content not available. Upload may still be processing.")
    
    try:
        # Analyze paper with Gemini (this will also extract concepts)
        print(f"Starting analysis for paper: {paper.title}")
        analysis_result = await gemini_service.analyze_paper_with_gemini(
            content=paper.content,
            title=paper.title
        )
        
        print(f"Raw analysis concepts: {len(analysis_result['concepts'])} concepts")
        for concept in analysis_result["concepts"]:
            print(f"   - '{concept.get('name', 'NO_NAME')}': {concept.get('description', 'NO_DESC')[:50]}...")
        
        # Light filtering - only remove obvious generic/fallback concepts
        valid_concepts_data = []
        for concept_data in analysis_result["concepts"]:
            name = concept_data.get("name", "")
            description = concept_data.get("description", "")
            
            # Only filter out obvious generic patterns
            is_generic = (
                not name or not description or
                len(name) <= 3 or len(description) <= 10 or
                # Only catch the most obvious generic patterns
                name.lower().startswith("key concept from") or
                "temporarily unavailable" in description.lower() or
                "clear, descriptive name" in description.lower()
            )
            
            if not is_generic:
                valid_concepts_data.append(concept_data)
                print(f"Valid analysis concept: '{name}'")
            else:
                print(f"Filtered out generic analysis concept: '{name}'")
        
        # Convert concepts to proper format
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
                concept_type=concept_data.get("concept_type", "conceptual")
            )
            paper.concepts.append(concept)
        
        # Update other analysis results
        paper.insights = analysis_result["insights"]
        paper.methodology = analysis_result["methodology"]
        paper.full_analysis = analysis_result["full_analysis"]
        
        print(f"Analysis completed for paper: {paper.title}")
        
        return {
            "message": "Analysis completed successfully",
            "concepts_extracted": len(paper.concepts),
            "insights_generated": len(paper.insights)
        }
        
    except Exception as e:
        print(f"Analysis failed for paper {paper_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.get("/papers/{paper_id}/concepts")
async def get_paper_concepts(paper_id: str) -> ConceptResponse:
    """
    Get extracted concepts for a paper
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    return ConceptResponse(
        concepts=paper.concepts,
        total_count=len(paper.concepts)
    )

@router.delete("/papers/{paper_id}/concepts/{concept_id}")
async def delete_concept(paper_id: str, concept_id: str) -> Dict[str, str]:
    """
    Delete a concept from a paper
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]
    initial_concept_count = len(paper.concepts)
    paper.concepts = [c for c in paper.concepts if c.id != concept_id]

    if len(paper.concepts) == initial_concept_count:
        raise HTTPException(status_code=404, detail="Concept not found")

    print(f"Deleted concept {concept_id} from paper {paper_id}")
    return {"message": "Concept deleted successfully"}

@router.post("/papers/{paper_id}/clarify")
async def clarify_text(paper_id: str, request: ClarifyRequest) -> Dict[str, str]:
    """
    Get clarification for specific text from a paper
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    try:
        # Use Gemini to clarify the text
        explanation = await gemini_service.clarify_text_with_gemini(
            text=request.text_snippet,
            context=f"Paper title: {paper.title}. {request.context}"
        )
        
        return {
            "text_snippet": request.text_snippet,
            "explanation": explanation,
            "paper_title": paper.title
        }
        
    except Exception as e:
        print(f"Clarification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Clarification failed: {str(e)}")

@router.get("/papers/{paper_id}/insights")
async def get_paper_insights(paper_id: str) -> Dict[str, Any]:
    """
    Get key insights from paper analysis
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    return {
        "paper_id": paper_id,
        "paper_title": paper.title,
        "insights": paper.insights,
        "methodology": paper.methodology,
        "analysis_summary": paper.full_analysis[:500] + "..." if len(paper.full_analysis) > 500 else paper.full_analysis,
        "concepts_count": len(paper.concepts)
    }

@router.post("/papers/{paper_id}/extract-concepts")
async def extract_concepts(paper_id: str) -> ConceptResponse:
    """
    Re-extract or refresh concepts for a paper using Gemini
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.content:
        raise HTTPException(status_code=400, detail="Paper content not available")
    
    try:
        # Extract concepts using Gemini
        concepts_data = await gemini_service.generate_concepts_with_gemini(paper.content)
        
        print(f"Raw concepts from Gemini: {len(concepts_data)} concepts")
        for concept in concepts_data:
            print(f"   - '{concept.get('name', 'NO_NAME')}': {concept.get('description', 'NO_DESC')[:50]}...")
        
        # Light filtering - only remove obvious generic/fallback concepts
        valid_concepts_data = []
        for concept_data in concepts_data:
            name = concept_data.get("name", "")
            description = concept_data.get("description", "")
            
            # Only filter out obvious generic patterns
            is_generic = (
                not name or not description or
                len(name) <= 3 or len(description) <= 10 or
                # Only catch the most obvious generic patterns
                name.lower().startswith("key concept from") or
                "temporarily unavailable" in description.lower() or
                "clear, descriptive name" in description.lower()
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
                concept_type=concept_data.get("concept_type", "conceptual")
            )
            paper.concepts.append(concept)
        
        print(f"Concepts refreshed for paper: {paper.title} ({len(paper.concepts)} valid concepts)")
        
        return ConceptResponse(
            concepts=paper.concepts,
            total_count=len(paper.concepts)
        )
        
    except Exception as e:
        print(f"Concept extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Concept extraction failed: {str(e)}")

@router.post("/papers/{paper_id}/generate-additional-concept")
async def generate_additional_concept(paper_id: str) -> Dict[str, Any]:
    """
    Generate ONE additional concept for a paper, considering existing concepts
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.content:
        raise HTTPException(status_code=400, detail="Paper content not available")
    
    try:
        # Get existing concept names to avoid duplicates
        existing_concept_names = [c.name for c in paper.concepts]
        
        print(f"Generating additional concept beyond existing: {existing_concept_names}")
        
        # Generate ONE additional concept using Gemini
        new_concept_data = await gemini_service.generate_additional_concept_with_gemini(
            content=paper.content,
            existing_concepts=existing_concept_names
        )
        
        if new_concept_data:
            # Create new concept object
            new_concept = Concept(
                id=str(uuid.uuid4()),
                name=new_concept_data["name"],
                description=new_concept_data["description"],
                importance_score=new_concept_data["importance_score"],
                page_numbers=[],
                text_snippets=[],
                related_concepts=[],
                concept_type=new_concept_data.get("concept_type", "conceptual")
            )
            
            # Add to existing concepts (don't replace)
            paper.concepts.append(new_concept)
            
            print(f"Generated additional concept: '{new_concept.name}'")
            
            return {
                "success": True,
                "new_concept": {
                    "id": new_concept.id,
                    "name": new_concept.name,
                    "description": new_concept.description,
                    "importance_score": new_concept.importance_score,
                    "concept_type": new_concept.concept_type
                },
                "total_concepts": len(paper.concepts)
            }
        else:
            print(f"Failed to generate an additional concept for paper {paper_id}")
            return {"success": False, "message": "Failed to generate an additional concept."}
        
    except Exception as e:
        print(f"Additional concept generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Additional concept generation failed: {str(e)}")

@router.post("/papers/{paper_id}/concepts/{concept_name}/implement", response_class=PlainTextResponse)
async def get_code_implementation(
    paper_id: str,
    concept_name: str,
) -> str:
    """
    Generate a Python code implementation for a given concept.
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]
    concept = next((c for c in paper.concepts if c.name == concept_name), None)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    try:
        gemini_service = GeminiService()
        code = await gemini_service.generate_python_implementation(concept.name, concept.description)
        return code
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

@router.get("/papers/{paper_id}/summary")
async def get_paper_summary(paper_id: str) -> Dict[str, Any]:
    """
    Get a comprehensive summary of the paper analysis
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    # Calculate concept importance distribution
    importance_distribution = {
        "high": len([c for c in paper.concepts if c.importance_score >= 0.8]),
        "medium": len([c for c in paper.concepts if 0.6 <= c.importance_score < 0.8]),
        "low": len([c for c in paper.concepts if c.importance_score < 0.6])
    }
    
    return {
        "paper_id": paper_id,
        "title": paper.title,
        "authors": paper.authors,
        "abstract": paper.abstract,
        "concepts_summary": {
            "total_concepts": len(paper.concepts),
            "importance_distribution": importance_distribution,
            "top_concepts": [
                {"name": c.name, "score": c.importance_score} 
                for c in sorted(paper.concepts, key=lambda x: x.importance_score, reverse=True)[:3]
            ]
        },
        "insights_count": len(paper.insights),
        "methodology": paper.methodology,
        "analysis_status": paper.analysis_status.value,
        "video_status": paper.video_status.value
    }