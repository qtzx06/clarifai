FROM python:3.13-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    python3.12 \
    python3.12-venv \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend files
COPY requirements.txt agent_requirements.txt ./
COPY app/ ./app/
COPY prompts/ ./prompts/
COPY run_agent.py ./

# Install main backend dependencies (Python 3.13)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create Python 3.12 virtual environment for agent
RUN python3.12 -m venv /app/agent_venv && \
    /app/agent_venv/bin/pip install --upgrade pip && \
    /app/agent_venv/bin/pip install --no-cache-dir -r agent_requirements.txt

# Create storage directories
RUN mkdir -p storage/videos storage/uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
