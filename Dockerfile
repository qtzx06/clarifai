# Multi-stage Dockerfile for Clarifai Video Generation System
FROM ubuntu:22.04 as base

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Python and build tools
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    # Video processing
    ffmpeg \
    # LaTeX for mathematical rendering
    texlive \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-science \
    texlive-pictures \
    texlive-latex-recommended \
    # Additional utilities
    curl \
    wget \
    git \
    # Node.js for frontend
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Backend setup
COPY backend/requirements.txt ./backend/
RUN python3.11 -m venv backend/venv && \
    . backend/venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Frontend setup
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --only=production

# Copy frontend code
COPY frontend/ ./

# Build frontend
RUN npm run build

# Back to app root
WORKDIR /app

# Copy startup scripts
COPY start.sh ./
COPY install_dependencies.sh ./
RUN chmod +x start.sh install_dependencies.sh

# Create directories for uploads and clips
RUN mkdir -p backend/storage backend/clips backend/videos

# Expose ports
EXPOSE 3000 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Default command
CMD ["./start.sh"]