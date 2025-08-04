import os
import sys
import json
import subprocess
import tempfile
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain.schema import HumanMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
nvidia_api_key = os.getenv("NVIDIA_API_KEY")

# Initialize the language model
llm = ChatNVIDIA(model="qwen/qwen2.5-coder-32b-instruct", temperature=0)

def generate_manim_code(description):
    prompt = f"""
You're a Manim animation expert.

ONLY respond with valid Manim code using ManimCommunity (no markdown, no explanation, no commentary).
Do NOT include ``` or the word 'python'. Just raw Python code.

Format:
from manim import *

class SceneName(Scene):
    def construct(self):
        # animation code

Description:
"""{description}"""
    response = llm([HumanMessage(content=prompt)])
    return response.content.strip()

def correct_manim_code(code, error):
    prompt = f"""
You're a Manim animation expert. The following Manim code failed to render.
Fix the code to resolve the error.

ONLY respond with valid Manim code using ManimCommunity (no markdown, no explanation, no commentary).
Do NOT include ``` or the word 'python'. Just raw Python code.

Original Code:
"""{code}"""

Error:
"""{error}"""
    response = llm([HumanMessage(content=prompt)])
    return response.content.strip()

def render_manim_code(code, output_path):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    try:
        cmd = [
            "manim",
            temp_file_path,
            "-o",
            output_path,
            "--media_dir",
            ".",
            "-v",
            "WARNING",
            "-ql",
        ]
        process = subprocess.run(cmd, capture_output=True, text=True)
        if process.returncode != 0:
            return process.stderr
        return None
    finally:
        os.unlink(temp_file_path)

def main():
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Invalid arguments"}))
        return

    concept_description = sys.argv[1]
    output_path = sys.argv[2]
    
    logs = []
    code = None
    
    for i in range(3):
        logs.append(f"Attempt {i+1}: Generating Manim code...")
        if code is None:
            code = generate_manim_code(concept_description)
        else:
            code = correct_manim_code(code, error)

        logs.append(f"Attempt {i+1}: Rendering video...")
        error = render_manim_code(code, output_path)

        if error is None:
            print(json.dumps({"success": True, "output_path": output_path, "logs": logs}))
            return
        
        logs.append(f"Attempt {i+1}: Failed with error: {error}")

    print(json.dumps({"success": False, "error": "Failed to generate video after 3 attempts", "logs": logs}))

if __name__ == "__main__":
    main()
