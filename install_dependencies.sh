#!/bin/bash

echo "🚀 Installing Clarifai Video Generation Dependencies..."

# Navigate to backend directory
cd backend

echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo "🎬 Installing system dependencies for Manim..."

# Check if running on Ubuntu/Debian
if command -v apt-get &> /dev/null; then
    echo "Installing system dependencies for Ubuntu/Debian..."
    sudo apt-get update
    sudo apt-get install -y ffmpeg texlive texlive-latex-extra texlive-fonts-recommended texlive-science tipa
elif command -v brew &> /dev/null; then
    echo "Installing system dependencies for macOS..."
    brew install ffmpeg mactex
elif command -v pacman &> /dev/null; then
    echo "Installing system dependencies for Arch Linux..."
    sudo pacman -S ffmpeg texlive-core texlive-bin texlive-latex texlive-latexextra texlive-pictures
else
    echo "⚠️  Please install ffmpeg and LaTeX manually for your system"
    echo "   - ffmpeg: for video processing"
    echo "   - LaTeX: for mathematical text rendering in Manim"
fi

echo "✅ Dependencies installation complete!"
echo ""
echo "To start the application:"
echo "1. Set up your .env file with GEMINI_API_KEY"
echo "2. Run: ./start.sh"