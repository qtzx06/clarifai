# Clarifai Video Generation - Deployment Guide

## 🚀 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Gemini API key

### 1. Environment Setup
```bash
# Clone the repository
git clone <your-repo>
cd clarifai

# Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 2. Deploy with Docker Compose
```bash
# Build and start the application
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health Check: http://localhost:8000/health

## 🛠️ Manual Installation

### System Dependencies
The application requires:
- Python 3.11+
- Node.js 18+
- FFmpeg (video processing)
- LaTeX (mathematical rendering)

### Install Script
```bash
# Run the automated installer
./install_dependencies.sh
```

### Manual Steps
```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
npm run build

# Start services
cd ..
./start.sh
```

## 📋 System Requirements

### Docker Deployment
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space
- **CPU**: 2+ cores recommended

### Manual Installation
- **Ubuntu/Debian**: `apt-get install ffmpeg texlive texlive-latex-extra texlive-fonts-recommended texlive-science texlive-pictures texlive-latex-recommended`
- **macOS**: `brew install ffmpeg mactex`
- **Arch Linux**: `pacman -S ffmpeg texlive-core texlive-bin texlive-latex texlive-latexextra texlive-pictures`

## 🔧 Configuration

### Environment Variables
- `GEMINI_API_KEY`: Required for AI-powered video generation
- `NODE_ENV`: Set to `production` for deployment
- `PORT`: Backend port (default: 8000)
- `FRONTEND_PORT`: Frontend port (default: 3000)

### Video Generation Settings
- Quality: `low_quality`, `medium_quality`, `high_quality`
- Output format: MP4 with H.264 encoding
- Resolution: 854x480 (low quality) for fast generation

## 📊 Features

### Complete Video Pipeline
✅ **PDF Upload & Analysis**: Extract concepts from research papers  
✅ **AI Code Generation**: Gemini 2.5 generates educational Manim code  
✅ **LaTeX Rendering**: Mathematical equations and scientific notation  
✅ **Video Generation**: Automated Manim compilation and rendering  
✅ **Native Video Player**: HTML5 controls with autoplay and seeking  
✅ **Real-time Progress**: 10-second loading simulation with status polling  

### UI/UX Features
✅ **Clean Interface**: Stacked layout matching Generated Code section  
✅ **Loading States**: Realistic progress tracking for Manim rendering  
✅ **Error Handling**: Comprehensive error messages and recovery  
✅ **Download Support**: Direct video download functionality  
✅ **Responsive Design**: Mobile-friendly interface  

## 🐛 Troubleshooting

### Common Issues
1. **LaTeX Compilation Errors**: Ensure all LaTeX packages are installed
2. **Video Generation Timeout**: Increase timeout for complex animations
3. **Memory Issues**: Use `low_quality` setting for resource-constrained environments
4. **Port Conflicts**: Change ports in docker-compose.yml if needed

### Logs
```bash
# View application logs
docker-compose logs -f

# Backend logs only
docker-compose logs -f clarifai

# Check health status
curl http://localhost:8000/health
```

## 📈 Performance Optimization

### Video Generation Speed
- **Low Quality**: ~10-15 seconds per video
- **Medium Quality**: ~30-45 seconds per video  
- **High Quality**: ~60-90 seconds per video

### Resource Usage
- **CPU**: Video generation is CPU-intensive
- **Memory**: 2-4GB RAM during video rendering
- **Storage**: ~10MB per generated video

## 🔒 Security

### Production Considerations
- Set strong environment variables
- Use HTTPS in production
- Implement rate limiting for video generation
- Regular security updates for LaTeX packages

---

**Ready for deployment!** 🎬✨