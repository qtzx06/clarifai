# Use a base image with Node.js and Python
FROM node:18-slim as builder

# 1. --- Build the Frontend ---
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2. --- Setup the Backend ---
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for Manim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    texlive-full \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies and install them
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the built frontend from the first stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Copy the backend code and startup script
COPY start-prod.sh ./start-prod.sh
RUN chmod +x ./start-prod.sh
CMD ["./start-prod.sh"]

# 3. --- Run Everything ---
EXPOSE 3000
CMD ["./start.sh"]