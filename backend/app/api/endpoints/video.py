"""
Video API endpoints for Manim video generation - REWRITTEN TO MATCH WORKING clarifai-old
"""
import os
import asyncio
import subprocess
import shutil
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path

from ...models.paper import Paper, Concept, VideoStatusResponse, VideoStatus, ConceptVideo
from ...services.gemini_service import GeminiService
from ...services.manim_generator import manim_generator
from ...core.config import settings
from .upload import papers_db  # Import shared papers database

router = APIRouter()

# Initialize services
gemini_service = GeminiService()

class GenerateVideoRequest(BaseModel):
    concept_id: str = ""
    concept_name: str = ""
    quality: str = "medium_quality"
    regenerate: bool = False

class VideoClip(BaseModel):
    type: str = "manim"
    code: str
    voice_over: str = ""

class VideoConfig(BaseModel):
    paper_id: str
    clips: List[VideoClip]
    quality: str

@router.post("/papers/{paper_id}/concepts/{concept_id}/generate-video")
async def generate_video_for_concept(
    paper_id: str,
    concept_id: str,
    background_tasks: BackgroundTasks,
    request: GenerateVideoRequest = GenerateVideoRequest()
) -> Dict[str, str]:
    """
    Generate educational video for a specific concept using Manim - WORKING VERSION
    """
    print(f"🚨 WORKING VIDEO GENERATION: Video endpoint called!")
    print(f"🚨 Paper ID: {paper_id}")
    print(f"🚨 Concept ID: {concept_id}")
    
    if paper_id not in papers_db:
        print(f"🚨 ERROR: Paper {paper_id} not found!")
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    print(f"🚨 Paper found: {paper.title}")
    
    if not paper.concepts:
        print(f"🚨 ERROR: No concepts available!")
        raise HTTPException(status_code=400, detail="No concepts available. Analyze paper first.")
    
    print(f"🚨 Total concepts: {len(paper.concepts)}")
    
    # Find the specific concept (concepts are stored as Pydantic models)
    concept = None
    for c in paper.concepts:
        if c.id == concept_id:
            concept = c
            break
    
    if not concept:
        print(f"🚨 ERROR: Concept {concept_id} not found!")
        raise HTTPException(status_code=404, detail="Concept not found")
    
    print(f"🚨 Concept found: {concept.name}")
    
    # SIMPLIFIED: Only allow ONE video generation at a time per paper
    if paper.video_status == VideoStatus.GENERATING:
        raise HTTPException(
            status_code=400,
            detail="Video generation already in progress. Please wait for current video to complete before generating another."
        )
    
    # Check if any concept is already generating
    any_generating = any(
        cv.status == VideoStatus.GENERATING
        for cv in paper.concept_videos.values()
    )
    
    if any_generating:
        raise HTTPException(
            status_code=400,
            detail="Video generation already in progress. Please wait for current video to complete before generating another."
        )
    
    # Set paper-level status AND create concept entry
    paper.video_status = VideoStatus.GENERATING
    from datetime import datetime
    paper.concept_videos[concept_id] = ConceptVideo(
        concept_id=concept_id,
        concept_name=concept.name,
        status=VideoStatus.GENERATING,
        created_at=datetime.now()
    )
    print(f"🚨 SINGLE VIDEO MODE: Paper and concept status set to GENERATING")
    
    # Start background video generation - CONCEPT-SPECIFIC APPROACH
    quality = request.quality or "medium_quality"
    background_tasks.add_task(generate_video_background, paper_id, concept_id, concept, quality)
    
    return {
        "message": "Video generation started for concept",
        "paper_id": paper_id,
        "concept_id": concept_id,
        "concept_name": concept.name,
        "status": "generating",
        "estimated_time": "45 seconds"
    }

