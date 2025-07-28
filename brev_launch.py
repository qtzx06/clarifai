#!/usr/bin/env python3
"""
Brev Launch Script for Clarafai Research Paper Analysis Tool
This script sets up and launches the complete Clarafai application on Brev.
"""

import os
import sys
import subprocess
import time
import signal
import threading
from pathlib import Path

class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class ClarafaiBrevLauncher:
    def __init__(self):
        self.project_root = Path(__file__).parent.absolute()
        self.backend_dir = self.project_root / "backend"
        self.frontend_dir = self.project_root / "frontend"
        self.processes = []
        
        print(f"{Colors.BLUE}{Colors.BOLD}🚀 Clarafai Brev Launcher{Colors.ENDC}")
        print(f"{Colors.BLUE}Research Paper Analysis Tool with AI-Powered Features{Colors.ENDC}")
        print(f"Project Root: {self.project_root}")
        print("=" * 60)
    
    def log(self, message, color=Colors.GREEN):
        print(f"{color}[BREV] {message}{Colors.ENDC}")
    
    def error(self, message):
        print(f"{Colors.RED}[ERROR] {message}{Colors.ENDC}")
    
    def warn(self, message):
        print(f"{Colors.YELLOW}[WARN] {message}{Colors.ENDC}")
    
    def run_command(self, command, cwd=None, check=True):
        """Run a command and return the result"""
        try:
            self.log(f"Running: {command}")
            if isinstance(command, str):
                command = command.split()
            
            result = subprocess.run(
                command, 
                cwd=cwd or self.project_root,
                capture_output=True,
                text=True,
                check=check
            )
            
            if result.stdout:
                print(result.stdout)
            if result.stderr and result.returncode != 0:
                self.error(result.stderr)
                
            return result
        except subprocess.CalledProcessError as e:
            self.error(f"Command failed: {e}")
            if check:
                sys.exit(1)
            return e
    
    def check_dependencies(self):
        """Check if required dependencies are installed"""
        self.log("Checking system dependencies...")
        
        # Check Python
        try:
            python_version = subprocess.check_output([sys.executable, "--version"], text=True).strip()
            self.log(f"✓ {python_version}")
        except:
            self.error("Python not found!")
            sys.exit(1)
        
        # Check Node.js
        try:
            node_version = subprocess.check_output(["node", "--version"], text=True).strip()
            self.log(f"✓ Node.js {node_version}")
        except:
            self.error("Node.js not found! Please install Node.js")
            sys.exit(1)
        
        # Check npm
        try:
            npm_version = subprocess.check_output(["npm", "--version"], text=True).strip()
            self.log(f"✓ npm {npm_version}")
        except:
            self.error("npm not found!")
            sys.exit(1)
        
        # Check ffmpeg (for video processing)
        try:
            ffmpeg_version = subprocess.check_output(["ffmpeg", "-version"], text=True).split('\n')[0]
            self.log(f"✓ {ffmpeg_version}")
        except:
            self.warn("ffmpeg not found. Video generation may not work properly.")
            self.log("Installing ffmpeg...")
            try:
                if sys.platform.startswith('linux'):
                    self.run_command("sudo apt-get update && sudo apt-get install -y ffmpeg", check=False)
                elif sys.platform == 'darwin':
                    self.run_command("brew install ffmpeg", check=False)
                else:
                    self.warn("Please install ffmpeg manually for video generation")
            except:
                self.warn("Could not auto-install ffmpeg")
    
    def setup_environment(self):
        """Set up environment variables"""
        self.log("Setting up environment...")
        
        env_file = self.backend_dir / ".env"
        
        if not env_file.exists():
            self.warn(".env file not found, creating template...")
            env_template = """# Clarafai Environment Configuration
# API Keys - Replace with your actual keys
ANTHROPIC_API_KEY=your_anthropic_api_key_here
NVIDIA_API_KEY=your_nvidia_api_key_here

# Database
DATABASE_URL=sqlite:///./clarafai.db

# File Storage
UPLOAD_DIR=./uploads
VIDEO_DIR=./videos

# Security
SECRET_KEY=your-secret-key-here-change-this-in-production

# CORS
FRONTEND_URL=http://localhost:3000

# Development
DEBUG=true
ENVIRONMENT=development
"""
            with open(env_file, 'w') as f:
                f.write(env_template)
            
            self.error("Please edit backend/.env file with your API keys!")
            self.log("Required API keys:")
            self.log("  - ANTHROPIC_API_KEY: Get from https://console.anthropic.com/")
            self.log("  - NVIDIA_API_KEY: Get from https://build.nvidia.com/")
            return False
        else:
            self.log("✓ Environment file found")
            
            # Check if API keys are set
            with open(env_file, 'r') as f:
                env_content = f.read()
                
            if "your_anthropic_api_key_here" in env_content:
                self.error("Please set your ANTHROPIC_API_KEY in backend/.env")
                return False
            
            if "your_nvidia_api_key_here" in env_content:
                self.warn("NVIDIA_API_KEY not set (optional, but recommended)")
            
            self.log("✓ API keys configured")
        
        return True
    
    def setup_backend(self):
        """Set up Python backend"""
        self.log("Setting up Python backend...")
        
        # Check if we're in a virtual environment
        venv_dir = self.backend_dir / "venv"
        
        if not venv_dir.exists():
            self.log("Creating Python virtual environment...")
            self.run_command([sys.executable, "-m", "venv", "venv"], cwd=self.backend_dir)
        
        # Determine activation script
        if sys.platform == "win32":
            activate_script = venv_dir / "Scripts" / "activate.bat"
            pip_executable = venv_dir / "Scripts" / "pip"
        else:
            activate_script = venv_dir / "bin" / "activate"
            pip_executable = venv_dir / "bin" / "pip"
        
        # Install requirements
        requirements_file = self.backend_dir / "requirements.txt"
        if requirements_file.exists():
            self.log("Installing Python dependencies...")
            self.run_command([str(pip_executable), "install", "-r", "requirements.txt"], cwd=self.backend_dir)
        else:
            self.log("Installing core Python dependencies...")
            dependencies = [
                "fastapi==0.104.1",
                "uvicorn[standard]==0.24.0",
                "python-multipart==0.0.6",
                "python-dotenv==1.0.0",
                "httpx==0.25.2",
                "PyMuPDF==1.23.8",
                "manim==0.17.3",
                "pydantic==2.5.0",
                "pydantic-settings==2.1.0"
            ]
            
            for dep in dependencies:
                self.run_command([str(pip_executable), "install", dep], cwd=self.backend_dir)
        
        self.log("✓ Backend setup complete")
        return venv_dir
    
    def setup_frontend(self):
        """Set up Node.js frontend"""
        self.log("Setting up Node.js frontend...")
        
        package_json = self.frontend_dir / "package.json"
        if not package_json.exists():
            self.error("Frontend package.json not found!")
            return False
        
        # Install npm dependencies
        node_modules = self.frontend_dir / "node_modules"
        if not node_modules.exists():
            self.log("Installing Node.js dependencies...")
            self.run_command("npm install", cwd=self.frontend_dir)
        else:
            self.log("✓ Node modules found, checking for updates...")
            self.run_command("npm ci", cwd=self.frontend_dir, check=False)
        
        self.log("✓ Frontend setup complete")
        return True
    
    def create_directories(self):
        """Create necessary directories"""
        self.log("Creating necessary directories...")
        
        directories = [
            self.backend_dir / "uploads",
            self.backend_dir / "videos",
            self.backend_dir / "temp"
        ]
        
        for directory in directories:
            directory.mkdir(exist_ok=True)
            self.log(f"✓ Created {directory}")
    
    def start_backend(self, venv_dir):
        """Start the FastAPI backend"""
        self.log("Starting FastAPI backend server...")
        
        if sys.platform == "win32":
            python_executable = venv_dir / "Scripts" / "python"
            activate_command = f"{venv_dir}/Scripts/activate.bat"
        else:
            python_executable = venv_dir / "bin" / "python"
            activate_command = f"source {venv_dir}/bin/activate"
        
        # Start backend server
        backend_cmd = [
            str(python_executable), "-m", "uvicorn", 
            "app.main:app", 
            "--reload", 
            "--host", "0.0.0.0", 
            "--port", "8000"
        ]
        
        def run_backend():
            try:
                process = subprocess.Popen(
                    backend_cmd,
                    cwd=self.backend_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                self.processes.append(process)
                
                for line in iter(process.stdout.readline, ''):
                    print(f"{Colors.BLUE}[BACKEND]{Colors.ENDC} {line.strip()}")
                    
            except Exception as e:
                self.error(f"Backend failed: {e}")
        
        backend_thread = threading.Thread(target=run_backend, daemon=True)
        backend_thread.start()
        
        # Wait for backend to start
        self.log("Waiting for backend to start...")
        time.sleep(5)
        
        # Test backend health
        try:
            import requests
            response = requests.get("http://localhost:8000/health", timeout=10)
            if response.status_code == 200:
                self.log("✓ Backend is running and healthy")
            else:
                self.warn("Backend may not be ready yet")
        except:
            self.warn("Could not verify backend health (requests not available)")
    
    def start_frontend(self):
        """Start the Next.js frontend"""
        self.log("Starting Next.js frontend server...")
        
        frontend_cmd = ["npm", "run", "dev"]
        
        def run_frontend():
            try:
                process = subprocess.Popen(
                    frontend_cmd,
                    cwd=self.frontend_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                self.processes.append(process)
                
                for line in iter(process.stdout.readline, ''):
                    print(f"{Colors.GREEN}[FRONTEND]{Colors.ENDC} {line.strip()}")
                    
            except Exception as e:
                self.error(f"Frontend failed: {e}")
        
        frontend_thread = threading.Thread(target=run_frontend, daemon=True)
        frontend_thread.start()
        
        self.log("Waiting for frontend to start...")
        time.sleep(3)
    
    def print_access_info(self):
        """Print access information"""
        print("\n" + "=" * 60)
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 Clarafai is now running!{Colors.ENDC}")
        print("=" * 60)
        print(f"{Colors.BLUE}Frontend (UI):{Colors.ENDC}     http://localhost:3000")
        print(f"{Colors.BLUE}Backend API:{Colors.ENDC}      http://localhost:8000")
        print(f"{Colors.BLUE}API Docs:{Colors.ENDC}         http://localhost:8000/docs")
        print(f"{Colors.BLUE}API Health:{Colors.ENDC}       http://localhost:8000/health")
        print("=" * 60)
        print(f"{Colors.YELLOW}Features available:{Colors.ENDC}")
        print("• 📄 PDF upload and parsing")
        print("• 🤖 AI-powered concept extraction (Anthropic Claude)")
        print("• 💬 Interactive Q&A chat")
        print("• 🎥 Educational video generation (Manim)")
        print("• 🔍 Text clarification and explanation")
        print("=" * 60)
        print(f"{Colors.RED}Press Ctrl+C to stop all services{Colors.ENDC}")
        print("=" * 60)
    
    def cleanup(self):
        """Clean up processes on exit"""
        self.log("Shutting down services...")
        for process in self.processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except:
                try:
                    process.kill()
                except:
                    pass
        self.log("✓ All services stopped")
    
    def launch(self):
        """Main launch sequence"""
        try:
            # Setup sequence
            self.check_dependencies()
            
            if not self.setup_environment():
                return False
            
            self.create_directories()
            venv_dir = self.setup_backend()
            
            if not self.setup_frontend():
                return False
            
            # Start services
            self.start_backend(venv_dir)
            self.start_frontend()
            
            # Show access info
            self.print_access_info()
            
            # Keep running
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                self.log("Received shutdown signal")
            
            return True
            
        except Exception as e:
            self.error(f"Launch failed: {e}")
            return False
        finally:
            self.cleanup()

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print(f"\n{Colors.YELLOW}Received interrupt signal, shutting down...{Colors.ENDC}")
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handling
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    launcher = ClarafaiBrevLauncher()
    success = launcher.launch()
    
    if not success:
        sys.exit(1)