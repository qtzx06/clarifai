template = """
You are an educational AI agent.

Your job is to:
1. Read the following research paper text.
2. Summarize the main idea in 3–5 sentences, as if you’re preparing to teach it (like a 3Blue1Brown-style narration script).
3. Identify 5–10 key concepts or terms mentioned in the paper (methods, architectures, models, techniques, etc.).

Return your response as JSON with the following format:

{{
  "script_summary": [
    {{"text": "...", "animation": "..."}},
    ...
  ],
  "key_concepts": [
    "transformers",
    "contrastive learning",
    "latent space"
  ]
}}

Paper text:
{text}
"""
