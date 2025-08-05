import os
import sys
import json
import subprocess
import tempfile
import re
from pathlib import Path
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage

# --- THIS IS THE DEFINITIVE, ERROR-PROOF AGENT ---
# The lambda hack has been removed and replaced with proper, explicit
# function calls. This is the final, correct implementation.

def log(message):
    """Prints a log message to stdout for real-time streaming."""
    print("LOG: " + str(message), flush=True)

def read_prompt_template(filename):
    """Reads a prompt template from the 'prompts' directory."""
    script_dir = Path(__file__).parent
    template_path = script_dir / "prompts" / filename
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()

def initialize_llm(api_key):
    """Initializes the language model with the provided API key."""
    log("--- DEBUG: Initializing LLM. ---")
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=api_key, temperature=0.3)
    log("--- DEBUG: LLM Initialized successfully. ---")
    return llm

def get_video_scenes(llm, concept_name, concept_description):
    """Uses an AI call to split a concept into logical, thematic scenes for a video."""
    log("--- DEBUG: Calling LLM to determine video scenes. ---")
    template = read_prompt_template("split_scenes.txt")
    prompt = template.format(concept_name=concept_name, concept_description=concept_description)
    
    log("--- PROMPT FOR SCENE SPLITTING ---")
    log(prompt)
    response = llm.invoke([HumanMessage(content=prompt)])
    response_text = response.content.strip()
    log("--- AI RESPONSE (SCENES) ---")
    log(response_text)
    try:
        scenes = json.loads(response_text)
        if isinstance(scenes, list) and all(isinstance(s, str) for s in scenes):
            log("--- DEBUG: Successfully parsed " + str(len(scenes)) + " scenes. ---")
            return scenes
    except (json.JSONDecodeError, TypeError):
        log("--- WARNING: Failed to parse scenes from AI response. Falling back to sentence splitting. ---")
        return [s.strip() for s in concept_description.split('.') if len(s.strip()) > 10] or [concept_description]

def sanitize_code(code):
    """Aggressively sanitizes the AI's code output."""
    log("--- DEBUG: Sanitizing AI response. ---")
    code_pattern = re.compile(r"```python\n(.*?)\n```", re.DOTALL)
    match = code_pattern.search(code)
    
    if match:
        code = match.group(1).strip()
        log("--- DEBUG: Extracted Python code from markdown block. ---")
    
    if "from manim import *" not in code:
        code = "from manim import *\n\n" + code
        log("--- DEBUG: Added missing 'from manim import *' import. ---")
        
    return code

def generate_manim_code(llm, description):
    """Generates the initial Manim code for a single scene."""
    template = read_prompt_template("generate_code.txt")
    prompt = template.format(description=description)
    
    log("--- PROMPT FOR MANIM CODE ---")
    log(prompt)
    response = llm.invoke([HumanMessage(content=prompt)])
    code = response.content.strip()
    log("--- AI RESPONSE (RAW CODE) ---")
    log(code)
    return sanitize_code(code)

def correct_manim_code(llm, code, error):
    """Corrects the Manim code based on an error message."""
    template = read_prompt_template("correct_code.txt")
    prompt = template.format(code=code, error=error)

    log("--- PROMPT FOR CODE CORRECTION ---")
    log(prompt)
    response = llm.invoke([HumanMessage(content=prompt)])
    new_code = response.content.strip()
    log("--- AI RESPONSE (RAW CORRECTED CODE) ---")
    log(new_code)
    return sanitize_code(new_code)

def render_manim_code(code, output_path):
    """Renders a single Manim scene."""
    class_name = "Scene"
    for line in code.split('\n'):
        if line.strip().startswith("class ") and "Scene" in line:
            class_name = line.split("class ")[1].split("(")[0].strip()
            break
    log("--- DEBUG: Detected scene class name: " + class_name + " ---")

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    try:
        output_dir = os.path.dirname(output_path)
        file_name = os.path.basename(output_path)
        cmd = [
            sys.executable, "-m", "manim", temp_file_path, class_name, "-o", file_name,
            "--media_dir", output_dir, "-v", "WARNING", "-ql",
        ]
        log("--- DEBUG: Executing Manim command: " + " ".join(cmd) + " ---")
        process = subprocess.run(cmd, capture_output=True, text=True, check=False, encoding='utf-8')
        
        if process.returncode != 0:
            return "--- MANIM STDOUT ---\\n" + process.stdout + "\\n\\n--- MANIM STDERR ---\\n" + process.stderr
        return None
    finally:
        os.unlink(temp_file_path)

def main():
    try:
        if len(sys.argv) != 5:
            log("--- FATAL ERROR: Agent requires 4 arguments. ---")
            print("RESULT: " + json.dumps({'success': False, 'error': 'Invalid arguments'}))
            return

        concept_name, concept_description, output_dir, api_key = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
        
        llm = initialize_llm(api_key)
        
        scenes = get_video_scenes(llm, concept_name, concept_description)
        clip_paths = []

        for i, scene_description in enumerate(scenes):
            log("--- Generating Clip " + str(i+1) + "/" + str(len(scenes)) + ": " + scene_description + " ---")
            output_path = os.path.join(output_dir, "clip_" + str(i) + ".mp4")
            
            code = None
            error = "Initial code generation failed."
            
            for attempt in range(1, 4):
                log("--- Clip " + str(i+1) + ", Attempt " + str(attempt) + " ---")
                if code is None:
                    code = generate_manim_code(llm, scene_description)
                else:
                    code = correct_manim_code(llm, code, error)

                error = render_manim_code(code, output_path)

                if error is None:
                    log("--- Clip " + str(i+1) + " rendered successfully. ---")
                    clip_paths.append(output_path)
                    break 
                
                log("--- Clip " + str(i+1) + ", Attempt " + str(attempt) + " failed. ---")
            
            if error is not None:
                log("--- FAILED to generate clip " + str(i+1) + " after 3 attempts. Aborting. ---")
                print("RESULT: " + json.dumps({'success': False, 'error': 'A clip failed to render.'}))
                return

        print("RESULT: " + json.dumps({'success': True, 'clip_paths': clip_paths}))

    except Exception as e:
        log("--- FATAL CRASH in agent's main loop: " + str(e) + " ---")
        print("RESULT: " + json.dumps({'success': False, 'error': 'Agent crashed unexpectedly'}))

if __name__ == "__main__":
    main()