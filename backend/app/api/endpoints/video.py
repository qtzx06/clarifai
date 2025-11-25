import os
import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from pydantic import BaseModel
from pathlib import Path
from slowapi import Limiter
from slowapi.util import get_remote_address

from ...models.paper import Concept, VideoStatus, ConceptVideo
from ...core.config import settings
from ...core.auth import verify_api_key, get_current_user_id
from ...services.storage import PaperStorage

# Per-user video generation limits
DAILY_VIDEO_LIMIT = 5  # Free tier: 5 videos per day per user
MAX_CONCURRENT_GENERATIONS = 3  # Max 3 videos generating at once per user

# Vercel Blob storage (optional, falls back to local storage)
try:
    from vercel_blob import put
    VERCEL_BLOB_AVAILABLE = True
except ImportError:
    VERCEL_BLOB_AVAILABLE = False

manager = None

router = APIRouter()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


class GenerateVideoRequest(BaseModel):
    concept_id: str = ""


async def run_agent_script(
    paper_id: str, concept_name: str, concept_description: str, output_dir: str
) -> Dict[str, Any]:
    # Calculate paths relative to this file
    # video.py is at: backend/app/api/endpoints/video.py
    # We need to go up to project root: parents[4] = backend/app/api/endpoints -> backend/app/api -> backend/app -> backend -> project_root
    current_file = Path(__file__).resolve()

    # Try to find project root by going up from current file
    project_root = current_file.parents[4]

    # Build a list of candidate backend roots (covers /backend deployments and /app/backend)
    candidate_paths = [
        "/backend",
        "/app/backend",
        "/app",
        os.environ.get("BACKEND_ROOT", ""),
    ]
    candidate_backend_roots = []
    for path_str in candidate_paths:
        if not path_str:
            continue
        candidate_backend_roots.append(Path(path_str))
    candidate_backend_roots.extend(
        [
            project_root / "backend",
            project_root,
        ]
    )

    agent_script_path = None
    python_executable: Any = None

    for backend_root in candidate_backend_roots:
        script_candidate = backend_root / "run_agent.py"
        if script_candidate.exists():
            agent_script_path = script_candidate
            env_python = backend_root / "agent_env" / "bin" / "python"
            if env_python.exists():
                python_executable = env_python
            break

    # If we still haven't found the script, fall back to the original relative path
    if agent_script_path is None:
        agent_script_path = project_root / "backend" / "run_agent.py"

    # Use system python if the virtualenv doesn’t exist
    if python_executable is None or (isinstance(python_executable, Path) and not python_executable.exists()):
        python_executable = "python3"
    
    api_key = settings.GEMINI_API_KEY

    print(f"[VIDEO] API key present: {bool(api_key)}, length: {len(api_key) if api_key else 0}")
    print(f"[VIDEO] Agent script path: {agent_script_path}")
    print(f"[VIDEO] Python executable: {python_executable}")
    print(f"[VIDEO] Output dir: {output_dir}")
    print(f"[VIDEO] Script exists: {agent_script_path.exists()}")
    print(f"[VIDEO] Python exists: {Path(python_executable).exists() if isinstance(python_executable, Path) else True}")

    if not api_key:
        return {
            "success": False,
            "error": "GEMINI_API_KEY not found in backend environment.",
        }

    if not agent_script_path.exists():
        error_msg = f"Agent script not found at {agent_script_path}. Current working directory: {Path.cwd()}"
        print(f"[VIDEO] ERROR: {error_msg}")
        return {
            "success": False,
            "error": error_msg,
            "clip_paths": [],
        }

    cmd = [
        str(python_executable),
        str(agent_script_path),
        concept_name,
        concept_description,
        output_dir,
        api_key,
    ]

    print(f"[VIDEO] Running command: {' '.join([str(cmd[0]), str(cmd[1]), str(cmd[2])[:30], str(cmd[3])[:30], str(cmd[4]), '***API_KEY***'])}")

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(project_root),  # Run from project root to ensure relative paths work
    )
    print(f"[VIDEO] Process started with PID: {process.pid}")

    final_result = None
    successful_clips = []

    # Read stdout and stderr concurrently
    async def read_stdout():
        nonlocal final_result, successful_clips
        async for line in process.stdout:
            decoded_line = line.decode("utf-8").strip()

            # Print to console for debugging
            print(f"Agent output: {decoded_line}")

            if decoded_line.startswith("LOG: "):
                log_message = decoded_line[5:]
                print(f"Sending log via WebSocket: {log_message}")
                if manager:
                    try:
                        await manager.send_log(
                            paper_id, json.dumps({"type": "log", "message": log_message})
                        )
                        print(f"Log sent successfully")
                    except Exception as e:
                        print(f"Error sending log: {e}")
            elif decoded_line.startswith("PROGRESS: "):
                progress_json = decoded_line[10:]
                print(f"Sending progress via WebSocket: {progress_json}")
                if manager:
                    try:
                        await manager.send_log(
                            paper_id, json.dumps({"type": "progress", "data": json.loads(progress_json)})
                        )
                        print(f"Progress sent successfully")
                    except Exception as e:
                        print(f"Error sending progress: {e}")
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

    async def read_stderr():
        stderr_lines = []
        async for line in process.stderr:
            decoded_line = line.decode("utf-8").strip()
            print(f"Agent stderr: {decoded_line}")
            stderr_lines.append(decoded_line)
        return stderr_lines

    # Wait for both stdout and stderr
    stdout_task = asyncio.create_task(read_stdout())
    stderr_task = asyncio.create_task(read_stderr())

    stderr_lines = await asyncio.gather(stdout_task, stderr_task)
    stderr_output = stderr_lines[1]

    await process.wait()
    print(f"[VIDEO] Process exited with code: {process.returncode}")

    if final_result:
        final_result["clip_paths"] = successful_clips
        return final_result

    if stderr_output:
        error_message = f"Agent crashed without a final result. STDERR:\n{'\n'.join(stderr_output)}"
        print(f"[VIDEO] Agent error: {error_message}")
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


