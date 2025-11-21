import os
import sys
import json
import subprocess
import time
import tempfile
import re
import shutil
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import google.genai as genai
from google.genai import types


def log(message):
    """Prints a log message to stdout for real-time streaming."""
    print("LOG: " + str(message), flush=True)


def send_progress(current_scene, total_scenes, stage, details=""):
    """Sends progress update to the backend for real-time tracking."""
    progress = {
        "current_scene": current_scene,
        "total_scenes": total_scenes,
        "stage": stage,  # "splitting" | "generating_code" | "rendering" | "stitching"
        "details": details,
        "progress_percent": int((current_scene / max(total_scenes, 1)) * 100)
    }
    print("PROGRESS: " + json.dumps(progress), flush=True)


LATEX_AVAILABLE = shutil.which("latex") is not None


def read_prompt_template(filename):
    """Reads a prompt template from the 'prompts' directory."""
    script_dir = Path(__file__).parent
    template_path = script_dir / "prompts" / filename
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()


def initialize_llm(api_key):
    """Initializes the language model with the provided API key."""
    log("--- DEBUG: Initializing LLM. ---")
    log(f"--- DEBUG: API key length: {len(api_key) if api_key else 0} ---")
    if not api_key:
        raise ValueError("API key must be set when using the Google AI API.")
    client = genai.Client(api_key=api_key)
    log("--- DEBUG: LLM Initialized successfully. ---")
    return client


def call_gemini_with_retries(client, contents, temperature, context_label):
    """Calls Gemini with retries for quota/rate limit errors."""
    max_retries = 5
    base_delay = 2
    for attempt in range(1, max_retries + 1):
        try:
            return client.models.generate_content(
                model="gemini-3-pro-preview",
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                ),
            )
        except Exception as e:
            error_message = str(e)
            log(
                f"--- WARNING: {context_label} attempt {attempt} failed with error: {error_message} ---"
            )
            quota_exhausted = (
                "RESOURCE_EXHAUSTED" in error_message
                or "quota" in error_message.lower()
                or "429" in error_message
            )
            if not quota_exhausted or attempt == max_retries:
                log("--- ERROR: Exhausted retries for Gemini call. ---")
                raise

            delay = base_delay * attempt
            log(
                f"--- INFO: Retrying {context_label} in {delay} seconds due to quota exhaustion. ---"
            )
            time.sleep(delay)


def get_video_scenes(client, concept_name, concept_description):
    """Uses an AI call to split a concept into logical, thematic scenes for a video."""
    log("--- DEBUG: Calling LLM to determine video scenes. ---")
    template = read_prompt_template("split_scenes.txt")
    prompt = template.format(
        concept_name=concept_name, concept_description=concept_description
    )

    log("--- PROMPT FOR SCENE SPLITTING ---")
    log(prompt)
    response = call_gemini_with_retries(
        client,
        prompt,
        temperature=0.3,
        context_label="Scene splitting",
    )
    response_text = response.text.strip()
    log("--- AI RESPONSE (SCENES) ---")
    log(response_text)

    json_match = re.search(r"\[.*\]", response_text, re.DOTALL)

    if json_match:
        json_string = json_match.group(0)
        try:
            scenes = json.loads(json_string)
            if isinstance(scenes, list) and all(isinstance(s, str) for s in scenes):
                log(
                    "--- DEBUG: Successfully parsed "
                    + str(len(scenes))
                    + " scenes. ---"
                )
                return scenes
        except json.JSONDecodeError:
            log(
                "--- WARNING: Found a JSON-like string, but it was invalid. Falling back. ---"
            )

    log(
        "--- WARNING: Failed to find or parse scenes from AI response. Falling back to sentence splitting. ---"
    )
    return [
        s.strip() for s in concept_description.split(".") if len(s.strip()) > 10
    ] or [concept_description]


