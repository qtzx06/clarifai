from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain.schema import HumanMessage
from dotenv import load_dotenv
import json
import os
from tools import extract_clean_text
from prompt_template import template

load_dotenv()
nvidia_api_key = os.getenv("NVIDIA_API_KEY")


# Load and clean the PDF
pdf_path = "seal.pdf"
clean_text = extract_clean_text(pdf_path)

# Prepare prompt
prompt = template.format(text=clean_text)  # Truncate if needed

# Init LLM
llm = ChatNVIDIA(model="qwen/qwen3-235b-a22b", temperature=0)

# Call the LLM
response = llm([HumanMessage(content=prompt)])
raw_output = response.content

# Try to parse
try:
    explainer_script = json.loads(raw_output)
except:
    explainer_script = [{"text": line.strip(), "animation": "TBD"} for line in raw_output.split("\n") if line.strip()]

# Output result
for i, step in enumerate(explainer_script, 1):
    print(f"\n🎬 Scene {i}")
    print(f"🗣️  {step['text']}")
    print(f"🎞️  {step['animation']}")
