# agents/summary_agent.py (Agentic version)

from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.runnables import RunnableLambda
from langchain.schema import HumanMessage
from dotenv import load_dotenv
import os
import json

from tools import extract_clean_text
from prompt_template import template

load_dotenv()
nvidia_api_key = os.getenv("NVIDIA_API_KEY")

llm = ChatNVIDIA(model="qwen/qwen3-235b-a22b", temperature=0)

summary_agent = RunnableLambda(lambda input: _summarize(input))

def _summarize(pdf_path: str) -> dict:
    print("📄 [summary_agent] Extracting and summarizing PDF...")
    clean_text = extract_clean_text(pdf_path)
    prompt = template.format(text=clean_text)

    response = llm([HumanMessage(content=prompt)])
    raw_output = response.content

    try:
        parsed = json.loads(raw_output.strip())
        script = parsed["script_summary"]
        concepts = parsed["key_concepts"]
    except Exception as e:
        print("⚠️ JSON parse failed, falling back to line split")
        script = [
            {"text": line.strip(), "animation": "TBD"}
            for line in raw_output.split("\n") if line.strip()
        ]
        concepts = []

    return {
        "script_summary": script,
        "key_concepts": concepts
    }

if __name__ == "__main__":
    pdf_path = "seal.pdf"
    output = summary_agent.invoke(pdf_path)

    print("\n🧠 Script Summary:")
    for i, scene in enumerate(output["script_summary"], 1):
        print(f"\nScene {i}")
        print(f"Text: {scene['text']}")
        print(f"Animation: {scene['animation']}")

    print("\n🧩 Key Concepts:")
    for c in output["key_concepts"]:
        print("-", c)