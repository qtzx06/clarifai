#!/bin/bash

echo "🛑 Stopping Clarifai servers..."
echo "================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to stop process by PID file
stop_process() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        echo -e "${YELLOW}🔄 Stopping $service_name (PID: $pid)...${NC}"
        
        if kill -0 "$pid" 2>/dev/null; then
            # Try graceful shutdown first
            kill -TERM "$pid" 2>/dev/null
            
            # Wait a few seconds for graceful shutdown
            sleep 3
            
            # Check if process is still running
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${YELLOW}⚠️  Forcefully stopping $service_name...${NC}"
                kill -KILL "$pid" 2>/dev/null
            fi
            
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${BLUE}ℹ️  $service_name was not running${NC}"
        fi
        
        # Remove PID file
        rm -f "$pid_file"
    else
        echo -e "${BLUE}ℹ️  No PID file found for $service_name${NC}"
    fi
}

# Stop backend server
stop_process "Backend server" "backend.pid"

# Stop frontend server  
stop_process "Frontend server" "frontend.pid"

# Clean up any remaining Node.js processes on port 3000
echo -e "${YELLOW}🧹 Cleaning up any remaining processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

# Clean up log files (optional)
echo -e "${BLUE}📋 Log files preserved:${NC}"
if [ -f "backend.log" ]; then
    echo -e "   • backend.log ($(wc -l < backend.log) lines)"
fi
if [ -f "frontend.log" ]; then
    echo -e "   • frontend.log ($(wc -l < frontend.log) lines)"
fi

echo -e "\n${GREEN}✅ All Clarifai servers stopped successfully!${NC}"
echo -e "${BLUE}💡 To start again, run:${NC} ./start.sh"
echo -e "${BLUE}📊 To view logs:${NC} tail -f backend.log (or frontend.log)"