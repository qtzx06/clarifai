# Clarifai - Research Paper Analysis Tool

A tool that helps students and researchers understand academic papers through automated analysis, key concept extraction, and AI-generated educational videos using Manim.

## Features

- **PDF Upload & Parsing**: Extract text and metadata from research papers using PyMuPDF
- **AI-Powered Analysis**: Analyze papers using NVIDIA's Nemotron and Qwen models via brev.nvidia.com
- **Key Concept Extraction**: Identify and explain important concepts from papers
- **Educational Video Generation**: Create mathematical visualizations using Manim
- **Interactive Clarification**: Click-to-clarify functionality for highlighted text
- **Video Download**: Export generated educational videos

## Architecture

- **Backend**: FastAPI + Python with async processing
- **Frontend**: React + TypeScript + Tailwind CSS
- **AI Models**: NVIDIA Nemotron, Qwen Coder 32B (via brev.nvidia.com)
- **Video Generation**: Manim for mathematical animations
- **PDF Processing**: PyMuPDF for text extraction

## Setup Instructions

### Backend Setup

1. **Create Python Virtual Environment**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On macOS/Linux
   # or
   venv\Scripts\activate     # On Windows
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Manim** (for video generation)
   ```bash
   # Install system dependencies (macOS)
   brew install ffmpeg
   
   # Install Manim
   pip install manim
   ```

4. **Configure Environment Variables**
   ```bash
   # Copy and edit .env file
   cp .env.example .env
   
   # Edit .env with your API keys:
   # BREV_NVIDIA_API_KEY=your_nvidia_api_key_here
   # ANTHROPIC_API_KEY=your_anthropic_key_here
   ```

5. **Test Backend Setup**
   ```bash
   python3 test_server.py
   ```

6. **Start Backend Server**
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Install Node.js Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```

### Full Stack Development

1. **Start Backend** (Terminal 1)
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

2. **Start Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm start
   ```

3. **Access Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## API Endpoints

### Upload & Papers
- `POST /api/upload` - Upload PDF file
- `GET /api/papers` - List all papers
- `GET /api/papers/{paper_id}` - Get paper details
- `GET /api/papers/{paper_id}/status` - Get processing status

### Analysis
- `POST /api/papers/{paper_id}/analyze` - Analyze paper with AI
- `GET /api/papers/{paper_id}/concepts` - Get extracted concepts
- `POST /api/papers/{paper_id}/clarify` - Get text clarification

### Video Generation
- `POST /api/papers/{paper_id}/generate-video` - Generate educational video
- `GET /api/papers/{paper_id}/video/status` - Get video generation status
- `GET /api/papers/{paper_id}/video/download` - Download generated video

## Usage Workflow

1. **Upload PDF**: Upload a research paper through the web interface
2. **Auto-Processing**: Paper is automatically parsed and analyzed
3. **View Concepts**: Review extracted key concepts and insights
4. **Generate Video**: Create educational video with Manim animations
5. **Interactive Learning**: Use highlight-to-clarify features
6. **Download**: Export the generated educational video

## Technology Stack

### Backend
- FastAPI (REST API)
- PyMuPDF (PDF processing)
- Manim (Video generation)
- NVIDIA API (AI models)
- Pydantic (Data validation)

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Axios (HTTP client)

### AI & Services
- NVIDIA Nemotron (Paper analysis)
- Qwen Coder 32B (Code generation)
- Manim (Mathematical animations)
- brev.nvidia.com (Model hosting)

## Development Notes

- The backend uses async processing for long-running tasks (PDF parsing, video generation)
- Videos are generated using Manim with AI-generated code from Qwen Coder
- Paper analysis uses NVIDIA's Nemotron model for concept extraction
- All files are stored locally (can be extended to cloud storage)
- In-memory storage is used for demo (replace with database for production)

## Deployment

For production deployment:

1. Set up proper database (PostgreSQL/MongoDB)
2. Configure cloud storage for files
3. Set up Redis for task queuing
4. Deploy with Docker containers
5. Use nginx for reverse proxy
6. Set up monitoring and logging

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License - See LICENSE file for details
