# agents/video_agent.py

from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain.schema import HumanMessage
from dotenv import load_dotenv
import os

load_dotenv()
nvidia_api_key = os.getenv("NVIDIA_API_KEY")

llm = ChatNVIDIA(model="qwen/qwen3-235b-a22b", temperature=0)

manim_prompt = """
You're a ManimCommunity animation expert.

Generate a Manim Python script for the animation described below.
It should define a Scene subclass and use animations like `Create`, `Write`, or `FadeIn`.

Respond ONLY with valid Manim code (no markdown).

Example format:
from manim import *

class SceneName(Scene):
    def construct(self):
        # your animation code here

Description:
\"\"\"{description}\"\"\"
"""


tts_prompt = """
You're a professional documentary narrator.
Create a compelling and smooth voiceover script based on the following educational explainer content.

Explainer content:
\"\"\"{text}\"\"\"
"""

def generate_video_assets(script_summary: list):
    manim_scripts = []

    print("🛠️ Generating Manim scripts...")
    for i, step in enumerate(script_summary, 1):
        prompt_text = manim_prompt.format(description=step["animation"])
        response = llm([HumanMessage(content=prompt_text)])
        content = response.content.strip()

        print(f"\n✅ Manim Scene {i} Generated:\n{content}\n")
        manim_scripts.append(content)

    full_text = "\n".join([step["text"] for step in script_summary])
    print("\n🎙️ Generating TTS Script...")
    tts_response = llm([HumanMessage(content=tts_prompt.format(text=full_text))])
    narration = tts_response.content.strip()

    return {
        "manim_scripts": manim_scripts,
        "tts_script": narration
    }

if __name__ == "__main__":
    test_script = [
        {
            "text": "Large Language Models (LLMs) often waste computational resources on redundant reasoning steps, like overthinking or getting stuck in loops, which harms both efficiency and accuracy.",
            "animation": "Visualize a neural network with spiraling, tangled thought bubbles labeled 'redundant reflection' and 'inefficient transitions'."
        },
        {
            "text": "By analyzing the latent space of LLMs, researchers identified three distinct reasoning patterns: execution (core problem-solving), reflection (self-checking), and transition (shifting strategies), which cluster distinctly in deeper layers.",
            "animation": "Show a 3D t-SNE plot separating execution, reflection, and transition thoughts into color-coded clusters."
        },
        {
            "text": "SEAL introduces a 'steering vector' derived from these clusters to suppress unnecessary reflections and transitions during inference, effectively guiding the model toward concise, accurate reasoning paths.",
            "animation": "Demonstrate vector arithmetic in latent space, subtracting reflection/transition vectors from execution vectors."
        },
        {
            "text": "This training-free method reduces token usage by up to 50% while improving accuracy by 11%, with the steering vector transferring across tasks like math and coding.",
            "animation": "Compare side-by-side bar charts showing token reduction and accuracy gains before/after SEAL."
        }
    ]

    video_assets = generate_video_assets(test_script)

    print("\n📽️ FINAL Manim Scripts:")
    for i, code in enumerate(video_assets["manim_scripts"], 1):
        print(f"\n🎬 Scene {i}:\n{code}")

    print("\n🗣️ FINAL TTS Script:\n", video_assets["tts_script"])
