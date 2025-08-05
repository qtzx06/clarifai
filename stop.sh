#!/bin/bash
set -e
set -o pipefail

# --- Colors for output ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

printf "%b\n" "${BLUE}Stopping Clarifai Servers${NC}"
printf "%b\n" "========================="

# --- Function to stop a process by its PID file ---
stop_process() {
    local service_name=$1
    local pid_file=$2

    if [ ! -f "$pid_file" ]; then
        printf "%b\n" "${BLUE}${service_name} PID file not found. Already stopped?${NC}"
        return
    fi

    local pid
    pid=$(cat "$pid_file")

    if [ -z "$pid" ]; then
        printf "%b\n" "${YELLOW}${service_name} PID file is empty. Already stopped?${NC}"
        rm -f "$pid_file"
        return
    fi

    # Check if the process is running
    if ps -p "$pid" > /dev/null; then
        printf "%b\n" "${YELLOW}Stopping ${service_name} (PID: ${pid})...${NC}"
        # Send a graceful termination signal first
        kill -TERM "$pid"
        
        # Wait for the process to terminate
        for i in {1..5}; do
            if ! ps -p "$pid" > /dev/null; then
                printf "%b\n" "${GREEN}${service_name} stopped gracefully.${NC}"
                rm -f "$pid_file"
                return
            fi
            sleep 1
        done

        # If it's still running, force kill it
        printf "%b\n" "${RED}Graceful shutdown failed. Forcefully killing ${service_name} (PID: ${pid})...${NC}"
        kill -9 "$pid"
        sleep 1
        printf "%b\n" "${GREEN}${service_name} stopped forcefully.${NC}"
    else
        printf "%b\n" "${BLUE}${service_name} (PID: ${pid}) was not running.${NC}"
    fi

    rm -f "$pid_file"
}

# Stop the servers
stop_process "Backend" "backend.pid"
stop_process "Frontend" "frontend.pid"

printf "\n%b\n" "${GREEN}Shutdown complete.${NC}"
