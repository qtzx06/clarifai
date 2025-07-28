# main_agent.py

from summary_agent import summarize_paper
from video_agent import generate_video_assets

def process_pdf_pipeline(pdf_path: str):
    # Step 1: Summarize and extract key concepts
    print("🔍 Summarizing paper and identifying key concepts...")
    summary_data = summarize_paper(pdf_path)
    script_summary = summary_data["script_summary"]
    key_concepts = summary_data["key_concepts"]

    # Step 2: Generate video assets (Manim code + narration script)
    print("🎬 Generating Manim animations and narration...")
    video_assets = generate_video_assets(script_summary)

    return {
        "concepts": key_concepts,
        "script_summary": script_summary,
        "manim_scripts": video_assets["manim_scripts"],
        "tts_script": video_assets["tts_script"]
    }

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python main_agent.py path/to/paper.pdf")
        exit(1)

    pdf_path = sys.argv[1]
    result = process_pdf_pipeline(pdf_path)

    print("\n✅ Done. Key concepts:\n", result["concepts"])
    print("\n🗣️ Narration script:\n", result["tts_script"])
    print("\n📽️ Example Manim scene:\n", result["manim_scripts"][0])