@router.get("/papers/{paper_id}/concepts/{concept_id}/video/status")
async def get_concept_video_status(paper_id: str, concept_id: str) -> Dict[str, Any]:
    """
    Get concept-specific video generation status
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if concept_id not in paper.concept_videos:
        return {
            "paper_id": paper_id,
            "concept_id": concept_id,
            "video_status": "not_started",
            "video_path": None,
            "clips_count": 0,
            "clips_paths": []
        }
    
    concept_video = paper.concept_videos[concept_id]
    return {
        "paper_id": paper_id,
        "concept_id": concept_id,
        "video_status": concept_video.status.value,
        "video_path": concept_video.video_path,
        "clips_count": len(concept_video.clips_paths),
        "clips_paths": concept_video.clips_paths
    }

@router.get("/papers/{paper_id}/video/status")
async def get_video_status(paper_id: str) -> VideoStatusResponse:
    """
    Get video generation status (legacy endpoint)
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    return VideoStatusResponse(
        paper_id=paper_id,
        video_status=paper.video_status.value,
        video_path=paper.video_path,
        clips_count=len(paper.clips_paths) if paper.clips_paths else 0,
        clips_paths=paper.clips_paths or [],
        has_video_config=bool(paper.concepts)
    )

@router.get("/papers/{paper_id}/video/download")
async def download_video(paper_id: str):
    """
    Download the generated video file - WORKING VERSION
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.video_path or not os.path.exists(paper.video_path):
        raise HTTPException(status_code=404, detail="Video not found or not yet generated")
    
    return FileResponse(
        paper.video_path,
        media_type="video/mp4",
        filename=f"{paper.title[:50]}_educational_video.mp4"
    )

async def generate_video_background(paper_id: str, concept_id: str, concept: Concept, quality: str):
    """
    Background task for concept-specific video generation - FIXED VERSION
    """
    try:
        if paper_id not in papers_db:
            return
        
        paper = papers_db[paper_id]
        print(f"🎬 Starting video generation for concept: {concept.name}")
        
        # Ensure concept video entry exists
        if concept_id not in paper.concept_videos:
            from datetime import datetime
            paper.concept_videos[concept_id] = ConceptVideo(
                concept_id=concept_id,
                concept_name=concept.name,
                status=VideoStatus.GENERATING,
                created_at=datetime.now()
            )
        
        concept_video = paper.concept_videos[concept_id]
        
        # Step 1: Generate video configuration using concept - WORKING APPROACH
        video_config = await create_video_config_from_concept(paper_id, concept, quality)
        if not video_config:
            concept_video.status = VideoStatus.FAILED
            return
        
        # Step 2: Generate all clips using Manim - WORKING APPROACH
        clips_data = [{"code": clip.code} for clip in video_config.clips]
        
        clip_paths = await manim_generator.generate_multiple_clips(clips_data, quality)
        
        if not clip_paths:
            print(f"❌ No clips were generated for concept {concept.name}")
            concept_video.status = VideoStatus.FAILED
            return
        
        concept_video.clips_paths = clip_paths
        
        # Step 3: Stitch clips together - CONCEPT-SPECIFIC FILE NAME
        final_video_path = await stitch_clips_simple(f"{paper_id}_{concept_id}", clip_paths)
        
        if final_video_path:
            concept_video.video_path = final_video_path
            concept_video.status = VideoStatus.COMPLETED
            # CRITICAL: Also update paper-level status for frontend polling
            paper.video_status = VideoStatus.COMPLETED
            paper.video_path = final_video_path
            paper.clips_paths = concept_video.clips_paths
            print(f"✅ Successfully generated video for concept {concept.name}: {final_video_path}")
        else:
            concept_video.status = VideoStatus.FAILED
            # CRITICAL: Also update paper-level status
            paper.video_status = VideoStatus.FAILED
            print(f"❌ Failed to stitch clips for concept {concept.name}")
        
    except Exception as e:
        print(f"❌ Error generating video for concept {concept.name}: {e}")
        import traceback
        traceback.print_exc()
        if paper_id in papers_db:
            # Update both concept and paper level status on error
            if concept_id in papers_db[paper_id].concept_videos:
                papers_db[paper_id].concept_videos[concept_id].status = VideoStatus.FAILED
            papers_db[paper_id].video_status = VideoStatus.FAILED

async def create_video_config_from_concept(paper_id: str, concept: Concept, quality: str) -> VideoConfig:
    """
    Create video configuration from single concept - WORKING VERSION
    """
    if paper_id not in papers_db:
        return None
    
    paper = papers_db[paper_id]
    clips = []
    
    try:
        print(f"🎨 Generating Manim code for concept: {concept.name}")
        
        # Generate concept-specific Manim code using GEMINI
        try:
            manim_code = await gemini_service.generate_manim_code_with_gemini(
                concept_name=concept.name,
                concept_description=concept.description,
                paper_title=paper.title
            )
            print(f"🚨 Gemini generated code: {len(manim_code) if manim_code else 0} chars")
        except Exception as e:
            print(f"🚨 Gemini failed: {e}")
            manim_code = None
        
        # Fallback to template ONLY if Gemini fails
        if not manim_code or "class " not in manim_code:
            print(f"🚨 Using template fallback")
            manim_code = manim_generator.create_sample_manim_code(
                concept=concept.name,
                explanation=concept.description
            )
        
        if manim_code:
            clip = VideoClip(
                type="manim",
                code=manim_code,
                voice_over=f"Let's explore {concept.name}. {concept.description[:200]}..."
            )
            clips.append(clip)
            print(f"✅ Generated clip for concept: {concept.name}")
        else:
            print(f"❌ Failed to generate clip for concept: {concept.name}")
    
    except Exception as e:
        print(f"❌ Error generating clip for concept {concept.name}: {e}")
    
    if not clips:
        # Enhanced fallback: create a basic intro clip
        print("Creating basic intro clip...")
        intro_clip = VideoClip(
            type="manim",
            code=f'''
class IntroScene(Scene):
    def construct(self):
        title = Text("{concept.name[:50]}", font_size=36)
        title.to_edge(UP)
        
        subtitle = Text("Educational Explanation", font_size=24)
        subtitle.next_to(title, DOWN, buff=1)
        
        self.play(Write(title))
        self.wait(1)
        self.play(Write(subtitle))
        self.wait(2)
        self.play(FadeOut(title), FadeOut(subtitle))
''',
            voice_over=f"Welcome to this educational explanation of {concept.name}."
        )
        clips.append(intro_clip)
    
    return VideoConfig(
        paper_id=paper_id,
        clips=clips,
        quality=quality
    )

async def stitch_clips_simple(file_prefix: str, clip_paths: List[str]) -> str:
    """
    Simple clip stitching using ffmpeg - EXACT COPY FROM WORKING clarifai-old
    """
    if not clip_paths:
        return None
    
    try:
        output_path = os.path.join(settings.VIDEO_DIR, f"{file_prefix}_final.mp4")
        os.makedirs(settings.VIDEO_DIR, exist_ok=True)
        
        if len(clip_paths) == 1:
            # Single clip, just copy it
            shutil.copy2(clip_paths[0], output_path)
            return output_path
        
        # Multiple clips - create concat file for ffmpeg
        concat_file = os.path.join(settings.VIDEO_DIR, f"{file_prefix}_concat.txt")
        with open(concat_file, 'w') as f:
            for clip_path in clip_paths:
                f.write(f"file '{os.path.abspath(clip_path)}'\n")
        
        # Use ffmpeg to concatenate
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            output_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        # Clean up concat file
        os.remove(concat_file)
        
        if process.returncode == 0 and os.path.exists(output_path):
            print(f"✅ Successfully stitched {len(clip_paths)} clips into {output_path}")
            return output_path
        else:
            print(f"❌ FFmpeg stitching failed: {stderr.decode()}")
            return None
    
    except Exception as e:
        print(f"❌ Error stitching clips: {e}")
        return None

# Keep the original endpoint for backward compatibility
@router.post("/papers/{paper_id}/generate-video")
async def generate_video(
    paper_id: str,
    background_tasks: BackgroundTasks,
    request: GenerateVideoRequest = GenerateVideoRequest()
) -> Dict[str, str]:
    """
    Generate educational video using Manim (full paper - legacy endpoint)
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.concepts:
        raise HTTPException(status_code=400, detail="No concepts available. Analyze paper first.")
    
    if paper.video_status == VideoStatus.GENERATING:
        return {
            "message": "Video generation already in progress",
            "paper_id": paper_id,
            "status": "generating"
        }
    
    # Set video status to generating
    paper.video_status = VideoStatus.GENERATING
    
    # Use first concept for legacy endpoint
    first_concept = paper.concepts[0] if paper.concepts else None
    if first_concept:
        background_tasks.add_task(
            generate_video_background,
            paper_id,
            first_concept.id,
            first_concept,
            request.quality or "medium_quality"
        )
    
    return {
        "message": "Video generation started",
        "paper_id": paper_id,
        "status": "generating",
        "estimated_time": "2-3 minutes"
    }