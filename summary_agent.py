# agents/summary_agent.py

from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain.schema import HumanMessage
from dotenv import load_dotenv
import os
import json

from tools import extract_clean_text
from prompt_template import template

load_dotenv()
nvidia_api_key = os.getenv("NVIDIA_API_KEY")

llm = ChatNVIDIA(model="qwen/qwen3-235b-a22b", temperature=0)

def summarize_paper(pdf_path: str) -> dict:
    clean_text = extract_clean_text(pdf_path)
    prompt = template.format(text=clean_text)

    response = llm([HumanMessage(content=prompt)])
    raw_output = response.content

    try:
        parsed = json.loads(raw_output.strip())
        script = parsed["script_summary"]
        concepts = parsed["key_concepts"]
    except:
        script = [{"text": line.strip(), "animation": "TBD"} for line in raw_output.split("\n") if line.strip()]
        concepts = []

    return {
        "script_summary": script,
        "key_concepts": concepts
    }

if __name__ == "__main__":
    pdf_path = "seal.pdf"  # Replace with your actual file

    result = summarize_paper(pdf_path)
    
    print("\n🧠 Script Summary:")
    for i, scene in enumerate(result["script_summary"], 1):
        print(f"\nScene {i}")
        print(f"Text: {scene['text']}")
        print(f"Animation: {scene['animation']}")

    print("\n🧩 Key Concepts:")
    for concept in result["key_concepts"]:
        print("-", concept)
