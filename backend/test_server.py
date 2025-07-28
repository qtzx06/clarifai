"""
Simple test script to verify the backend setup
"""
import asyncio
import sys
import os

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

async def test_basic_imports():
    """Test that all our modules can be imported"""
    try:
        print("Testing imports...")
        
        from app.core.config import settings
        print(f"✓ Config loaded: {settings.APP_NAME}")
        
        from app.services.pdf_parser import PDFParser
        parser = PDFParser()
        print("✓ PDF Parser initialized")
        
        from app.services.manim_generator import ManimGenerator
        manim_gen = ManimGenerator()
        print("✓ Manim Generator initialized")
        
        from app.services.nvidia_service import NVIDIAService
        nvidia_service = NVIDIAService()
        print("✓ NVIDIA Service initialized")
        
        # Test Manim installation
        manim_available = await manim_gen.test_manim_installation()
        if manim_available:
            print("✓ Manim installation verified")
        else:
            print("⚠ Manim not available - install with: pip install manim")
        
        print("\n🎉 All core services initialized successfully!")
        print(f"NVIDIA API Key configured: {'Yes' if settings.BREV_NVIDIA_API_KEY else 'No'}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_basic_imports())
    if success:
        print("\n🚀 Backend is ready! Run: uvicorn app.main:app --reload")
    else:
        print("\n❌ Backend setup incomplete")