def generate_scene_captions(client, concept_name, concept_description, scenes):
    """Ask Gemini to turn rough scene prompts into viewer-facing captions."""
    if not scenes:
        return []

    numbered_scenes = "\n".join(
        [f"{idx + 1}. {scene}" for idx, scene in enumerate(scenes)]
    )

    prompt = f"""You are writing on-screen captions for a short educational video about "{concept_name}".

Concept description:
{concept_description}

Scene breakdown:
{numbered_scenes}

For each numbered scene, write a concise 1–2 sentence caption describing what appears on screen and why it matters. Captions should be plain text (no markdown) and help the viewer follow along even without narration.

Return ONLY valid JSON in the form:
[
  {{"clip": 1, "caption": "…"}},
  {{"clip": 2, "caption": "…"}},
  ...
]
Make sure clip numbers match the scene order exactly."""

    try:
        response = call_gemini_with_retries(
            client,
            prompt,
            temperature=0.4,
            context_label="Scene caption generation",
        )
        if response and response.text:
            json_match = re.search(r"\[.*\]", response.text, re.DOTALL)
            if json_match:
                caption_data = json.loads(json_match.group(0))
                captions = [""] * len(scenes)
                for item in caption_data:
                    idx = int(item.get("clip", 0)) - 1
                    if 0 <= idx < len(scenes):
                        captions[idx] = item.get("caption", "").strip()
                # If we captured anything, fill blanks with fallback text
                if any(captions):
                    for idx, caption in enumerate(captions):
                        if not caption:
                            captions[idx] = scenes[idx]
                    return captions
    except Exception as e:
        log(f"--- WARNING: Scene caption generation failed: {e} ---")

    return scenes


def inject_math_shims(code):
    """Injects safe shims for MathTex and Tex that use Text under the hood."""
    shim_code = """\
# --- MATH SHIMS ---
class MathTex(VGroup):
    def __init__(self, *args, **kwargs):
        super().__init__()
        # Extract common Text kwargs
        font_size = kwargs.get("font_size", 48)
        color = kwargs.get("color", WHITE)
        
        # Filter kwargs for Text to avoid errors
        text_kwargs = {k:v for k,v in kwargs.items() if k in ['font', 'slant', 'weight', 'lsh', 'gradient', 't2c', 't2f', 't2g', 't2s', 't2w', 'disable_ligatures']}
        text_kwargs['font_size'] = font_size
        text_kwargs['color'] = color
        
        for arg in args:
            if isinstance(arg, str):
                # The args are already cleaned of LaTeX commands by normalize_latex_markup
                self.add(Text(arg, **text_kwargs))
        
        # Arrange horizontally like math
        self.arrange(RIGHT, buff=0.1)
        
        # Handle simple positioning kwargs if present (though usually done via methods)
        if "to_edge" in kwargs:
             # This is tricky in init, better to rely on caller method chaining
             pass

class Tex(MathTex):
    pass
# ------------------
"""
    
    # Insert after imports
    if "from manim import *" in code:
        return code.replace("from manim import *", "from manim import *\n" + shim_code)
    else:
        return "from manim import *\n" + shim_code + "\n" + code



def normalize_latex_markup(code):
    """
    Converts common LaTeX markup that slips through into friendly unicode/plain text
    so Text() labels don't show raw commands like \\textbf{}.
    """

    def strip_wrapper(pattern, text):
        def _repl(match):
            return match.group(1)

        return re.sub(pattern, _repl, text)

    original_code = code
    # Strip common wrappers
    wrappers = [
        r"\\textbf\{([^{}]+)\}",
        r"\\textit\{([^{}]+)\}",
        r"\\mathbf\{([^{}]+)\}",
        r"\\mathit\{([^{}]+)\}",
        r"\\text\{([^{}]+)\}",
    ]
    for pattern in wrappers:
        code = strip_wrapper(pattern, code)

    # Replace common commands with unicode equivalents
    replacements = {
        r"\\alpha": "α",
        r"\\beta": "β",
        r"\\gamma": "γ",
        r"\\delta": "δ",
        r"\\theta": "θ",
        r"\\lambda": "λ",
        r"\\mu": "μ",
        r"\\pi": "π",
        r"\\sigma": "σ",
        r"\\phi": "φ",
        r"\\psi": "ψ",
        r"\\omega": "ω",
        r"\\cdot": "·",
        r"\\times": "×",
        r"\\rightarrow": "→",
        r"\\leftarrow": "←",
        r"\\approx": "≈",
        r"\\leq": "≤",
        r"\\geq": "≥",
        r"\\neq": "≠",
    }
    for needle, replacement in replacements.items():
        code = code.replace(needle, replacement)

    # Clean escaped braces leftover from \text{} removal
    code = code.replace(r"\{", "{").replace(r"\}", "}")

    if code != original_code:
        log("--- DEBUG: Normalized LaTeX markup inside Text labels. ---")

    return code