async def upload_to_vercel_blob(file_path: str, file_name: str) -> Optional[str]:
    """Upload video to Vercel Blob storage and return the URL"""
    if not VERCEL_BLOB_AVAILABLE:
        print("[BLOB] Vercel Blob SDK not available, skipping upload")
        return None

    blob_token = os.getenv("BLOB_READ_WRITE_TOKEN")
    if not blob_token:
        print("[BLOB] BLOB_READ_WRITE_TOKEN not set, skipping upload")
        return None

    try:
        print(f"[BLOB] Uploading {file_name} to Vercel Blob...")
        with open(file_path, "rb") as f:
            file_data = f.read()

        # Upload to Vercel Blob
        blob = put(
            pathname=file_name,
            body=file_data,
            options={
                "access": "public",
                "token": blob_token,
            }
        )

        print(f"[BLOB] Upload successful: {blob['url']}")
        return blob["url"]
    except Exception as e:
        print(f"[BLOB] Upload failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def generate_video_background(paper_id: str, concept_id: str, concept: Concept):
    # Skip ownership check for background tasks
    paper = PaperStorage.get_paper(paper_id, skip_ownership_check=True)
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

        # In Docker: WORKDIR=/app, so use /app/clips and /app/videos
        # In dev: backend/app/api/endpoints/video.py -> go up to backend/ root
        current_file = Path(__file__).resolve()

        # Try to find backend root
        # From backend/app/api/endpoints/video.py -> backend/app/api/endpoints -> backend/app/api -> backend/app -> backend
        backend_root = current_file.parents[3]

        # In Docker, we might be at /app instead of backend
        if not (backend_root / "app").exists() and Path("/app").exists():
            backend_root = Path("/app")

        clips_dir = backend_root / "clips"
        videos_dir = backend_root / "videos"

        output_dir = clips_dir / f"{paper_id}_{concept_id}"
        os.makedirs(output_dir, exist_ok=True)
        print(f"[VIDEO] Using clips_dir: {clips_dir}, videos_dir: {videos_dir}")

        result = await run_agent_script(
            paper_id, concept.name, concept.description, str(output_dir)
        )

        clip_paths = result.get("clip_paths", [])
        concept_video.captions = result.get("captions", [])

        if not clip_paths:
            await log("Agent did not produce any successful video clips.")
            concept_video.status = VideoStatus.FAILED
            if paper.user_id:
                PaperStorage.save_paper(paper, paper.user_id)
            else:
                PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")
            return

        await log(
            "Agent finished. Stitching " + str(len(clip_paths)) + " successful clips..."
        )

        final_video_path = await stitch_clips_simple(
            f"{paper_id}_{concept_id}", clip_paths, str(videos_dir)
        )

        if final_video_path:
            file_name = os.path.basename(final_video_path)
            print(f"[VIDEO] Final video created at: {final_video_path}")
            print(f"[VIDEO] File exists: {os.path.exists(final_video_path)}")
            print(f"[VIDEO] File size: {os.path.getsize(final_video_path) if os.path.exists(final_video_path) else 'N/A'}")

            # Try to upload to Vercel Blob first
            blob_url = await upload_to_vercel_blob(final_video_path, file_name)

            if blob_url:
                # Use Vercel Blob URL
                accessible_path = blob_url
                await log(f"Video uploaded to Vercel Blob: {blob_url}")
                print(f"[VIDEO] Using Vercel Blob URL: {blob_url}")
            else:
                # Fallback to local storage
                accessible_path = f"/api/videos/{file_name}"
                await log(f"Video available locally: {accessible_path}")
                print(f"[VIDEO] Using local path: {accessible_path}")

            concept_video.video_path = accessible_path
            concept_video.status = VideoStatus.COMPLETED
            if paper.user_id:
                PaperStorage.save_paper(paper, paper.user_id)
            else:
                PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")
        else:
            await log("Stitching failed.")
            concept_video.status = VideoStatus.FAILED
            if paper.user_id:
                PaperStorage.save_paper(paper, paper.user_id)
            else:
                PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")

    except Exception as e:
        await log(f"An unexpected error occurred: {e}")
        concept_video.status = VideoStatus.FAILED
        if paper.user_id:
            PaperStorage.save_paper(paper, paper.user_id)
        else:
            PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")


async def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds using ffprobe"""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            video_path
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode == 0:
            return float(stdout.decode().strip())
    except Exception as e:
        print(f"Error getting video duration: {e}")
    return 0.0


async def stitch_clips_simple(
    file_prefix: str, clip_paths: List[str], videos_dir: str
) -> Optional[str]:
    if not clip_paths:
        return None

    os.makedirs(videos_dir, exist_ok=True)

    # First, concatenate clips without fade
    temp_output_path = os.path.join(videos_dir, f"{file_prefix}_temp.mp4")
    concat_file_path = os.path.join(videos_dir, f"{file_prefix}_concat.txt")

    with open(concat_file_path, "w", encoding="utf-8") as f:
        for path in clip_paths:
            # The agent now returns verified, absolute paths. No modification needed.
            safe_path = str(path).replace("\\", "/").replace("'", "'\\''")
            f.write(f"file '{safe_path}'\n")

    # Step 1: Concatenate clips
    concat_cmd = [
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
        temp_output_path,
    ]

    process = await asyncio.create_subprocess_exec(
        *concat_cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        print("--- FFMPEG CONCATENATION FAILED ---")
        print(f"STDOUT:\n{stdout.decode()}")
        print(f"STDERR:\n{stderr.decode()}")
        if os.path.exists(concat_file_path):
            os.remove(concat_file_path)
        return None

    os.remove(concat_file_path)

    # Step 2: Get video duration and add fade out
    duration = await get_video_duration(temp_output_path)
    fade_duration = 1.0  # Fade out over 1 second
    fade_start = max(0.0, duration - fade_duration)

    if duration > fade_duration:
        # Apply fade out to the final video
        output_path = os.path.join(videos_dir, f"{file_prefix}_final.mp4")
        fade_cmd = [
            "ffmpeg",
            "-y",
            "-i", temp_output_path,
            "-vf", f"fade=t=out:st={fade_start}:d={fade_duration}",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-c:a", "copy",  # Copy audio without re-encoding
            output_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *fade_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            print("--- FFMPEG FADE OUT FAILED ---")
            print(f"STDOUT:\n{stdout.decode()}")
            print(f"STDERR:\n{stderr.decode()}")
            # Fallback: use temp file without fade
            if os.path.exists(temp_output_path):
                os.rename(temp_output_path, output_path)
                return output_path
            return None

        # Clean up temp file
        if os.path.exists(temp_output_path):
            os.remove(temp_output_path)
        
        return output_path
    else:
        # Video too short for fade, just rename temp file
        output_path = os.path.join(videos_dir, f"{file_prefix}_final.mp4")
        if os.path.exists(temp_output_path):
            os.rename(temp_output_path, output_path)
            return output_path
        return None


@router.post("/papers/{paper_id}/concepts/{concept_id}/generate-video")
@limiter.limit("10/hour")
async def generate_video_for_concept(
    request: Request,
    paper_id: str,
    concept_id: str,
    background_tasks: BackgroundTasks,
    video_request: GenerateVideoRequest = GenerateVideoRequest(),
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, str]:
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # Verify ownership if user_id is provided
    # Allow access if paper has no user_id (old papers) or user owns the paper
    if user_id and paper.user_id is not None and paper.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    concept = next((c for c in paper.concepts if c.id == concept_id), None)

    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    # Per-user rate limiting (if user_id is available)
    if user_id:
        daily_count = PaperStorage.count_user_videos_today(user_id)
        if daily_count >= DAILY_VIDEO_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit of {DAILY_VIDEO_LIMIT} video generations reached. Try again tomorrow."
            )
        
        concurrent_count = PaperStorage.count_user_concurrent_videos(user_id)
        if concurrent_count >= MAX_CONCURRENT_GENERATIONS:
            raise HTTPException(
                status_code=429,
                detail=f"You have {MAX_CONCURRENT_GENERATIONS} videos currently generating. Please wait for one to complete."
            )

    # Check if this specific concept already has a video being generated
    existing_video = paper.concept_videos.get(concept_id)
    if existing_video and existing_video.status == VideoStatus.GENERATING:
        raise HTTPException(
            status_code=400, detail="A video is already being generated for this concept."
        )

    paper.concept_videos[concept_id] = ConceptVideo(
        concept_id=concept_id,
        concept_name=concept.name,
        status=VideoStatus.GENERATING,
        created_at=datetime.now(),
    )
    
    # Persist the status change immediately so frontend polling sees it
    if paper.user_id:
        PaperStorage.save_paper(paper, paper.user_id)
    else:
        PaperStorage.save_paper(paper, "00000000-0000-0000-0000-000000000000")
    print(f"[VIDEO] Set video_status to GENERATING for concept {concept_id}, paper {paper_id}")

    background_tasks.add_task(
        generate_video_background,
        paper_id,
        concept_id,
        concept,
    )

    return {"message": "Video generation started"}


@router.get("/papers/{paper_id}/concepts/{concept_id}/video/status")
async def get_concept_video_status(
    paper_id: str,
    concept_id: str,
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    paper = PaperStorage.get_paper(paper_id, user_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    
    # Verify ownership if user_id is provided
    # Allow access if paper has no user_id (old papers) or user owns the paper
    if user_id and paper.user_id is not None and paper.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    concept_video = paper.concept_videos.get(concept_id)

    if not concept_video:
        return {"status": "not_started", "logs": [], "captions": []}

    # Map backend status to frontend expected values
    status_map = {
        "not_started": "not_started",
        "generating": "generating",
        "completed": "completed",
        "failed": "error"
    }

    return {
        "status": status_map.get(concept_video.status.value, "not_started"),
        "video_url": concept_video.video_path,
        "logs": concept_video.logs,
        "captions": concept_video.captions,
    }


@router.get("/usage-stats")
async def get_usage_stats(
    api_key: str = Depends(verify_api_key),
    user_id: Optional[str] = Depends(get_current_user_id)
) -> Dict[str, Any]:
    """Get video generation usage statistics for the current user"""
    if not user_id:
        # Return default stats for unauthenticated users
        return {
            "daily_limit": DAILY_VIDEO_LIMIT,
            "today_count": 0,
            "remaining_today": DAILY_VIDEO_LIMIT,
            "currently_generating": 0,
            "max_concurrent": MAX_CONCURRENT_GENERATIONS,
        }
    
    today_count = PaperStorage.count_user_videos_today(user_id)
    concurrent_count = PaperStorage.count_user_concurrent_videos(user_id)
    
    return {
        "daily_limit": DAILY_VIDEO_LIMIT,
        "today_count": today_count,
        "remaining_today": max(0, DAILY_VIDEO_LIMIT - today_count),
        "currently_generating": concurrent_count,
        "max_concurrent": MAX_CONCURRENT_GENERATIONS,
    }
