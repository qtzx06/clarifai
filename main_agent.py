# main_agent.py

from langchain_core.runnables import RunnableLambda, RunnableMap
from summary_agent import summary_agent
from video_agent import video_agent

def _main_pipeline(pdf_path: str):
    summary_data = summary_agent.invoke(pdf_path)
    video_data = video_agent.invoke(summary_data["script_summary"])

    return {
        "concepts": summary_data["key_concepts"],
        "script_summary": summary_data["script_summary"],
        "manim_scripts": video_data["manim_scripts"],
        "tts_script": video_data["tts_script"]
    }

main_agent = RunnableLambda(_main_pipeline)

# Optional: run directly
if __name__ == "__main__":
    pdf_path = "seal.pdf"
    result = main_agent.invoke(pdf_path)

    print("\n✅ Key Concepts:\n", result["concepts"])
    print("\n🗣️ Narration Script:\n", result["tts_script"])
    print("\n📽️ First Manim Scene:\n", result["manim_scripts"][0])
