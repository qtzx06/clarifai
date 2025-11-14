import os
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api.endpoints import upload, analysis, video
from .core.config import settings


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, paper_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[paper_id] = websocket

    def disconnect(self, paper_id: str):
        if paper_id in self.active_connections:
            del self.active_connections[paper_id]

    async def send_log(self, paper_id: str, message: str):
        if paper_id in self.active_connections:
            await self.active_connections[paper_id].send_text(message)


app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = ConnectionManager()
video.manager = manager


@app.websocket("/ws/papers/{paper_id}/logs")
async def websocket_endpoint(websocket: WebSocket, paper_id: str):
    await manager.connect(paper_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(paper_id)


# --- THIS IS THE DEFINITIVE PATHING FIX ---
# Mount the 'videos' directory at the top level of the API.
videos_dir = Path("videos")
os.makedirs(videos_dir, exist_ok=True)
app.mount("/api/videos", StaticFiles(directory=videos_dir), name="videos")

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(video.router, prefix="/api", tags=["video"])
