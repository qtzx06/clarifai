#!/bin/bash
set -e
set -o pipefail

echo "Starting Clarifai Setup"
echo "======================="

echo "--- Setting up agent environment ---"
AGENT_PYTHON_VERSION="3.12.4"
if ! pyenv versions --bare | grep -q "^${AGENT_PYTHON_VERSION}$"; then
    echo "Installing Python ${AGENT_PYTHON_VERSION}..."
    pyenv install ${AGENT_PYTHON_VERSION}
fi

AGENT_ENV_DIR="backend/agent_env"
AGENT_PYTHON_EXEC="$(pyenv root)/versions/${AGENT_PYTHON_VERSION}/bin/python3"

echo "Recreating agent virtual environment..."
rm -rf "$AGENT_ENV_DIR"
"$AGENT_PYTHON_EXEC" -m venv "$AGENT_ENV_DIR"

echo "Installing agent dependencies..."
"$AGENT_ENV_DIR/bin/pip" install -r backend/agent_requirements.txt

echo "--- Setting up main backend environment ---"
cd backend
if [ ! -d "venv" ]; then
    echo "Creating main virtual environment..."
    python3 -m venv venv
fi
echo "Installing main backend dependencies..."
./venv/bin/pip install -r requirements.txt
cd ..

echo "--- Setting up frontend environment ---"
cd frontend
echo "Installing Node.js dependencies..."
npm install
cd ..

echo "--- Starting Servers ---"
cd backend
nohup ./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
echo $! > ../backend.pid
cd ..

cd frontend
nohup npm run dev > ../frontend.log 2>&1 &
echo $! > ../frontend.pid
cd ..

echo ""
echo "Setup complete. Servers are starting."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"