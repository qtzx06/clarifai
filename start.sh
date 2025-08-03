#!/bin/bash

echo "🚀 Starting Clarifai - Research Paper Analysis Tool"
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.8+${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies check passed${NC}"

# Backend setup
echo -e "\n${BLUE}🔧 Setting up backend...${NC}"
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
echo -e "${YELLOW}🔄 Activating virtual environment...${NC}"
source venv/bin/activate

# Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
pip install -r requirements.txt

# Create storage directories
mkdir -p storage videos clips

# Start backend server in background
echo -e "${GREEN}🚀 Starting backend server...${NC}"
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

# Wait for backend to start
echo -e "${YELLOW}⏳ Waiting for backend to start...${NC}"
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Backend server started (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend server failed to start. Check backend.log for errors.${NC}"
    exit 1
fi

# Frontend setup
echo -e "\n${BLUE}🎨 Setting up frontend...${NC}"
cd ../frontend

# Install Node.js dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
npm install

# Start frontend server
echo -e "${GREEN}🚀 Starting frontend server...${NC}"
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid

# Wait for frontend to start
echo -e "${YELLOW}⏳ Waiting for frontend to start...${NC}"
sleep 5

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend server started (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}❌ Frontend server failed to start. Check frontend.log for errors.${NC}"
    exit 1
fi

# Success message
echo -e "\n${GREEN}🎉 Clarifai is now running!${NC}"
echo -e "================================================="
echo -e "${BLUE}🌐 Frontend:${NC}     http://localhost:3000"
echo -e "${BLUE}🔗 Backend API:${NC}  http://localhost:8000"
echo -e "${BLUE}📚 API Docs:${NC}     http://localhost:8000/docs"
echo -e "\n${YELLOW}📋 Features:${NC}"
echo -e "• Upload PDF research papers"
echo -e "• AI-powered concept extraction with Gemini 2.5"
echo -e "• Interactive text clarification"
echo -e "• Educational video generation with Manim"
echo -e "• Real-time analysis progress"
echo -e "\n${BLUE}🛑 To stop the servers, run:${NC} ./stop.sh"
echo -e "${BLUE}📊 View logs:${NC} tail -f backend.log (or frontend.log)"

# Return to original directory
cd ..

echo -e "\n${GREEN}✨ Ready to analyze research papers!${NC}"