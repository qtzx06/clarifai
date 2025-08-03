"""
Manim video generation service - REWRITTEN TO MATCH WORKING clarifai-old implementation
"""
import asyncio
import subprocess
import os
import tempfile
from typing import List, Dict, Any, Optional
from pathlib import Path

from ..core.config import settings

class ManimGenerator:
    def __init__(self):
        self.output_dir = settings.CLIPS_DIR
        self.quality = "medium_quality"  # Default quality
    
    async def generate_manim_video(self, code: str, clip_name: str = None, quality: str = None) -> Optional[str]:
        """
        Generate a video from Manim code asynchronously - EXACT COPY FROM WORKING clarifai-old
        
        Args:
            code: The Manim Python code to execute
            clip_name: Optional name for the clip file
            quality: Manim quality setting (low_quality, medium_quality, high_quality)
            
        Returns:
            Path to the generated video file or None if failed
        """
        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Use provided quality or default
        quality = quality or self.quality
        
        # Generate a unique filename if not provided
        if not clip_name:
            clip_name = f"clip_{hash(code) % 10000}"
        
        # Create temporary Python file with the Manim code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
            # Always include default imports for mathematical content
            full_code = """from manim import *
import numpy as np
import math

""" + code
            temp_file.write(full_code)
            temp_file_path = temp_file.name
        
        try:
            # Extract scene name from code - CRITICAL FOR MANIM TO WORK
            scene_name = self.extract_scene_name(code)
            if not scene_name:
                print(f"❌ No scene name found in code for {clip_name}")
                return None
            
            # Run Manim command asynchronously - FIXED WITH SCENE NAME
            quality_flag = f"-q{quality[0]}"  # -ql (low), -qm (medium), -qh (high)
            
            cmd = [
                "manim",
                temp_file_path,
                scene_name,  # CRITICAL: Must specify scene name
                "-o", self.output_dir,
                "--media_dir", self.output_dir,
                "-v", "WARNING",  # Reduce verbosity
                quality_flag
            ]
            
            print(f"🎬 Generating Manim video: {clip_name}")
            print(f"🎯 Scene name: {scene_name}")
            print(f"📋 Command: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                print(f"⚠️ Warning: Manim execution failed for clip {clip_name}")
                print(f"❌ Error: {stderr.decode()}")
                return None
            
            # Find the generated video file - EXACT SAME AS WORKING VERSION
            video_files = list(Path(self.output_dir).glob("**/*.mp4"))
            if not video_files:
                print(f"⚠️ Warning: No video file was generated for clip {clip_name}")
                return None
            
            # Filter out partial files and find the most recent
            final_videos = [f for f in video_files if "partial" not in str(f)]
            
            if not final_videos:
                print(f"⚠️ Warning: No final video file found for clip {clip_name}, using latest available")
                final_videos = video_files
            
            # Return the most recently created final video file
            latest_video = max(final_videos, key=os.path.getctime)
            
            # Rename to our desired clip name
            final_path = os.path.join(self.output_dir, f"{clip_name}.mp4")
            if str(latest_video) != final_path:
                os.rename(str(latest_video), final_path)
            
            print(f"✅ Successfully generated Manim video: {final_path}")
            return final_path
            
        except Exception as e:
            print(f"❌ Error generating Manim video for {clip_name}: {e}")
            return None
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_file_path)
            except:
                pass
    
    async def generate_multiple_clips(self, clips_config: List[Dict[str, Any]], quality: str = None) -> List[str]:
        """
        Generate multiple Manim clips sequentially to maintain order - FROM WORKING clarifai-old
        
        Args:
            clips_config: List of clip configurations with 'code' and optional 'voice_over'
            quality: Manim quality setting
            
        Returns:
            List of paths to generated video files
        """
        quality = quality or self.quality
        clip_paths = []
        
        for i, clip in enumerate(clips_config):
            if not clip.get('code'):
                print(f"⚠️ Skipping clip {i}: no code provided")
                continue
            
            clip_name = f"clip_{i:03d}"
            print(f"🎬 Processing clip {i+1}/{len(clips_config)}: {clip_name}")
            
            try:
                video_path = await self.generate_manim_video(
                    clip['code'], 
                    clip_name, 
                    quality
                )
                
                if video_path:
                    clip_paths.append(video_path)
                    print(f"✅ Clip {i}: {video_path}")
                else:
                    print(f"❌ Clip {i}: Failed to generate")
                    
            except Exception as e:
                print(f"❌ Error processing clip {i}: {e}")
        
        print(f"📊 Generated {len(clip_paths)} out of {len(clips_config)} clips")
        return clip_paths
    
    def create_sample_manim_code(self, concept: str, explanation: str) -> str:
        """
        Create sample Manim code for a mathematical concept - FROM WORKING clarifai-old
        
        Args:
            concept: The concept name
            explanation: Brief explanation text
            
        Returns:
            Manim code string
        """
        # Create a safe class name
        safe_name = ''.join(c for c in concept.replace(" ", "").replace("-", "") if c.isalnum())[:15]
        if not safe_name or safe_name[0].isdigit():
            safe_name = "ConceptScene"
        
        # Limit text lengths for Manim compatibility
        safe_concept = concept.replace('"', "'")[:50]
        safe_explanation = explanation.replace('"', "'")[:100]
        
        # Simple but effective template - WORKING VERSION
        template = f'''
class {safe_name}(Scene):
    def construct(self):
        # Title
        title = Text("{safe_concept}", font_size=48)
        title.to_edge(UP)
        self.play(Write(title))
        self.wait(1)
        
        # Explanation text
        explanation = Text("{safe_explanation}...", font_size=24)
        explanation.next_to(title, DOWN, buff=1)
        self.play(Write(explanation))
        self.wait(2)
        
        # Simple mathematical visualization
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-2, 2, 1],
            x_length=6,
            y_length=4,
        )
        
        # Example function
        func = axes.plot(lambda x: x**2, color=BLUE)
        func_label = axes.get_graph_label(func, label="f(x) = x^2")
        
        self.play(Create(axes))
        self.play(Create(func), Write(func_label))
        self.wait(2)
        
        # Fade out
        self.play(FadeOut(title), FadeOut(explanation), FadeOut(axes), FadeOut(func), FadeOut(func_label))
'''
        return template
    
    def extract_scene_name(self, code: str) -> Optional[str]:
        """
        Extract scene class name from Manim code
        """
        import re
        # Look for class definition that inherits from Scene
        pattern = r'class\s+(\w+)\s*\([^)]*Scene[^)]*\)\s*:'
        match = re.search(pattern, code)
        if match:
            scene_name = match.group(1)
            print(f"🔍 Extracted scene name: {scene_name}")
            return scene_name
        
        print(f"⚠️ No scene class found in code")
        return None
    
    async def test_manim_installation(self) -> bool:
        """
        Test if Manim is properly installed and working - FROM WORKING clarifai-old
        """
        try:
            process = await asyncio.create_subprocess_exec(
                "manim", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                version = stdout.decode().strip()
                print(f"✅ Manim installation detected: {version}")
                return True
            else:
                print(f"❌ Manim test failed: {stderr.decode()}")
                return False
                
        except Exception as e:
            print(f"❌ Manim not found or error testing: {e}")
            return False

# Create a global instance for use in endpoints
manim_generator = ManimGenerator()