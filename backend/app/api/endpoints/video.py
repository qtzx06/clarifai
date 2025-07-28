"""
Video generation endpoints using Manim
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any, List
import os
import asyncio

from ...models.paper import VideoGenerationRequest, VideoStatus, VideoClip, VideoConfig
from ...services.manim_generator import ManimGenerator
from ...services.anthropic_service import AnthropicService
from ...core.config import settings
from .upload import papers_db

router = APIRouter()

@router.post("/papers/{paper_id}/generate-video")
async def generate_video(
    paper_id: str,
    background_tasks: BackgroundTasks,
    request: VideoGenerationRequest = None
) -> JSONResponse:
    """
    Generate educational video from paper concepts using Manim
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.concepts:
        raise HTTPException(status_code=400, detail="Paper must be analyzed before video generation")
    
    if paper.video_status == VideoStatus.GENERATING:
        return JSONResponse({
            "message": "Video generation already in progress",
            "paper_id": paper_id,
            "status": "generating"
        })
    
    # Start video generation in background
    quality = request.quality if request else "medium_quality"
    regenerate = request.regenerate if request else False
    
    background_tasks.add_task(generate_video_background, paper_id, quality, regenerate)
    
    # Update status
    paper.video_status = VideoStatus.GENERATING
    
    return JSONResponse({
        "message": "Video generation started",
        "paper_id": paper_id,
        "status": "generating",
        "quality": quality
    })

@router.get("/papers/{paper_id}/video/status")
async def get_video_status(paper_id: str) -> Dict[str, Any]:
    """
    Get video generation status
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    return {
        "paper_id": paper_id,
        "video_status": paper.video_status,
        "video_path": paper.video_path,
        "clips_count": len(paper.clips_paths),
        "clips_paths": paper.clips_paths,
        "has_video_config": paper.video_config is not None
    }

@router.get("/papers/{paper_id}/video/download")
async def download_video(paper_id: str):
    """
    Download the generated video file
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

