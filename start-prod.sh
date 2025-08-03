#!/bin/bash

# This script is ONLY for deployment inside a Docker container.

# 1. Start the backend server in the background
echo "==> Starting backend..."
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &

# 2. Build and start the production frontend in the foreground
# The build must happen here because the code is in the container.
# The `npm start` command will keep the container running.
echo "==> Building and starting frontend..."
npm --prefix frontend run build
npm --prefix frontend start