# 🚀 Clarafai Brev Deployment Guide

## Quick Start

Deploy Clarafai on Brev with a single command:

```bash
python3 brev_launch.py
```

## What is Clarafai?

Clarafai is an AI-powered research paper analysis tool that helps students and researchers:

- 📄 **Upload & Parse PDFs** - Extract text and metadata from research papers
- 🤖 **AI Concept Extraction** - Use Anthropic Claude for high-quality concept identification
- 💬 **Interactive Q&A** - Chat with AI about specific papers
- 🎥 **Educational Videos** - Generate Manim animations explaining key concepts
- 🔍 **Text Clarification** - Get detailed explanations of complex passages

## Prerequisites

### System Requirements
- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend)
- **npm** (package manager)
- **ffmpeg** (for video processing)

### API Keys Required
1. **Anthropic Claude API Key** (Primary AI service)
   - Get from: https://console.anthropic.com/
   - Used for: Concept extraction, chat, explanations
   - **Required** for full functionality

2. **NVIDIA API Key** (Optional backup)
   - Get from: https://build.nvidia.com/
   - Used as: Fallback AI service
   - **Optional** but recommended

## Deployment Steps

### 1. Clone Repository
```bash
git clone <your-clarafai-repo>
cd clarifai
```

### 2. Set Up API Keys
```bash
# Edit the .env file in backend/
nano backend/.env

# Add your API keys:
ANTHROPIC_API_KEY=your_actual_anthropic_key_here
NVIDIA_API_KEY=your_nvidia_key_here  # Optional
```

### 3. Launch with Brev Script
```bash
# Make script executable (if not already)
chmod +x brev_launch.py

# Launch everything
python3 brev_launch.py
```

The script will automatically:
- ✅ Check system dependencies
- ✅ Set up Python virtual environment
- ✅ Install Python packages (FastAPI, Anthropic, Manim, etc.)
- ✅ Install Node.js packages (Next.js, React, TailwindCSS)
- ✅ Create necessary directories
- ✅ Start backend server (port 8000)
- ✅ Start frontend server (port 3000)

### 4. Access Application
Once deployment completes:

- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Architecture

```
Clarafai Application
├── Frontend (Next.js + React + TypeScript)
│   ├── File Upload Interface
│   ├── Concept Visualization
│   ├── Interactive Chat
│   └── Video Player
├── Backend (FastAPI + Python)
│   ├── PDF Processing (PyMuPDF)
│   ├── AI Services (Anthropic Claude)
│   ├── Video Generation (Manim)
│   └── API Endpoints
└── Data Storage
    ├── Uploaded PDFs
    ├── Generated Videos
    └── Analysis Results
```

## Key Features & Tech Stack

### 🔧 Backend Stack
- **FastAPI** - Modern Python web framework
- **Anthropic Claude 3.5 Sonnet** - Premium AI for concept extraction
- **PyMuPDF** - PDF text extraction
- **Manim** - Mathematical animation engine
- **HTTPX** - Async HTTP client

### 🎨 Frontend Stack
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first styling
- **React Hooks** - Modern React patterns

### 🚀 Performance Features
- **Async Processing** - Non-blocking AI operations
- **Background Tasks** - Video generation in background
- **Real-time Polling** - Live status updates
- **Error Handling** - Graceful fallbacks

## Troubleshooting

### Common Issues

**1. API Key Errors**
```
Error: ANTHROPIC_API_KEY not set
```
**Solution**: Edit `backend/.env` and add your Anthropic API key

**2. Module Import Errors**
```
ModuleNotFoundError: No module named 'anthropic'
```
**Solution**: Run the script again - it will install missing packages

**3. Port Already in Use**
```
Error: Port 8000 already in use
```
**Solution**: Stop existing processes or change ports in the script

**4. Video Generation Fails**
```
ffmpeg not found
```
**Solution**: Install ffmpeg:
- Ubuntu: `sudo apt-get install ffmpeg`
- macOS: `brew install ffmpeg`
- Windows: Download from https://ffmpeg.org/

### Manual Setup (if script fails)

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Advanced Configuration

### Environment Variables
```bash
# Required
ANTHROPIC_API_KEY=your_key_here

# Optional
NVIDIA_API_KEY=backup_key_here
DATABASE_URL=sqlite:///./clarafai.db
UPLOAD_DIR=./uploads
VIDEO_DIR=./videos
SECRET_KEY=your-secret-key
FRONTEND_URL=http://localhost:3000
DEBUG=true
```

### Custom Ports
Edit `brev_launch.py` to change default ports:
```python
# Line ~XXX - Backend port
"--port", "8000"  # Change to your preferred port

# Frontend automatically runs on 3000
```

## Production Deployment

For production deployment:

1. **Set DEBUG=false** in `.env`
2. **Use strong SECRET_KEY**
3. **Set up reverse proxy** (nginx)
4. **Enable HTTPS**
5. **Configure CORS** properly
6. **Set up monitoring**

## Performance Optimization

### For Better AI Quality:
- Use **Anthropic Claude** for best concept extraction
- Set temperature=0.3 for consistent results
- Use specific prompts for domain expertise

### For Faster Processing:
- Enable GPU acceleration for Manim (if available)
- Use faster models for development
- Implement caching for repeated requests

## Support

### Getting Help
1. Check the terminal output for detailed error messages
2. Verify API keys are correctly set
3. Ensure all dependencies are installed
4. Check firewall/port restrictions

### Development
- Backend logs: Check terminal running the script
- Frontend logs: Check browser developer console
- API testing: Use http://localhost:8000/docs

## License

[Your License Here]

---

**Happy Researching with Clarafai! 📚✨**