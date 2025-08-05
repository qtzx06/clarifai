from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .api.endpoints import upload, analysis, video
from .core.config import settings
import json

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
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

manager = ConnectionManager()

# WebSocket endpoint
@app.websocket("/ws/papers/{paper_id}/logs")
async def websocket_endpoint(websocket: WebSocket, paper_id: str):
    await manager.connect(paper_id, websocket)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(paper_id)

# Pass the connection manager to the video endpoint
video.manager = manager

# Include API routers
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(video.router, prefix="/api", tags=["video"])
