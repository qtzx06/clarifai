import os
import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from pathlib import Path

from ...models.paper import Concept, VideoStatus, ConceptVideo
from ...core.config import settings
from .upload import papers_db

manager = None

router = APIRouter()


class GenerateVideoRequest(BaseModel):
    concept_id: str = ""


async def run_agent_script(
    paper_id: str, concept_name: str, concept_description: str, output_dir: str
) -> Dict[str, Any]:
    project_root = Path(__file__).resolve().parents[4]
    agent_script_path = project_root / "backend/run_agent.py"
    python_executable = project_root / "backend/agent_env/bin/python"
    api_key = settings.GEMINI_API_KEY

    if not api_key:
        return {
            "success": False,
            "error": "GEMINI_API_KEY not found in backend environment.",
        }

    cmd = [
        str(python_executable),
        str(agent_script_path),
        concept_name,
        concept_description,
        output_dir,
        api_key,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    final_result = None
    successful_clips = []

    async for line in process.stdout:
        decoded_line = line.decode("utf-8").strip()

        if decoded_line.startswith("LOG: "):
            log_message = decoded_line[5:]
            if manager:
                await manager.send_log(
                    paper_id, json.dumps({"type": "log", "message": log_message})
                )
        elif decoded_line.startswith("CLIP_SUCCESS: "):
            clip_path = decoded_line[14:]
            successful_clips.append(clip_path)
        elif decoded_line.startswith("FINAL_RESULT: "):
            result_json = decoded_line[14:]
            try:
                final_result = json.loads(result_json)
            except json.JSONDecodeError:
                final_result = {
                    "success": False,
                    "error": "Failed to decode agent's final result.",
                }

    await process.wait()

    if final_result:
        final_result["clip_paths"] = successful_clips
        return final_result

    stderr_output = await process.stderr.read()
    if stderr_output:
        error_message = (
            f"Agent crashed without a final result. STDERR:\n{stderr_output.decode()}"
        )
        if manager:
            await manager.send_log(
                paper_id, json.dumps({"type": "log", "message": error_message})
            )
        return {
            "success": False,
            "error": error_message,
            "clip_paths": successful_clips,
        }

    return {
        "success": False,
        "error": "Agent finished without providing a result.",
        "clip_paths": successful_clips,
    }


async def generate_video_background(paper_id: str, concept_id: str, concept: Concept):
    paper = papers_db.get(paper_id)
    if not paper:
        return
    concept_video = paper.concept_videos.get(concept_id)
    if not concept_video:
        return

    async def log(message: str):
        print(message)
        log_entry = f"[{datetime.now().strftime('%H:%M:%S')}] {message}"
        concept_video.logs.append(log_entry)
        if manager:
            await manager.send_log(
                paper_id, json.dumps({"type": "log", "message": log_entry})
            )

    try:
        await log("Handing off to agent for video generation...")

        project_root = Path(__file__).resolve().parents[4]
        clips_dir = project_root / "backend/clips"
        videos_dir = project_root / "backend/videos"

        output_dir = clips_dir / f"{paper_id}_{concept_id}"
        os.makedirs(output_dir, exist_ok=True)

        result = await run_agent_script(
            paper_id, concept.name, concept.description, str(output_dir)
        )

        clip_paths = result.get("clip_paths", [])

        if not clip_paths:
            await log("Agent did not produce any successful video clips.")
            concept_video.status = VideoStatus.FAILED
            return

        await log(
            "Agent finished. Stitching " + str(len(clip_paths)) + " successful clips..."
        )

        final_video_path = await stitch_clips_simple(
            f"{paper_id}_{concept_id}", clip_paths, str(videos_dir)
        )

        if final_video_path:
            file_name = os.path.basename(final_video_path)
            accessible_path = f"/api/videos/{file_name}"
            await log(f"Video successfully stitched: {accessible_path}")
            concept_video.video_path = accessible_path
            concept_video.status = VideoStatus.COMPLETED
        else:
            await log("Stitching failed.")
            concept_video.status = VideoStatus.FAILED

    except Exception as e:
        await log(f"An unexpected error occurred: {e}")
        concept_video.status = VideoStatus.FAILED


async def stitch_clips_simple(
    file_prefix: str, clip_paths: List[str], videos_dir: str
) -> Optional[str]:
    if not clip_paths:
        return None

    os.makedirs(videos_dir, exist_ok=True)

    output_path = os.path.join(videos_dir, f"{file_prefix}_final.mp4")
    concat_file_path = os.path.join(videos_dir, f"{file_prefix}_concat.txt")

    with open(concat_file_path, "w", encoding="utf-8") as f:
        for path in clip_paths:
            # The agent now returns verified, absolute paths. No modification needed.
            safe_path = str(path).replace("\\", "/").replace("'", "'\\''")
            f.write(f"file '{safe_path}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_file_path,
        "-c",
        "copy",
        output_path,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        print("--- FFMPEG STITCHING FAILED ---")
        print(f"STDOUT:\n{stdout.decode()}")
        print(f"STDERR:\n{stderr.decode()}")
        return None

    os.remove(concat_file_path)
    return output_path


@router.post("/papers/{paper_id}/concepts/{concept_id}/generate-video")
async def generate_video_for_concept(
    paper_id: str,
    concept_id: str,
    background_tasks: BackgroundTasks,
    request: GenerateVideoRequest = GenerateVideoRequest(),
) -> Dict[str, str]:
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]
    concept = next((c for c in paper.concepts if c.id == concept_id), None)

    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    if any(cv.status == VideoStatus.GENERATING for cv in paper.concept_videos.values()):
        raise HTTPException(
            status_code=400, detail="A video is already being generated for this paper."
        )

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
    )

    return {"message": "Video generation started"}


@router.get("/papers/{paper_id}/concepts/{concept_id}/video/status")
async def get_concept_video_status(paper_id: str, concept_id: str) -> Dict[str, Any]:
    if paper_id not in papers_db:
        raise HTTPException(status_code=404, detail="Paper not found")

    paper = papers_db[paper_id]
    concept_video = paper.concept_videos.get(concept_id)

    if not concept_video:
        return {"video_status": "not_started", "logs": []}

    return {
        "video_status": concept_video.status.value,
        "video_path": concept_video.video_path,
        "logs": concept_video.logs,
    }
