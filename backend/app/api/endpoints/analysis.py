"""
Analysis endpoints for paper processing and concept extraction
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any
import uuid
import httpx
from datetime import datetime

from ...models.paper import (
    AnalysisRequest, ClarificationRequest, AnalysisStatus,
    ChatRequest, ChatResponse, ChatMessage
)
from ...services.nvidia_service import NVIDIAService
from ...services.anthropic_service import AnthropicService
from ...services.pdf_parser import PDFParser
from .upload import papers_db

router = APIRouter()

@router.post("/test-nvidia")
async def test_nvidia_api(text: str = "This is a test research paper about machine learning algorithms and neural networks. We explore deep learning architectures for image classification.") -> Dict[str, Any]:
    """
    Test NVIDIA API directly with sample text
    """
    try:
        nvidia_service = NVIDIAService()
        
        # Test Nemotron analysis
        print("Testing Nemotron analysis...")
        analysis_result = await nvidia_service.analyze_paper_with_nemotron(text, "Test Paper")
        
        # Test Qwen concept extraction
        print("Testing Qwen concept extraction...")
        concepts_result = await nvidia_service.generate_concepts_with_qwen(text)
        
        return {
            "status": "success",
            "api_key_working": True,
            "nemotron_analysis": analysis_result,
            "qwen_concepts": concepts_result,
            "test_text": text
        }
        
    except Exception as e:
        print(f"NVIDIA API test failed: {e}")
        return {
            "status": "error",
            "api_key_working": False,
            "error": str(e),
            "test_text": text
        }

@router.post("/papers/{paper_id}/analyze")
async def analyze_paper(
    paper_id: str,
    background_tasks: BackgroundTasks,
    request: AnalysisRequest = None
) -> JSONResponse:
    """
    Analyze paper content using NVIDIA models
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if paper.analysis_status == AnalysisStatus.PROCESSING:
        return JSONResponse({
            "message": "Analysis already in progress",
            "paper_id": paper_id,
            "status": "processing"
        })
    
    if not paper.content:
        raise HTTPException(status_code=400, detail="Paper content not available. Upload may still be processing.")
    
    # Start analysis in background
    background_tasks.add_task(analyze_paper_background, paper_id)
    
    # Update status
    paper.analysis_status = AnalysisStatus.PROCESSING
    
    return JSONResponse({
        "message": "Analysis started",
        "paper_id": paper_id,
        "status": "processing"
    })

@router.get("/papers/{paper_id}/concepts")
async def get_paper_concepts(paper_id: str) -> Dict[str, Any]:
    """
    Get extracted concepts from paper
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    return {
        "paper_id": paper_id,
        "title": paper.title,
        "concepts": [concept.dict() for concept in paper.concepts],
        "key_insights": paper.key_insights,
        "analysis_status": paper.analysis_status
    }

@router.post("/papers/{paper_id}/clarify")
async def clarify_text(paper_id: str, request: ClarificationRequest) -> Dict[str, Any]:
    """
    Get clarification for highlighted text using NVIDIA models
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    try:
        anthropic_service = AnthropicService()
        
        # Create context for clarification
        context_parts = []
        context_parts.append(f"Paper Title: {paper.title}")
        
        if paper.abstract:
            context_parts.append(f"Abstract: {paper.abstract[:300]}")
        
        if paper.concepts:
            relevant_concepts = [c for c in paper.concepts if any(word in request.text_snippet.lower()
                                                                for word in c.name.lower().split())][:2]
            if relevant_concepts:
                concepts_text = "\n".join([f"- {c.name}: {c.description[:100]}" for c in relevant_concepts])
                context_parts.append(f"Related Concepts:\n{concepts_text}")
        
        paper_context = "\n\n".join(context_parts)
        
        # Use superior Anthropic Claude for detailed clarification
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "x-api-key": anthropic_service.api_key,
                "content-type": "application/json",
                "anthropic-version": "2023-06-01"
            }
            
            payload = {
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 800,
                "messages": [
                    {
                        "role": "user",
                        "content": f"""You are an expert research assistant helping users understand complex academic papers. Please provide a clear, accessible explanation of a specific text snippet.

Paper Context:
{paper_context}

Text to Explain: "{request.text_snippet}"

{f"Additional Context: {request.context}" if request.context else ""}

Please provide a detailed explanation that:
- Explains technical terms in simple language
- Provides context about why this concept matters in the research
- Uses analogies when helpful to make complex ideas accessible
- Explains the intuition behind mathematical concepts if applicable
- Keeps the explanation thorough but approachable

Your explanation should help someone with general academic background understand this concept clearly."""
                    }
                ]
            }
            
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                explanation = result["content"][0]["text"]
                
                return {
                    "paper_id": paper_id,
                    "original_text": request.text_snippet,
                    "explanation": explanation,
                    "context": request.context,
                    "method": "anthropic_claude"
                }
            else:
                # Fallback explanation if API fails
                fallback_explanation = f"""This text snippet appears in the context of "{paper.title}".
                
                The concept "{request.text_snippet[:50]}..." is a technical aspect discussed in this research paper.
                
                To fully understand this concept, consider:
                - How it relates to the paper's main research question
                - Its role in the methodology or findings
                - Any mathematical or algorithmic significance it might have
                
                For a more detailed explanation, you might want to ask about this concept in the chat section."""
                
                return {
                    "paper_id": paper_id,
                    "original_text": request.text_snippet,
                    "explanation": fallback_explanation,
                    "context": request.context,
                    "method": "fallback"
                }
                
    except Exception as e:
        print(f"Error in clarification endpoint: {e}")
        # Enhanced fallback response
        fallback_explanation = f"""This text snippet from "{paper.title}" contains technical terminology that may require further context.
        
        The highlighted text: "{request.text_snippet[:100]}..." appears to be a key concept in this research.
        
        For a detailed explanation, I recommend:
        1. Reading the surrounding context in the paper
        2. Looking for definitions in the paper's introduction or methodology
        3. Asking specific questions about this concept in the chat section
        
        If this appears to be a mathematical formula or algorithm, it likely relates to the paper's core technical contribution."""
        
        return {
            "paper_id": paper_id,
            "original_text": request.text_snippet,
            "explanation": fallback_explanation,
            "context": request.context,
            "method": "error_fallback"
        }