@router.get("/papers/{paper_id}/video/config")
async def get_video_config(paper_id: str) -> Dict[str, Any]:
    """
    Get the video configuration for the paper
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.video_config:
        raise HTTPException(status_code=404, detail="Video configuration not generated")
    
    return {
        "paper_id": paper_id,
        "video_config": paper.video_config.dict(),
        "clips_count": len(paper.video_config.clips)
    }

@router.post("/papers/{paper_id}/video/regenerate-clip/{clip_index}")
async def regenerate_clip(
    paper_id: str,
    clip_index: int,
    background_tasks: BackgroundTasks
) -> JSONResponse:
    """
    Regenerate a specific clip
    """
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    
    if not paper.video_config or clip_index >= len(paper.video_config.clips):
        raise HTTPException(status_code=400, detail="Invalid clip index")
    
    background_tasks.add_task(regenerate_single_clip, paper_id, clip_index)
    
    return JSONResponse({
        "message": f"Regenerating clip {clip_index}",
        "paper_id": paper_id,
        "clip_index": clip_index
    })

async def generate_video_background(paper_id: str, quality: str, regenerate: bool):
    """
    Background task for video generation
    """
    try:
        if paper_id not in papers_db:
            return
        
        paper = papers_db[paper_id]
        print(f"Starting video generation for paper: {paper.title}")
        
        # Step 1: Generate video configuration using concepts
        video_config = await create_video_config_from_concepts(paper_id, quality)
        if not video_config:
            paper.video_status = VideoStatus.FAILED
            return
        
        paper.video_config = video_config
        
        # Step 2: Generate all clips using Manim
        manim_generator = ManimGenerator()
        clips_data = [{"code": clip.code} for clip in video_config.clips]
        
        clip_paths = await manim_generator.generate_multiple_clips(clips_data, quality)
        
        if not clip_paths:
            print(f"No clips were generated for paper {paper_id}")
            paper.video_status = VideoStatus.FAILED
            return
        
        paper.clips_paths = clip_paths
        
        # Step 3: Stitch clips together (simplified version)
        final_video_path = await stitch_clips_simple(paper_id, clip_paths)
        
        if final_video_path:
            paper.video_path = final_video_path
            paper.video_status = VideoStatus.COMPLETED
            print(f"Successfully generated video for paper {paper_id}: {final_video_path}")
        else:
            paper.video_status = VideoStatus.FAILED
            print(f"Failed to stitch clips for paper {paper_id}")
        
    except Exception as e:
        print(f"Error generating video for paper {paper_id}: {e}")
        if paper_id in papers_db:
            papers_db[paper_id].video_status = VideoStatus.FAILED

async def create_video_config_from_concepts(paper_id: str, quality: str) -> VideoConfig:
    """
    Create video configuration from paper concepts using superior Anthropic Claude
    """
    if paper_id not in papers_db:
        return None
    
    paper = papers_db[paper_id]
    anthropic_service = AnthropicService()
    
    clips = []
    
    # Generate clips for top concepts using Claude's superior code generation
    for i, concept in enumerate(paper.concepts[:3]):  # Limit to top 3 concepts for demo
        try:
            print(f"Generating HIGH-QUALITY Manim code for concept: {concept.name}")
            
            # Generate superior Manim code with Claude
            manim_code = await anthropic_service.generate_manim_code_with_claude(
                concept.name,
                concept.description,
                paper.title
            )
            
            if manim_code:
                clip = VideoClip(
                    type="manim",
                    code=manim_code,
                    voice_over=f"Let's explore {concept.name}. {concept.description[:200]}..."
                )
                clips.append(clip)
                print(f"✓ Generated HIGH-QUALITY clip {i} for concept: {concept.name}")
            else:
                print(f"✗ Failed to generate clip for concept: {concept.name}")
        
        except Exception as e:
            print(f"✗ Error generating clip for concept {concept.name}: {e}")
    
    if not clips:
        # Enhanced fallback: create a high-quality intro clip using Claude
        print("Creating enhanced intro clip with Claude...")
        try:
            intro_code = await anthropic_service.generate_intro_manim_code(paper.title, paper.abstract or "")
            intro_clip = VideoClip(
                type="manim",
                code=intro_code,
                voice_over=f"Welcome to this educational video about {paper.title}. We'll explore the key concepts presented in this research."
            )
            clips.append(intro_clip)
            print("✓ Generated enhanced intro clip with Claude")
        except Exception as e:
            print(f"✗ Failed to generate intro with Claude, using basic fallback: {e}")
            # Basic fallback if Claude fails
            intro_clip = VideoClip(
                type="manim",
                code=f'''
class IntroScene(Scene):
    def construct(self):
        title = Text("{paper.title[:50]}...", font_size=36)
        title.to_edge(UP)
        
        subtitle = Text("Key Concepts Explained", font_size=24)
        subtitle.next_to(title, DOWN, buff=1)
        
        self.play(Write(title))
        self.wait(1)
        self.play(Write(subtitle))
        self.wait(2)
        self.play(FadeOut(title), FadeOut(subtitle))
''',
                voice_over=f"Welcome to this educational video about {paper.title}. We'll explore the key concepts presented in this research."
            )
            clips.append(intro_clip)
    
    return VideoConfig(
        paper_id=paper_id,
        clips=clips,
        quality=quality
    )

async def stitch_clips_simple(paper_id: str, clip_paths: List[str]) -> str:
    """
    Simple clip stitching using ffmpeg (fallback when MoviePy isn't available)
    """
    if not clip_paths:
        return None
    
    try:
        output_path = os.path.join(settings.VIDEO_DIR, f"{paper_id}_final.mp4")
        os.makedirs(settings.VIDEO_DIR, exist_ok=True)
        
        if len(clip_paths) == 1:
            # Single clip, just copy it
            import shutil
            shutil.copy2(clip_paths[0], output_path)
            return output_path
        
        # Multiple clips - create concat file for ffmpeg
        concat_file = os.path.join(settings.VIDEO_DIR, f"{paper_id}_concat.txt")
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
            print(f"Successfully stitched {len(clip_paths)} clips into {output_path}")
            return output_path
        else:
            print(f"FFmpeg stitching failed: {stderr.decode()}")
            return None
    
    except Exception as e:
        print(f"Error stitching clips: {e}")
        return None

async def regenerate_single_clip(paper_id: str, clip_index: int):
    """
    Regenerate a single clip
    """
    try:
        if paper_id not in papers_db:
            return
        
        paper = papers_db[paper_id]
        if not paper.video_config or clip_index >= len(paper.video_config.clips):
            return
        
        clip = paper.video_config.clips[clip_index]
        manim_generator = ManimGenerator()
        
        clip_name = f"clip_{clip_index:03d}_regen"
        new_clip_path = await manim_generator.generate_manim_video(
            clip.code,
            clip_name,
            paper.video_config.quality
        )
        
        if new_clip_path and clip_index < len(paper.clips_paths):
            paper.clips_paths[clip_index] = new_clip_path
            print(f"Successfully regenerated clip {clip_index} for paper {paper_id}")
    
    except Exception as e:
        print(f"Error regenerating clip {clip_index} for paper {paper_id}: {e}")