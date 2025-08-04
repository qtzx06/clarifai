import os
import asyncio
import subprocess
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path

from ...models.paper import Paper, Concept, VideoStatusResponse, VideoStatus, ConceptVideo
from ...core.config import settings
from .upload import papers_db

router = APIRouter()

class GenerateVideoRequest(BaseModel):
    concept_id: str = ""
    concept_name: str = ""
    quality: str = "medium_quality"
    regenerate: bool = False

async def run_agent_script(concept_description: str, output_path: str) -> Dict[str, Any]:
    # Paths are now relative to the 'backend' directory where uvicorn is run
    agent_script_path = "run_agent.py"
    python_executable = "agent_env/bin/python"

    cmd = [
        python_executable,
        agent_script_path,
        concept_description,
        output_path,
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if stderr:
        print(f"Agent script error: {stderr.decode()}")

    try:
        return json.loads(stdout.decode())
    except json.JSONDecodeError:
        return {"success": False, "error": "Failed to decode agent response"}

async def generate_video_background(paper_id: str, concept_id: str, concept: Concept, quality: str):
    paper = papers_db.get(paper_id)
    if not paper:
        return

    concept_video = paper.concept_videos.get(concept_id)
    if not concept_video:
        return

    def log(message: str):
        print(message)
        concept_video.logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    try:
        log("Starting agentic video generation process.")
        
        output_dir = os.path.join(settings.CLIPS_DIR, f"{paper_id}_{concept_id}")
        os.makedirs(output_dir, exist_ok=True)

        sentences = [s.strip() for s in concept.description.split('.') if s.strip()]
        clip_paths = []

        for i, sentence in enumerate(sentences):
            log(f"Generating clip {i+1}/{len(sentences)}: {sentence}")
            output_path = os.path.join(output_dir, f"clip_{i}.mp4")
            result = await run_agent_script(sentence, output_path)
            
            concept_video.logs.extend(result.get("logs", []))

            if result.get("success"):
                log(f"Clip {i+1} generated successfully.")
                clip_paths.append(result["output_path"])
            else:
                log(f"Failed to generate clip {i+1}. Aborting.")
                concept_video.status = VideoStatus.FAILED
                return

        log("Stitching clips together...")
        final_video_path = await stitch_clips_simple(f"{paper_id}_{concept_id}", clip_paths)

        if final_video_path:
            log(f"Video successfully stitched: {final_video_path}")
            concept_video.video_path = final_video_path
            concept_video.status = VideoStatus.COMPLETED
        else:
            log("Stitching failed.")
            concept_video.status = VideoStatus.FAILED

    except Exception as e:
        log(f"An unexpected error occurred: {e}")
        concept_video.status = VideoStatus.FAILED

async def stitch_clips_simple(file_prefix: str, clip_paths: List[str]) -> Optional[str]:
    if not clip_paths:
        return None
    
    output_path = os.path.join(settings.VIDEO_DIR, f"{file_prefix}_final.mp4")
    concat_file = os.path.join(settings.VIDEO_DIR, f"{file_prefix}_concat.txt")

    with open(concat_file, "w") as f:
        for path in clip_paths:
            f.write(f"file '{os.path.abspath(path)}'\n")

    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path,
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await process.communicate()

    os.remove(concat_file)

    return output_path if process.returncode == 0 else None

@router.post("/papers/{paper_id}/concepts/{concept_id}/generate-video")
async def generate_video_for_concept(
    paper_id: str,
    concept_id: str,
    background_tasks: BackgroundTasks,
    request: GenerateVideoRequest = GenerateVideoRequest()
) -> Dict[str, str]:
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]
    concept = next((c for c in paper.concepts if c.id == concept_id), None)

    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    if any(cv.status == VideoStatus.GENERATING for cv in paper.concept_videos.values()):
        raise HTTPException(status_code=400, detail="A video is already being generated.")

    paper.concept_videos[concept_id] = ConceptVideo(
        concept_id=concept_id,
        concept_name=concept.name,
        status=VideoStatus.GENERATING,
        created_at=datetime.now(),
    )

    background_tasks.add_task(
        generate_video_background,
        paper_id,
        concept_id,
        concept,
        request.quality or "medium_quality"
    )

    return {"message": "Video generation started"}

@router.get("/papers/{paper_id}/concepts/{concept_id}/video/status")
async def get_concept_video_status(paper_id: str, concept_id: str) -> Dict[str, Any]:
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    paper = papers_db[paper_id]
    concept_video = paper.concept_videos.get(concept_id)

    if not concept_video:
        return {"video_status": "not_started"}

    return {
        "video_status": concept_video.status.value,
        "video_path": concept_video.video_path,
        "logs": concept_video.logs,
    }
