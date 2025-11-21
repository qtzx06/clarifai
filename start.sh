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

detect_tinytex_bin() {
    local os="$(uname -s)"
    local arch="$(uname -m)"
    case "$os" in
        Darwin)
            echo "$HOME/.TinyTeX/bin/universal-darwin"
            ;;
        Linux)
            if [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
                echo "$HOME/.TinyTeX/bin/aarch64-linux"
            else
                echo "$HOME/.TinyTeX/bin/x86_64-linux"
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

ensure_latex() {
    if command_exists latex; then
        printf "%b\n" "${GREEN}LaTeX distribution detected: $(which latex)${NC}"
        return
    fi

    printf "%b\n" "${YELLOW}LaTeX not found. Installing TinyTeX for MathTex rendering...${NC}"
    if ! curl -sL https://yihui.org/tinytex/install-bin-unix.sh | sh; then
        printf "%b\n" "${RED}TinyTeX installation failed. Please install a LaTeX distribution manually (${YELLOW}https://yihui.org/tinytex/${RED}).${NC}"
        return
    fi

    local texbin
    texbin="$(detect_tinytex_bin)"
    if [[ -d "$texbin" ]]; then
        export PATH="$texbin:$PATH"
        printf "%b\n" "${GREEN}Added TinyTeX binaries to PATH (${texbin}).${NC}"
    else
        printf "%b\n" "${YELLOW}TinyTeX installed, but could not detect bin path. You may need to add it to PATH manually.${NC}"
    fi

    if command_exists latex; then
        printf "%b\n" "${GREEN}LaTeX installation complete.${NC}"
    else
        printf "%b\n" "${RED}LaTeX command still not found. MathTex rendering may fall back to text-only mode.${NC}"
    fi
}

# --- Dependency Checks ---
printf "\n%b\n" "${BLUE}Checking dependencies...${NC}"
if ! command_exists uv; then
    printf "%b\n" "${RED}Error: uv is not installed. Please install it to continue.${NC}"
    printf "%b\n" "${YELLOW}See installation instructions at https://github.com/astral-sh/uv${NC}"
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

# --- Ensure LaTeX is available for Manim MathTex ---
printf "\n%b\n" "${BLUE}Checking for LaTeX toolchain...${NC}"
ensure_latex

# --- Agent Environment Setup ---
printf "\n%b\n" "${BLUE}Setting up agent environment...${NC}"
AGENT_ENV_DIR="backend/agent_env"

printf "%b\n" "${YELLOW}Ensuring a clean environment by removing old agent directory...${NC}"
rm -rf "$AGENT_ENV_DIR"

printf "%b\n" "${YELLOW}Creating new agent virtual environment in ${AGENT_ENV_DIR} with Python 3.12...${NC}"
uv venv --python 3.12 "$AGENT_ENV_DIR"

printf "%b\n" "${YELLOW}Ensuring pip is installed in the agent environment...${NC}"
"$AGENT_ENV_DIR/bin/python" -m ensurepip --upgrade

printf "%b\n" "${YELLOW}Installing agent dependencies from backend/agent_requirements.txt...${NC}"
"$AGENT_ENV_DIR/bin/python" -m pip install -r backend/agent_requirements.txt
printf "%b\n" "${GREEN}Agent environment setup complete.${NC}"

# --- Backend Setup ---
printf "\n%b\n" "${BLUE}Setting up backend...${NC}"
cd backend

if [ ! -d "venv" ]; then
    printf "%b\n" "${YELLOW}Creating main backend virtual environment...${NC}"
    uv venv venv
fi

printf "%b\n" "${YELLOW}Activating and installing main backend dependencies...${NC}"
source venv/bin/activate && uv pip install -r requirements.txt

printf "%b\n" "${YELLOW}Creating storage directories...${NC}"
mkdir -p storage clips videos

printf "%b\n" "${GREEN}Starting backend server...${NC}"
nohup ./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
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