def normalize_mobject_accessors(code):
    """Replaces deprecated geometric helper calls with supported get_corner usage."""
    replacements = {
        ".get_bottom_left()": ".get_corner(DL)",
        ".get_bottom_right()": ".get_corner(DR)",
        ".get_top_left()": ".get_corner(UL)",
        ".get_top_right()": ".get_corner(UR)",
        ".get_center_point()": ".get_center()",
    }
    original_code = code
    for old, new in replacements.items():
        code = code.replace(old, new)
    if code != original_code:
        log("--- DEBUG: Normalized deprecated mobject accessor helpers. ---")
    return code


def ensure_rate_functions_usage(code):
    """Ensures custom easing functions import and usage use rate_functions namespace."""
    needs_import = False

    def replace_ease(match):
        nonlocal needs_import
        needs_import = True
        return f"rate_functions.{match.group(0)}"

    code = re.sub(r"(?<!rate_functions\.)\bease_[a-z0-9_]+\b", replace_ease, code)

    if needs_import and "from manim.utils import rate_functions" not in code:
        lines = code.splitlines()
        insert_idx = 0
        for idx, line in enumerate(lines):
            if line.strip().startswith("from manim import *"):
                insert_idx = idx + 1
                break
        lines.insert(insert_idx, "from manim.utils import rate_functions")
        code = "\n".join(lines)
        log("--- DEBUG: Added rate_functions import for easing helpers. ---")

    return code


def fix_spacing_issues(code):
    """
    Automatically fixes common spacing/overlap issues in generated code.
    """
    fixes_applied = []

    # Fix 1: Ensure .next_to() always has buff parameter
    def ensure_buff_in_next_to(match):
        full_match = match.group(0)
        if "buff=" not in full_match:
            # Insert buff=0.5 before closing paren
            fixed = full_match.rstrip(")") + ", buff=0.5)"
            fixes_applied.append("Added buff parameter to .next_to()")
            return fixed
        return full_match

    code = re.sub(
        r"\.next_to\([^)]+\)",
        ensure_buff_in_next_to,
        code
    )

    # Fix 2: Ensure .arrange() always has buff parameter
    def ensure_buff_in_arrange(match):
        full_match = match.group(0)
        if "buff=" not in full_match:
            fixed = full_match.rstrip(")") + ", buff=0.4)"
            fixes_applied.append("Added buff parameter to .arrange()")
            return fixed
        return full_match

    code = re.sub(
        r"\.arrange\([^)]+\)",
        ensure_buff_in_arrange,
        code
    )

    # Fix 3: Ensure .to_edge() always has buff parameter
    def ensure_buff_in_to_edge(match):
        full_match = match.group(0)
        if "buff=" not in full_match:
            fixed = full_match.rstrip(")") + ", buff=0.5)"
            fixes_applied.append("Added buff parameter to .to_edge()")
            return fixed
        return full_match

    code = re.sub(
        r"\.to_edge\([^)]+\)",
        ensure_buff_in_to_edge,
        code
    )

    if fixes_applied:
        log(f"--- DEBUG: Applied {len(fixes_applied)} spacing fixes: {', '.join(set(fixes_applied))} ---")

    return code


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

    if LATEX_AVAILABLE:
        log("--- DEBUG: Native LaTeX detected; preserving MathTex usage. ---")
    else:
        log("--- WARNING: LaTeX not found. Using Text-based MathTex shim. ---")
        code = normalize_latex_markup(code)
        code = inject_math_shims(code)

    code = normalize_mobject_accessors(code)
    code = ensure_rate_functions_usage(code)
    code = fix_spacing_issues(code)

    return code