@router.post("/papers/{paper_id}/chat")
async def chat_with_paper(paper_id: str, request: ChatRequest) -> ChatResponse:
    """
    Interactive Q&A chat about the paper using NVIDIA models
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    try:
        anthropic_service = AnthropicService()
        
        # Create context from paper content and concepts
        context_parts = []
        context_parts.append(f"Paper Title: {paper.title}")
        
        if paper.abstract:
            context_parts.append(f"Abstract: {paper.abstract[:500]}")
        
        if paper.concepts:
            concepts_text = "\n".join([f"- {c.name}: {c.description}" for c in paper.concepts[:3]])
            context_parts.append(f"Key Concepts:\n{concepts_text}")
        
        if paper.key_insights:
            insights_text = "\n".join([f"- {insight}" for insight in paper.key_insights[:3]])
            context_parts.append(f"Key Insights:\n{insights_text}")
        
        paper_context = "\n\n".join(context_parts)
        
        # Use superior Anthropic Claude for contextual responses
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "x-api-key": anthropic_service.api_key,
                "content-type": "application/json",
                "anthropic-version": "2023-06-01"
            }
            
            payload = {
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": f"""You are an expert research assistant helping users understand academic papers. You have deep knowledge of the following research paper:

{paper_context}

User question: {request.message}

Please provide a clear, accurate, and helpful response about this research paper. If the question is outside the paper's scope, acknowledge this and provide what relevant information you can from the paper's content."""
                    }
                ]
            }
            
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result["content"][0]["text"]
                
                # Create response message
                response_message = ChatMessage(
                    id=str(uuid.uuid4()),
                    role="assistant",
                    content=ai_response,
                    timestamp=datetime.now(),
                    paper_id=paper_id
                )
                
                return ChatResponse(
                    message=response_message,
                    paper_id=paper_id,
                    context_used=True
                )
            else:
                # Fallback response if API fails
                fallback_message = ChatMessage(
                    id=str(uuid.uuid4()),
                    role="assistant",
                    content=f"I apologize, but I'm having trouble accessing my analysis capabilities right now. However, I can tell you that this paper is titled '{paper.title}' and appears to be in the {paper.analysis_status} analysis stage.",
                    timestamp=datetime.now(),
                    paper_id=paper_id
                )
                
                return ChatResponse(
                    message=fallback_message,
                    paper_id=paper_id,
                    context_used=False
                )
                
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        # Fallback response
        error_message = ChatMessage(
            id=str(uuid.uuid4()),
            role="assistant",
            content="I'm sorry, I encountered an error while processing your question. Please try again later.",
            timestamp=datetime.now(),
            paper_id=paper_id
        )
        
        return ChatResponse(
            message=error_message,
            paper_id=paper_id,
            context_used=False
        )

@router.get("/papers/{paper_id}/chat/history")
async def get_chat_history(paper_id: str) -> Dict[str, Any]:
    """
    Get chat history for a paper (placeholder for future implementation)
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # For now, return empty history as we're not storing messages
    # This can be extended to store chat history in database
    return {
        "paper_id": paper_id,
        "messages": [],
        "total_messages": 0
    }

async def analyze_paper_background(paper_id: str):
    """
    Background task for comprehensive paper analysis using NVIDIA services
    """
    try:
        if paper_id not in papers_db:
            return
        
        paper = papers_db[paper_id]
        anthropic_service = AnthropicService()
        
        print(f"Starting HIGH-QUALITY analysis with Claude for paper: {paper.title}")
        
        # Step 1: Analyze with Claude for superior quality
        analysis_result = await anthropic_service.analyze_paper_with_claude(
            paper.content,
            paper.title
        )
        
        # Step 2: Extract concepts with Claude for much better concept names
        concepts_result = await anthropic_service.generate_concepts_with_claude(paper.content)
        
        # Step 3: Update paper with results  
        from ...models.paper import Concept
        
        # Convert concepts to Paper model format
        concepts = []
        for i, concept_data in enumerate(concepts_result[:5]):  # Limit to top 5 concepts
            concept = Concept(
                id=f"{paper_id}_concept_{i}",
                name=concept_data.get('name', f'Concept {i+1}'),
                description=concept_data.get('description', ''),
                importance_score=concept_data.get('importance_score', 0.5),
                page_numbers=[1],  # Would be extracted from actual positions
                text_snippets=[concept_data.get('description', '')[:200]],
                related_concepts=[]
            )
            concepts.append(concept)
        
        # Update paper
        paper.concepts = concepts
        paper.key_insights = analysis_result.get('insights', [])
        paper.analysis_status = AnalysisStatus.COMPLETED
        
        print(f"Successfully analyzed paper {paper_id}: Found {len(concepts)} concepts")
        
    except Exception as e:
        print(f"Error analyzing paper {paper_id}: {e}")
        if paper_id in papers_db:
            papers_db[paper_id].analysis_status = AnalysisStatus.FAILED