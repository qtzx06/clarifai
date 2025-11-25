"""
Analysis API endpoints for paper concept extraction and clarification
"""

import uuid
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel

from ...models.paper import ConceptResponse, Concept
from ...services.gemini_service import GeminiService
from ...services.storage import PaperStorage
from ...core.auth import get_current_user_id, verify_api_key

router = APIRouter()

# Initialize services
gemini_service = GeminiService()


def verify_paper_ownership(paper_id: str, user_id: Optional[str]) -> None:
    """
    Verify that the user can access the paper. Raises HTTPException if not.
    Allows access if paper has no user_id (old papers) or user owns the paper.
    """
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # Verify ownership if user_id is provided
    # Allow access if paper has no user_id (old papers) or user owns the paper
    if user_id and paper.user_id is not None and paper.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")


class AnalyzeRequest(BaseModel):
    paper_id: str


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ClarifyRequest(BaseModel):
    question: str = ""
    text_snippet: str = ""  # Keep for backward compatibility
    context: str = ""
    conversation_history: List[ChatMessage] = []  # Previous messages in the conversation


@router.post("/papers/{paper_id}/analyze")
async def analyze_paper(
    paper_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Trigger analysis of an uploaded paper
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if not paper.content:
        raise HTTPException(
            status_code=400,
            detail="Paper content not available. Upload may still be processing.",
        )

    try:
        # Analyze paper with Gemini (this will also extract concepts)
        print(f"Starting analysis for paper: {paper.title}")
        analysis_result = await gemini_service.analyze_paper_with_gemini(
            content=paper.content, title=paper.title
        )

        print(f"Raw analysis concepts: {len(analysis_result['concepts'])} concepts")
        for concept in analysis_result["concepts"]:
            print(
                f"   - '{concept.get('name', 'NO_NAME')}': {concept.get('description', 'NO_DESC')[:50]}..."
            )

        # Light filtering - only remove obvious generic/fallback concepts
        valid_concepts_data = []
        for concept_data in analysis_result["concepts"]:
            name = concept_data.get("name", "")
            description = concept_data.get("description", "")

            # Only filter out obvious generic patterns
            is_generic = (
                not name
                or not description
                or len(name) <= 3
                or len(description) <= 10
                or
                # Only catch the most obvious generic patterns
                name.lower().startswith("key concept from")
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
                concept_type=concept_data.get("concept_type", "conceptual"),
            )
            paper.concepts.append(concept)

        # Update other analysis results
        paper.insights = analysis_result["insights"]
        paper.methodology = analysis_result["methodology"]
        paper.full_analysis = analysis_result["full_analysis"]

        print(f"Analysis completed for paper: {paper.title}")
        
        # Save to storage
        if paper.user_id:
            PaperStorage.save_paper(paper, paper.user_id)
        else:
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")

        return {
            "message": "Analysis completed successfully",
            "concepts_extracted": len(paper.concepts),
            "insights_generated": len(paper.insights),
        }

    except Exception as e:
        print(f"Analysis failed for paper {paper_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/papers/{paper_id}/concepts")
async def get_paper_concepts(
    paper_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
):
    """
    Get extracted concepts for a paper
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    concepts_with_status = []
    for concept in paper.concepts:
        # Build a dict that matches the frontend expectations
        concept_dict = {
            "id": concept.id,
            "name": concept.name,
            "description": concept.description,
            "importance_score": concept.importance_score,
            "page_numbers": concept.page_numbers,
            "text_snippets": concept.text_snippets,
            "related_concepts": concept.related_concepts,
            "type": concept.concept_type,
            "code": concept.code if hasattr(concept, 'code') else None,  # Include code if it exists
        }

        # Get video status from concept_videos if it exists
        concept_video = paper.concept_videos.get(concept.id)
        if concept_video:
            # Map VideoStatus enum to frontend expected values
            status_map = {
                "not_started": "not_generated",
                "generating": "generating",
                "completed": "ready",
                "failed": "error"
            }
            mapped_status = status_map.get(concept_video.status.value, "not_generated")
            concept_dict["video_status"] = mapped_status
            print(f"[CONCEPTS] Concept {concept.id}: video_status={concept_video.status.value} -> {mapped_status}")
            if concept_video.video_path:
                concept_dict["video_url"] = concept_video.video_path
            if concept_video.captions:
                concept_dict["video_captions"] = concept_video.captions
        else:
            concept_dict["video_status"] = "not_generated"
            print(f"[CONCEPTS] Concept {concept.id}: no concept_video entry, defaulting to 'not_generated'")
        
        concepts_with_status.append(concept_dict)

    # Return JSON response directly so extra fields aren't stripped
    return JSONResponse(
        content={
            "concepts": concepts_with_status,
            "total_count": len(concepts_with_status),
        }
    )


@router.delete("/papers/{paper_id}/concepts/{concept_id}")
async def delete_concept(
    paper_id: str,
    concept_id: str,
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, str]:
    """
    Delete a concept from a paper
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    initial_concept_count = len(paper.concepts)
    paper.concepts = [c for c in paper.concepts if c.id != concept_id]

    if len(paper.concepts) == initial_concept_count:
        raise HTTPException(status_code=404, detail="Concept not found")

    # Save updated paper
    if paper.user_id:
        PaperStorage.save_paper(paper, paper.user_id)
    else:
        PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")

    print(f"Deleted concept {concept_id} from paper {paper_id}")
    return {"message": "Concept deleted successfully"}


@router.post("/papers/{paper_id}/clarify")
async def clarify_text(
    paper_id: str,
    request: ClarifyRequest,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Answer questions about a paper with conversation history support
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    try:
        # Support both question format and text_snippet format
        query_text = request.question if request.question else request.text_snippet
        
        if not query_text:
            raise HTTPException(status_code=400, detail="Question or text_snippet is required")

        # Build context with paper information
        context_parts = [f"Paper title: {paper.title}"]
        if paper.abstract:
            context_parts.append(f"Summary: {paper.abstract[:500]}")
        if paper.content:
            context_parts.append(f"Paper content (first 2000 chars): {paper.content[:2000]}")
        if request.context:
            context_parts.append(request.context)
        
        base_context = ". ".join(context_parts)

        # Build conversation history for context
        conversation_context = ""
        if request.conversation_history:
            conversation_context = "\n\nPrevious conversation:\n"
            for msg in request.conversation_history[-5:]:  # Last 5 messages for context
                conversation_context += f"{msg.role}: {msg.content}\n"
        
        full_context = base_context + conversation_context

        # Use Gemini to answer the question with conversation context
        explanation = await gemini_service.clarify_text_with_gemini(
            text=query_text,
            context=full_context,
        )

        return {
            "answer": explanation,
            "question": query_text,
            "paper_title": paper.title,
        }

    except Exception as e:
        print(f"Clarification failed: {e}")
        raise HTTPException(status_code=500, detail=f"Clarification failed: {str(e)}")


@router.get("/papers/{paper_id}/insights")
async def get_paper_insights(
    paper_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get key insights from paper analysis
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    return {
        "paper_id": paper_id,
        "paper_title": paper.title,
        "insights": paper.insights,
        "methodology": paper.methodology,
        "analysis_summary": paper.full_analysis[:500] + "..."
        if len(paper.full_analysis) > 500
        else paper.full_analysis,
        "concepts_count": len(paper.concepts),
    }


@router.post("/papers/{paper_id}/extract-concepts")
async def extract_concepts(
    paper_id: str,
    user_id: Optional[str] = Depends(get_current_user_id)
) -> ConceptResponse:
    """
    Re-extract or refresh concepts for a paper using Gemini
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if not paper.content:
        raise HTTPException(status_code=400, detail="Paper content not available")

    try:
        # Extract concepts using Gemini
        concepts_data = await gemini_service.generate_concepts_with_gemini(
            paper.content
        )

        print(f"Raw concepts from Gemini: {len(concepts_data)} concepts")
        for concept in concepts_data:
            print(
                f"   - '{concept.get('name', 'NO_NAME')}': {concept.get('description', 'NO_DESC')[:50]}..."
            )

        # Light filtering - only remove obvious generic/fallback concepts
        valid_concepts_data = []
        for concept_data in concepts_data:
            name = concept_data.get("name", "")
            description = concept_data.get("description", "")

            # Only filter out obvious generic patterns
            is_generic = (
                not name
                or not description
                or len(name) <= 3
                or len(description) <= 10
                or
                # Only catch the most obvious generic patterns
                name.lower().startswith("key concept from")
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

        print(
            f"Concepts refreshed for paper: {paper.title} ({len(paper.concepts)} valid concepts)"
        )
        
        # Save to storage
        if paper.user_id:
            PaperStorage.save_paper(paper, paper.user_id)
        else:
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")

        return ConceptResponse(concepts=paper.concepts, total_count=len(paper.concepts))

    except Exception as e:
        print(f"Concept extraction failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Concept extraction failed: {str(e)}"
        )


@router.post("/papers/{paper_id}/generate-additional-concept")
async def generate_additional_concept(
    paper_id: str,
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Generate ONE additional concept for a paper, considering existing concepts
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    if not paper.content:
        raise HTTPException(status_code=400, detail="Paper content not available")

    try:
        # Get existing concept names to avoid duplicates
        existing_concept_names = [c.name for c in paper.concepts]

        print(
            f"Generating additional concept beyond existing: {existing_concept_names}"
        )

        # Generate ONE additional concept using Gemini
        new_concept_data = await gemini_service.generate_additional_concept_with_gemini(
            content=paper.content, existing_concepts=existing_concept_names
        )

        if new_concept_data:
            name = new_concept_data.get("name", "")
            description = new_concept_data.get("description", "")

            # Filter out generic/fallback concepts
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

            if is_generic:
                print(f"Rejected generic fallback concept: '{name}'")
                return {
                    "success": False,
                    "message": "Generated concept was too generic. Please try again.",
                }

            # Create new concept object
            new_concept = Concept(
                id=str(uuid.uuid4()),
                name=name,
                description=description,
                importance_score=new_concept_data["importance_score"],
                page_numbers=[],
                text_snippets=[],
                related_concepts=[],
                concept_type=new_concept_data.get("concept_type", "conceptual"),
            )

            # Add to existing concepts (don't replace)
            paper.concepts.append(new_concept)
            
            # Save to storage
            if paper.user_id:
                PaperStorage.save_paper(paper, paper.user_id)
            else:
                PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")

            print(f"Generated additional concept: '{new_concept.name}'")

            return {
                "success": True,
                "new_concept": {
                    "id": new_concept.id,
                    "name": new_concept.name,
                    "description": new_concept.description,
                    "importance_score": new_concept.importance_score,
                    "type": new_concept.concept_type,  # Frontend expects "type" not "concept_type"
                },
                "total_concepts": len(paper.concepts),
            }
        else:
            print(f"Failed to generate an additional concept for paper {paper_id}")
            return {
                "success": False,
                "message": "Failed to generate an additional concept.",
            }

    except Exception as e:
        print(f"Additional concept generation failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Additional concept generation failed: {str(e)}"
        )


@router.post(
    "/papers/{paper_id}/concepts/{concept_name}/implement",
)
async def get_code_implementation(
    paper_id: str,
    concept_name: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, str]:
    """
    Generate a Python code implementation for a given concept.
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # Decode URL-encoded concept name
    from urllib.parse import unquote
    decoded_concept_name = unquote(concept_name)
    concept = next((c for c in paper.concepts if c.name == decoded_concept_name), None)
    if not concept:
        raise HTTPException(status_code=404, detail=f"Concept not found: {decoded_concept_name}")

    try:
        gemini_service = GeminiService()
        code = await gemini_service.generate_python_implementation(
            concept.name, concept.description
        )
        
        # Save the generated code to the concept
        concept.code = code
        
        # Save the updated paper with the code
        if paper.user_id:
            PaperStorage.save_paper(paper, paper.user_id)
        else:
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")
        
        print(f"Code generated and saved for concept: {decoded_concept_name}")
        return {"code": code}
    except Exception as e:
        print(f"Code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")


@router.get("/papers/{paper_id}/summary")
async def get_paper_summary(
    paper_id: str,
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """
    Get a comprehensive summary of the paper analysis
    """
    verify_paper_ownership(paper_id, user_id)
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    # Calculate concept importance distribution
    importance_distribution = {
        "high": len([c for c in paper.concepts if c.importance_score >= 0.8]),
        "medium": len([c for c in paper.concepts if 0.6 <= c.importance_score < 0.8]),
        "low": len([c for c in paper.concepts if c.importance_score < 0.6]),
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
                for c in sorted(
                    paper.concepts, key=lambda x: x.importance_score, reverse=True
                )[:3]
            ],
        },
        "insights_count": len(paper.insights),
        "methodology": paper.methodology,
        "analysis_status": paper.analysis_status.value,
        "video_status": paper.video_status.value,
    }