def generate_manim_code(client, description):
    """Generates the initial Manim code for a single scene."""
    template = read_prompt_template("generate_code.txt")
    cheat_sheet = read_prompt_template("manim_cheat_sheet.txt")
    prompt = template.format(description=description, cheat_sheet=cheat_sheet)

    log("--- PROMPT FOR MANIM CODE ---")
    log(prompt)
    response = call_gemini_with_retries(
        client,
        prompt,
        temperature=0.3,
        context_label="Initial Manim code generation",
    )
    code = response.text.strip()
    log("--- AI RESPONSE (RAW CODE) ---")
    log(code)
    return sanitize_code(code)


def correct_manim_code(client, code, error):
    """Corrects the Manim code based on an error message."""
    template = read_prompt_template("correct_code.txt")
    cheat_sheet = read_prompt_template("manim_cheat_sheet.txt")
    prompt = template.format(code=code, error=error, cheat_sheet=cheat_sheet)

    log("--- PROMPT FOR CODE CORRECTION ---")
    log(prompt)
    response = call_gemini_with_retries(
        client,
        prompt,
        temperature=0.3,
        context_label="Manim code correction",
    )
    new_code = response.text.strip()
    log("--- AI RESPONSE (RAW CORRECTED CODE) ---")
    log(new_code)
    return sanitize_code(new_code)


def render_manim_code(code, output_dir, file_name):
    """
    Renders a single Manim scene and returns the full path to the complete video file,
    ignoring the partial movie files.
    """
    class_name = "Scene"
    for line in code.split("\n"):
        if line.strip().startswith("class ") and "Scene" in line:
            class_name = line.split("class ")[1].split("(")[0].strip()
            break
    log("--- DEBUG: Detected scene class name: " + class_name + " ---")

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, encoding="utf-8"
    ) as temp_file:
        temp_file.write(code)
        temp_file_path = temp_file.name

    try:
        cmd = [
            sys.executable,
            "-m",
            "manim",
            temp_file_path,
            class_name,
            "-o",
            file_name,
            "--media_dir",
            output_dir,
            "-v",
            "WARNING",
            "-ql",
        ]
        log("--- DEBUG: Executing Manim command: " + " ".join(cmd) + " ---")
        process = subprocess.run(
            cmd, capture_output=True, text=True, check=False, encoding="utf-8"
        )

        if process.returncode != 0:
            # --- THIS IS THE DEFINITIVE FIX FOR THE SYNTAX ERROR ---
            # Build the error message safely to prevent parsing errors.
            error_parts = [
                "--- MANIM STDOUT ---\\n",
                process.stdout,
                "\\n\\n--- MANIM STDERR ---\\n",
                process.stderr,
            ]
            error_message = "".join(error_parts)
            return None, error_message

        for root, dirs, files in os.walk(output_dir):
            if file_name in files and "partial_movie_files" not in root:
                found_path = os.path.join(root, file_name)
                log("--- DEBUG: Found final rendered video at: " + found_path + " ---")
                return found_path, None

        return (
            None,
            "--- AGENT ERROR: Could not find the rendered video file after a successful render. ---",
        )

    finally:
        os.unlink(temp_file_path)


# Thread pool for running blocking operations concurrently
executor = ThreadPoolExecutor(max_workers=5)

