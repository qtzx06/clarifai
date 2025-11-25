FROM python:3.12-slim

# Install system dependencies
# Added: libpq-dev for PostgreSQL/Supabase connection
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    curl \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libpq-dev \
    python3-dev \
    texlive \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend files
COPY requirements.txt agent_requirements.txt ./
COPY app/ ./app/
COPY prompts/ ./prompts/
COPY run_agent.py ./

# Install all dependencies in single Python 3.12 environment
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r agent_requirements.txt

# Create storage directories (for app) and media/videos (for Manim)
RUN mkdir -p storage/videos storage/uploads media/videos videos clips

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
