#!/bin/bash
set -e
set -o pipefail

# --- Colors for output ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

printf "%b\n" "${BLUE}Starting Clarifai - Research Paper Analysis Tool${NC}"
printf "%b\n" "================================================="

# --- Function to check if command exists ---
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# --- Dependency Checks ---
printf "\n%b\n" "${BLUE}Checking dependencies...${NC}"
if ! command_exists pyenv; then
    printf "%b\n" "${RED}Error: pyenv is not installed. Please install it to continue.${NC}"
    printf "%b\n" "${YELLOW}See installation instructions at https://github.com/pyenv/pyenv#installation${NC}"
    exit 1
fi
if ! command_exists node; then
    printf "%b\n" "${RED}Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi
if ! command_exists npm; then
    printf "%b\n" "${RED}npm is not installed. Please install npm${NC}"
    exit 1
fi
printf "%b\n" "${GREEN}Dependencies check passed.${NC}"

# --- Agent Environment Setup ---
printf "\n%b\n" "${BLUE}Setting up agent environment...${NC}"
AGENT_PYTHON_VERSION="3.12.4"

if ! pyenv versions --bare | grep -q "^${AGENT_PYTHON_VERSION}$"; then
    printf "%b\n" "${YELLOW}Python ${AGENT_PYTHON_VERSION} not found. Attempting to install with pyenv...${NC}"
    pyenv install ${AGENT_PYTHON_VERSION}
    printf "%b\n" "${GREEN}Python ${AGENT_PYTHON_VERSION} installed successfully.${NC}"
fi

AGENT_ENV_DIR="backend/agent_env"
AGENT_PYTHON_EXEC="$(pyenv root)/versions/${AGENT_PYTHON_VERSION}/bin/python3"

printf "%b\n" "${YELLOW}Ensuring a clean environment by removing old agent directory...${NC}"
rm -rf "$AGENT_ENV_DIR"

printf "%b\n" "${YELLOW}Creating new agent virtual environment in ${AGENT_ENV_DIR}...${NC}"
"$AGENT_PYTHON_EXEC" -m venv "$AGENT_ENV_DIR"

AGENT_PIP_EXEC="$AGENT_ENV_DIR/bin/pip"
if [ ! -f "$AGENT_PIP_EXEC" ]; then
    printf "%b\n" "${RED}FATAL ERROR: pip executable not found at ${AGENT_PIP_EXEC} after creating virtual environment.${NC}"
    exit 1
fi

printf "%b\n" "${YELLOW}Installing agent dependencies from backend/agent_requirements.txt...${NC}"
"$AGENT_PIP_EXEC" install -r backend/agent_requirements.txt
printf "%b\n" "${GREEN}Agent environment setup complete.${NC}"

# --- Backend Setup ---
printf "\n%b\n" "${BLUE}Setting up backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    printf "%b\n" "${YELLOW}Creating main backend virtual environment...${NC}"
    python3 -m venv venv
fi

printf "%b\n" "${YELLOW}Activating and installing main backend dependencies...${NC}"
source venv/bin/activate
pip install -r requirements.txt

printf "%b\n" "${YELLOW}Creating storage directories...${NC}"
mkdir -p storage clips videos

printf "%b\n" "${GREEN}Starting backend server...${NC}"
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
cd ..

# --- Frontend Setup ---
printf "\n%b\n" "${BLUE}Setting up frontend...${NC}"
cd frontend

printf "%b\n" "${YELLOW}Installing Node.js dependencies...${NC}"
npm install

printf "%b\n" "${GREEN}Starting frontend server...${NC}"
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
cd ..

# --- Final Checks and Info ---
printf "\n%b\n" "${YELLOW}Waiting for servers to initialize...${NC}"
sleep 5

echo ""
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    printf "%b\n" "${RED}Backend server failed to start. Check backend.log for errors.${NC}"
    exit 1
fi
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    printf "%b\n" "${RED}Frontend server failed to start. Check frontend.log for errors.${NC}"
    exit 1
fi

printf "\n%b\n" "${GREEN}Success! Clarifai is now running!${NC}"
printf "%s\n" "================================================="
printf "%b\n" "${BLUE}Frontend:${NC}     http://localhost:3000"
printf "%b\n" "${BLUE}Backend API:${NC}  http://localhost:8000/docs"
printf "\n%b\n" "To stop the application, run: ${YELLOW}./stop.sh${NC}"
printf "%b\n" "To view logs, run: ${YELLOW}tail -f backend.log${NC} or ${YELLOW}tail -f frontend.log${NC}"