async def asyncify(func, *args):
    """Wrap synchronous functions for async execution in thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, func, *args)


async def process_single_clip(i, scene_description, client, output_dir, captions, total_scenes):
    """Process a single clip with retry logic"""
    output_filename = f"clip_{i}.mp4"

    log(f"[Clip {i+1}] Starting generation: {scene_description[:50]}...")

    code = None
    error = "Initial code generation failed."

    for attempt in range(1, 4):
        log(f"[Clip {i+1}] Attempt {attempt}/3")

        # Send progress for code generation
        send_progress(i + 1, total_scenes, "generating_code", f"Attempt {attempt}/3")

        try:
            if code is None:
                code = await asyncify(generate_manim_code, client, scene_description)
            else:
                code = await asyncify(correct_manim_code, client, code, error)

            # Send progress for rendering
            send_progress(i + 1, total_scenes, "rendering", f"Attempt {attempt}/3")

            video_path, error = await asyncify(render_manim_code, code, output_dir, output_filename)

            if error is None:
                log(f"[Clip {i+1}] ✓ Rendered successfully")
                print(f"CLIP_SUCCESS: {video_path}", flush=True)
                if i < len(captions):
                    captions[i]["rendered"] = True
                return {"success": True, "index": i, "path": video_path}

            log(f"[Clip {i+1}] ✗ Attempt {attempt} failed")

        except Exception as e:
            log(f"[Clip {i+1}] ERROR in attempt {attempt}: {str(e)}")
            error = str(e)

    log(f"[Clip {i+1}] FAILED after 3 attempts. Skipping.")
    return {"success": False, "index": i}


async def process_clips_in_batches(scenes, client, output_dir, captions, batch_size=3):
    """Process clips in batches to avoid overwhelming the system"""
    all_results = []
    total_scenes = len(scenes)

    for batch_start in range(0, total_scenes, batch_size):
        batch_end = min(batch_start + batch_size, total_scenes)
        batch = scenes[batch_start:batch_end]

        batch_num = (batch_start // batch_size) + 1
        total_batches = (total_scenes + batch_size - 1) // batch_size
        log(f"=== Processing Batch {batch_num}/{total_batches} (Clips {batch_start+1}-{batch_end}) ===")

        # Create tasks for this batch
        batch_tasks = [
            process_single_clip(batch_start + j, scene, client, output_dir, captions, total_scenes)
            for j, scene in enumerate(batch)
        ]

        # Run batch in parallel
        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)

        # Handle any exceptions
        for i, result in enumerate(batch_results):
            if isinstance(result, Exception):
                log(f"[Clip {batch_start+i+1}] Exception during processing: {result}")
                all_results.append({"success": False, "index": batch_start + i})
            else:
                all_results.append(result)

        log(f"=== Batch {batch_num}/{total_batches} complete ===")

    return all_results


async def async_main():
    try:
        if len(sys.argv) != 5:
            log("--- FATAL ERROR: Agent requires 4 arguments. ---")
            print(
                "FINAL_RESULT: "
                + json.dumps({"success": False, "error": "Invalid arguments"})
            )
            return

        concept_name, concept_description, output_dir, api_key = (
            sys.argv[1],
            sys.argv[2],
            sys.argv[3],
            sys.argv[4],
        )

        client = initialize_llm(api_key)

        log("=== Step 1: Splitting concept into scenes ===")
        send_progress(0, 1, "splitting", "Analyzing concept structure")
        scenes = get_video_scenes(client, concept_name, concept_description)
        log(f"--- Split into {len(scenes)} scenes ---")

        log("=== Step 2: Generating captions ===")
        send_progress(0, len(scenes), "splitting", "Generating captions")
        caption_texts = generate_scene_captions(
            client, concept_name, concept_description, scenes
        )
        if len(caption_texts) != len(scenes):
            caption_texts = scenes

        captions = [
            {"clip": idx + 1, "text": caption_texts[idx], "rendered": False}
            for idx in range(len(scenes))
        ]

        log("=== Step 3: Generating clips in parallel ===")
        results = await process_clips_in_batches(scenes, client, output_dir, captions, batch_size=3)

        # Final progress update
        send_progress(len(scenes), len(scenes), "stitching", "Finalizing video")

        # Count successes
        successful_clips = sum(1 for r in results if r["success"])
        log(f"=== Completed: {successful_clips}/{len(scenes)} clips successful ===")

        if successful_clips == 0:
            log("--- All clips failed to generate. Aborting video generation. ---")
            print(
                "FINAL_RESULT: "
                + json.dumps(
                    {
                        "success": False,
                        "error": "All clips failed to render.",
                        "captions": captions,
                    }
                )
            )
        else:
            log("--- Agent finished generating clips. ---")
            print("FINAL_RESULT: " + json.dumps({"success": True, "captions": captions}))

    except Exception as e:
        log(f"--- FATAL CRASH in agent's main loop: {str(e)} ---")
        import traceback
        log(traceback.format_exc())
        print(
            "FINAL_RESULT: "
            + json.dumps({"success": False, "error": "Agent crashed unexpectedly"})
        )
    finally:
        executor.shutdown(wait=True)


def main():
    """Entry point that runs the async main function"""
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
