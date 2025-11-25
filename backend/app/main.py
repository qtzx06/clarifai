import os
import json
import asyncio
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .api.endpoints import upload, analysis, video
from .core.config import settings


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, paper_id: str, websocket: WebSocket):
        await websocket.accept()
        # If there's already a connection for this paper, close it first
        if paper_id in self.active_connections:
            try:
                old_ws = self.active_connections[paper_id]
                await old_ws.close()
            except:
                pass
        self.active_connections[paper_id] = websocket
        print(f"ConnectionManager: Connected paper {paper_id}, total connections: {len(self.active_connections)}")

    def disconnect(self, paper_id: str):
        if paper_id in self.active_connections:
            del self.active_connections[paper_id]
            print(f"ConnectionManager: Disconnected paper {paper_id}, remaining connections: {len(self.active_connections)}")

    async def send_log(self, paper_id: str, message: str):
        if paper_id in self.active_connections:
            try:
                ws = self.active_connections[paper_id]
                await ws.send_text(message)
            except Exception as e:
                print(f"Error sending log to {paper_id}: {e}")
                # Don't remove connection on error - let it retry


app = FastAPI()

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/hour"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - use settings for proper origin parsing
# Parse ALLOWED_ORIGINS from environment variable (supports JSON arrays or comma-separated)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", settings.ALLOWED_ORIGINS)
if not allowed_origins_env:
    allowed_origins_env = "http://localhost:3000,http://localhost:8000"

# Try to parse as JSON first (in case it's stored as JSON string)
try:
    import json
    if allowed_origins_env.strip().startswith("["):
        allowed_origins = json.loads(allowed_origins_env)
    else:
        # Split by comma
        allowed_origins = [origin.strip().strip('"').strip("'") for origin in allowed_origins_env.split(",") if origin.strip()]
except (json.JSONDecodeError, ValueError):
    # Fallback to comma-separated
    allowed_origins = [origin.strip().strip('"').strip("'") for origin in allowed_origins_env.split(",") if origin.strip()]

if not allowed_origins:
    allowed_origins = ["*"]  # Allow all in development if not set

print(f"[CORS] Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

manager = ConnectionManager()
video.manager = manager


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker healthcheck"""
    return {"status": "healthy"}


@app.get("/debug/videos")
async def debug_videos():
    """Debug endpoint to list videos directory contents"""
    try:
        files = list(videos_dir.glob("*"))
        return {
            "videos_dir": str(videos_dir),
            "exists": videos_dir.exists(),
            "files": [{"name": f.name, "size": f.stat().st_size, "path": str(f)} for f in files if f.is_file()],
            "total_files": len([f for f in files if f.is_file()])
        }
    except Exception as e:
        return {"error": str(e), "videos_dir": str(videos_dir)}


@app.websocket("/ws/papers/{paper_id}/logs")
async def websocket_endpoint(websocket: WebSocket, paper_id: str):
    await manager.connect(paper_id, websocket)
    print(f"WebSocket connected for paper {paper_id}")
    try:
        # Send initial connection message
        await websocket.send_text(json.dumps({"type": "connected", "message": "Connected to logs"}))
        
        # Keep connection alive - just wait for disconnection
        # Don't require client to send messages, just keep the connection open
        # The manager will send logs as they come in from the agent
        while True:
            try:
                # Wait for client disconnect or a message (but don't require messages)
                # Use a long timeout so we can keep the connection open
                data = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)
                # If client sends "ping", respond with "pong"
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                # Connection is still alive, just send a keepalive and continue
                try:
                    await websocket.send_text(json.dumps({"type": "keepalive"}))
                except Exception as e:
                    print(f"Error sending keepalive, connection likely closed: {e}")
                    break
            except WebSocketDisconnect:
                print(f"WebSocket disconnected for paper {paper_id}")
                break
    except Exception as e:
        print(f"WebSocket error for paper {paper_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        manager.disconnect(paper_id)
        print(f"WebSocket cleaned up for paper {paper_id}")


# --- THIS IS THE DEFINITIVE PATHING FIX ---
# Mount the actual backend/videos directory (not app/videos) for download links.
# In Docker: WORKDIR=/app, so videos are at /app/videos
# In dev: working from backend/, so videos are at backend/videos
backend_root = Path(__file__).resolve().parents[1]
videos_dir = backend_root / "videos"

# Fallback: if we're in Docker and videos_dir doesn't resolve correctly,
# try checking if we're in /app (Docker WORKDIR)
if not videos_dir.exists():
    docker_videos_dir = Path("/app/videos")
    if docker_videos_dir.exists():
        videos_dir = docker_videos_dir

os.makedirs(videos_dir, exist_ok=True)
print(f"[MAIN] Mounting videos directory: {videos_dir}")
app.mount("/api/videos", StaticFiles(directory=str(videos_dir)), name="videos")

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(video.router, prefix="/api", tags=["video"])
