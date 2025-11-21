"""
Gemini 2.5 API service for research paper analysis
Replaces Claude + NVIDIA with single unified AI service
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional
from google import genai
from ..core.config import settings


class GeminiService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.client = None
        self.last_call_time = 0  # Track last API call time for rate limiting
        self.min_call_interval = 0.5  # Minimum seconds between API calls

        if self.api_key:
            # Initialize Gemini client
            self.client = genai.Client(api_key=self.api_key)
        else:
            print("Warning: GEMINI_API_KEY not set. Using fallback service.")

    async def analyze_paper_with_gemini(
        self, content: str, title: str = ""
    ) -> Dict[str, Any]:
        """
        Use Gemini 2.5 Flash for comprehensive paper analysis
        """
        if not self.client:
            print("No Gemini client available, using fallback analysis")
            return await self._fallback_analysis(content, title)

        try:
            prompt = f"""Extract key concepts from this research paper in JSON format.

Paper Title: {title}
Content: {content[:5000]}

Return exactly 3 technical concepts in this JSON format:
[
  {{
    "name": "Specific Technical Term",
    "description": "Clear explanation in 1-2 sentences",
    "importance_score": 0.8,
    "concept_type": "mathematical"
  }}
]

Rules:
- For "concept_type", choose the most fitting category from: "mathematical", "conceptual", "historical", "methodological", "technical", "empirical".
- Extract REAL technical concepts from the paper
- Use specific names from the paper, not generic phrases
- Keep names under 50 characters
- Keep descriptions under 200 characters
- Return ONLY 3 concepts for initial analysis

JSON array:"""

            response = await self._call_gemini_api(prompt)

            if response:
                print(f"Gemini API response received: {len(response)} chars")
                # Try to parse as JSON first
                concepts = self._parse_gemini_concepts(response)

                if concepts:
                    print(f"Successfully parsed {len(concepts)} concepts")
                    insights = ["Analysis completed with AI insights"]
                    return {
                        "concepts": concepts,
                        "insights": insights,
                        "methodology": "Gemini 2.5 Flash Analysis",
                        "full_analysis": response,
                    }
                else:
                    print("Failed to parse concepts from Gemini response")
                    return await self._fallback_analysis(content, title)
            else:
                print("No response from Gemini API")
                return await self._fallback_analysis(content, title)

        except Exception as e:
            print(f"Error in Gemini analysis: {e}")
            return await self._fallback_analysis(content, title)

    async def generate_concepts_with_gemini(self, content: str) -> List[Dict[str, Any]]:
        """
        Use Gemini 2.5 for high-quality concept extraction with structured output
        """
        if not self.client:
            return await self._fallback_concept_extraction(content)

        try:
            prompt = f"""Extract exactly 3 specific technical concepts from this research paper. Focus on the most important methods, algorithms, or innovations.

Research text: {content[:5000]}

Return a JSON array with exactly 3 concepts in this format:
[
  {{
    "name": "Specific Technical Term",
    "description": "Clear explanation in 1-2 sentences without markdown formatting",
    "importance_score": 0.8,
    "concept_type": "technical"
  }}
]

Rules:
- For "concept_type", choose the most fitting category from: "mathematical", "conceptual", "historical", "methodological", "technical", "empirical".
- Extract ONLY the most important technical concepts
- Use specific names from the paper, not generic phrases
- No markdown formatting or special characters in descriptions
- Keep names under 50 characters
- Keep descriptions under 200 characters
- No phrases like "Key Concept from" or generic descriptors

JSON array:"""

            response = await self._call_gemini_api(prompt)

            if response:
                # Try to parse as JSON first, fallback to text parsing
                concepts = self._parse_gemini_concepts(response)
                return (
                    concepts
                    if concepts
                    else await self._fallback_concept_extraction(content)
                )
            else:
                return await self._fallback_concept_extraction(content)

        except Exception as e:
            print(f"Error in Gemini concept extraction: {e}")
            return await self._fallback_concept_extraction(content)

    async def generate_additional_concept_with_gemini(
        self, content: str, existing_concepts: List[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Generate ONE truly fresh additional concept - no caching, always new
        """
        if not self.client:
            return await self._fallback_additional_concept()

        try:
            # Add randomness to ensure fresh concepts each time
            import time

            timestamp = int(time.time())

            existing_list = (
                "\n".join([f"- {concept}" for concept in existing_concepts])
                if existing_concepts
                else "- None yet"
            )

            prompt = f"""[Request #{timestamp}] Analyze this research paper and identify ONE completely new technical concept that hasn't been identified yet.

Research text: {content[:5000]}

EXISTING CONCEPTS TO AVOID:
{existing_list}

Your task: Find ONE genuinely different technical concept that:
1. Is completely distinct from existing concepts listed above
2. Represents a unique technical/methodological aspect of the research
3. Uses specific terminology directly from the paper
4. Brings new insight not covered by existing concepts

Generate a fresh, unique concept in JSON format:
{{
    "name": "Specific Technical Term From Paper",
    "description": "Clear explanation in 1-2 sentences focusing on what makes this concept unique",
    "importance_score": 0.7,
    "concept_type": "methodological"
}}

Requirements:
- For "concept_type", choose the most fitting category from: "mathematical", "conceptual", "historical", "methodological", "technical", "empirical".
- Must be genuinely different from existing concepts
- Extract real technical terms from the paper, not generic descriptions
- Each generation should find different aspects of the research
- Keep name under 50 characters, description under 200 characters
- No markdown formatting

JSON object:"""

            response = await self._call_gemini_api(prompt)

            if response:
                print(f"Gemini response for additional concept: {response[:200]}...")
                try:
                    # Try multiple JSON extraction strategies
                    json_str = None
                    
                    # Strategy 1: Look for JSON object with double braces
                    if "{{" in response and "}}" in response:
                        start = response.find("{{")
                        end = response.rfind("}}") + 1
                        json_str = response[start:end]
                    # Strategy 2: Look for JSON object with single braces
                    elif "{" in response and "}" in response:
                        start = response.find("{")
                        end = response.rfind("}") + 1
                        json_str = response[start:end]
                    # Strategy 3: Try to find JSON in code blocks
                    elif "```json" in response:
                        start = response.find("```json") + 7
                        end = response.find("```", start)
                        if end > start:
                            json_str = response[start:end].strip()
                    elif "```" in response:
                        start = response.find("```") + 3
                        end = response.find("```", start)
                        if end > start:
                            json_str = response[start:end].strip()
                    
                    if json_str:
                        print(f"Extracted JSON string: {json_str[:100]}...")
                        concept_data = json.loads(json_str)

                        # Validate the concept
                        name = concept_data.get("name", "").strip()
                        description = concept_data.get("description", "").strip()

                        if not name or not description:
                            print(f"Missing name or description. Name: '{name}', Description: '{description[:50]}...'")
                            return await self._fallback_additional_concept(timestamp)
                        
                        if len(name) <= 3:
                            print(f"Name too short: '{name}'")
                            return await self._fallback_additional_concept(timestamp)
                        
                        if len(description) <= 10:
                            print(f"Description too short: '{description}'")
                            return await self._fallback_additional_concept(timestamp)

                        # More lenient duplicate checking - allow variations
                        name_lower = name.lower()
                        is_too_similar = any(
                            existing.lower() == name_lower
                            or (
                                len(existing) > 5
                                and existing.lower() in name_lower
                                and len(name_lower) - len(existing.lower()) < 3
                            )
                            for existing in existing_concepts
                        )

                        if is_too_similar:
                            print(f"Concept too similar to existing: '{name}' (existing: {existing_concepts})")
                            return await self._fallback_additional_concept(timestamp)

                        print(f"Successfully parsed and validated concept: '{name}'")
                        return {
                            "name": name[:80],
                            "description": description[:400],
                            "importance_score": min(
                                1.0,
                                max(
                                    0.5,
                                    float(
                                        concept_data.get(
                                            "importance_score", 0.7
                                        )
                                    ),
                                ),
                            ),
                            "concept_type": concept_data.get(
                                "concept_type", "conceptual"
                            ),
                        }
                    else:
                        print(f"Could not extract JSON from response. Response: {response[:300]}")

                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    print(f"JSON parsing failed for additional concept: {e}")
                    print(f"Response that failed to parse: {response[:300]}")

                # Use fallback with timestamp for uniqueness
                print("Falling back to generic concept due to parsing/validation failure")
                return await self._fallback_additional_concept(timestamp)
            else:
                return await self._fallback_additional_concept(timestamp)

        except Exception as e:
            print(f"Error generating additional concept: {e}")
            return await self._fallback_additional_concept()

    async def generate_manim_code_with_gemini(
        self, concept_name: str, concept_description: str, paper_title: str = ""
    ) -> str:
        """
        Generate high-quality Manim code using Gemini 2.5
        """
        if not self.client:
            print("No Gemini client available, using fallback Manim code")
            return self._generate_fallback_manim_code(concept_name, concept_description)

        try:
            # Create a safe class name
            safe_name = "".join(
                c for c in concept_name.replace(" ", "").replace("-", "") if c.isalnum()
            )[:15]
            if not safe_name or safe_name[0].isdigit():
                safe_name = "ConceptScene"

            prompt = f"""Generate Manim Python code for an educational animation in the style of 3blue1brown.

Concept: {concept_name}
Description: {concept_description}
Paper: {paper_title}

Create a Manim Scene class that:
1.  **Animation Zone:** Confines all animations to a central rectangle to avoid clutter.
2.  **Visuals:** Uses clear, well-spaced mathematical objects (equations, graphs, diagrams).
3.  **Transitions:** Has smooth, logical transitions between elements.
4.  **Pacing:** Is well-paced, lasting about 10-15 seconds.
5.  **Cleanup:** Fades out all objects at the end of the scene.

Requirements:
- Use ONLY standard Manim imports.
- Create a class named {safe_name}Scene that inherits from Scene.
- Use proper Manim syntax (self.play, self.wait, etc.).
- Use Write() for text and Create() for shapes/math objects.
- Keep all visual elements within a defined 'animation_zone' Rectangle.

Return ONLY the Python class code, no markdown formatting or explanations:

class {safe_name}Scene(Scene):
    def construct(self):
        # Define the animation zone
        animation_zone = Rectangle(
            width=12, height=6, stroke_color=GRAY, stroke_width=2
        ).to_edge(DOWN)

        # Your educational animation code here
        # All animations must happen inside the 'animation_zone'
        
        # End with FadeOut of all elements
"""

            response = await self._call_gemini_api(prompt)

            if response:
                # Clean and validate the Manim code
                manim_code = self._clean_manim_code(response, concept_name)
                if "class " in manim_code and "Scene" in manim_code:
                    print(f"Generated Manim code for: {concept_name}")
                    return manim_code
                else:
                    print("Invalid Manim code generated, using fallback")
                    return self._generate_fallback_manim_code(
                        concept_name, concept_description
                    )
            else:
                print("No response from Gemini, using fallback")
                return self._generate_fallback_manim_code(
                    concept_name, concept_description
                )

        except Exception as e:
            print(f"Error generating Manim code: {e}")
            return self._generate_fallback_manim_code(concept_name, concept_description)

    async def generate_intro_manim_code(
        self, concept_name: str, paper_title: str = ""
    ) -> str:
        """
        Generate intro Manim code for a specific concept.
        """
        if not self.client:
            return self._generate_fallback_intro_manim(concept_name)

        try:
            prompt = f"""Create a Manim intro animation for a concept.

Concept: "{concept_name}"
From Paper: "{paper_title}"

Create an IntroScene class that:
1.  Displays the concept name as a main title. Use `MarkupText` to wrap it if it's long.
2.  Shows the paper title as a smaller subtitle below the main title.
3.  Uses elegant, smooth animations (e.g., `FadeIn`, `Write`).
4.  Is well-paced and professional, lasting about 5-7 seconds.
5.  Fades out all elements at the end to leave a clean slate.

Requirements:
-   Use `MarkupText(f"...", font_size=40)` for the main title to allow wrapping.
-   Use `MarkupText(f"...", font_size=24)` for the subtitle.
-   Center the text and ensure it doesn't go off-screen.
-   Create a class named `IntroScene` that inherits from `Scene`.
-   Return ONLY the Python class code.

Example of good text handling:
title = MarkupText(f'<span foreground="white">{concept_name}</span>', font_size=40)
subtitle = MarkupText(f'<span foreground="gray">{paper_title}</span>', font_size=24)
VGroup(title, subtitle).arrange(DOWN, buff=0.5)

Return ONLY the Python class code:
"""

            response = await self._call_gemini_api(prompt)

            if response:
                manim_code = self._clean_manim_code(response, "IntroScene")
                if "class " in manim_code and "Scene" in manim_code:
                    return manim_code
                else:
                    return self._generate_fallback_intro_manim(concept_name)
            else:
                return self._generate_fallback_intro_manim(concept_name)

        except Exception as e:
            print(f"Error generating intro Manim code: {e}")
            return self._generate_fallback_intro_manim(concept_name)

    async def clarify_text_with_gemini(self, text: str, context: str = "") -> str:
        """
        Use Gemini to answer questions about research papers with conversation context
        """
        if not self.client:
            return "Clarification service temporarily unavailable."

        try:
            # Determine if it's a question or text to clarify
            is_question = text.strip().endswith("?") or any(
                word in text.lower() for word in ["what", "how", "why", "when", "where", "explain", "describe", "tell me", "can you"]
            )
            
            if is_question:
                prompt = f"""You are a helpful assistant answering questions about a research paper. Use the context provided to give accurate, conversational answers.

Context about the paper:
{context}

User's question: "{text}"

Provide a helpful, conversational answer based on the paper content. If the answer isn't in the provided context, say so. Keep responses concise (2-4 sentences) but natural. No markdown formatting, just plain text. Reference previous conversation if relevant."""
            else:
                prompt = f"""Explain this research text in simple terms. Be concise and avoid markdown formatting.

Text: "{text}"
Context: {context}

Provide a clear, direct explanation in 2-3 sentences. No bullet points, no markdown formatting, just plain text explanation."""

            response = await self._call_gemini_api(prompt)
            return (
                response.strip()
                if response
                else "Unable to provide clarification at this time."
            )

        except Exception as e:
            print(f"Error in Gemini clarification: {e}")
            return "Unable to provide clarification at this time."

    async def generate_paper_summary(self, content: str, title: str = "") -> str:
        """
        Generate a concise summary of the research paper using Gemini
        """
        if not self.client:
            return "Summary generation temporarily unavailable."

        try:
            # Use more content for better summary (up to 8000 chars)
            content_preview = content[:8000]
            
            prompt = f"""Generate a clear, concise summary of this research paper. Write it as if you're explaining the paper to someone who wants to understand its main contributions.

Paper Title: {title}
Paper Content: {content_preview}

Write a summary that:
- Explains the main research question or problem addressed
- Describes the key methodology or approach
- Highlights the most important findings or contributions
- Is written in clear, accessible language
- Is 3-5 sentences long
- Does NOT include markdown formatting
- Does NOT repeat the title

Summary:"""

            response = await self._call_gemini_api(prompt)
            return (
                response.strip()[:1000]  # Limit to 1000 chars
                if response
                else "Unable to generate summary at this time."
            )

        except Exception as e:
            print(f"Error generating paper summary: {e}")
            return "Unable to generate summary at this time."

    async def extract_paper_metadata_with_gemini(self, content: str) -> Dict[str, Any]:
        """
        Use Gemini to intelligently extract paper title, authors, and generate summary
        """
        if not self.client:
            return {"title": "", "authors": [], "abstract": ""}

        try:
            prompt = f"""Extract the paper metadata from this research paper text. Be precise and accurate.

Text: {content[:3000]}

Please extract:
1. TITLE: The exact title of the research paper (not repeated or with "by")
2. AUTHORS: List of author names (first and last names)

Return in JSON format:
{{
    "title": "Exact Paper Title Here",
    "authors": ["Author One", "Author Two", "Author Three"]
}}

Rules:
- Title should be the actual paper title, not repeated
- Authors should be real names only, no affiliations
- If any field is unclear, use empty string or empty array

JSON:"""

            response = await self._call_gemini_api(prompt)

            if response:
                try:
                    # Try to parse JSON response
                    if "{{" in response and "}}" in response:
                        start = response.find("{{")
                        end = response.rfind("}}") + 1
                        json_str = response[start:end]
                        metadata = json.loads(json_str)

                        title = metadata.get("title", "")[:200]
                        authors = metadata.get("authors", [])[:5]  # Limit to 5 authors
                        
                        # Generate summary separately with more content
                        summary = await self.generate_paper_summary(content, title)

                        return {
                            "title": title,
                            "authors": authors,
                            "abstract": summary,  # Store summary as "abstract" for compatibility
                        }
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"JSON parsing failed for metadata: {e}")

                # Fallback to text parsing if JSON fails
                parsed = self._parse_metadata_from_text(response)
                # Generate summary even if JSON parsing failed
                if parsed.get("title"):
                    summary = await self.generate_paper_summary(content, parsed.get("title", ""))
                    parsed["abstract"] = summary
                return parsed

            return {"title": "", "authors": [], "abstract": ""}

        except Exception as e:
            print(f"Error in Gemini metadata extraction: {e}")
            return {"title": "", "authors": [], "abstract": ""}

    def _parse_metadata_from_text(self, text: str) -> Dict[str, Any]:
        """
        Fallback method to parse metadata from Gemini text response
        """
        metadata = {"title": "", "authors": [], "abstract": ""}

        lines = text.split("\n")
        current_field = None

        for line in lines:
            line = line.strip()
            if line.lower().startswith("title:"):
                metadata["title"] = line[6:].strip().strip('"')
            elif line.lower().startswith("authors:"):
                authors_text = line[8:].strip()
                if authors_text:
                    # Try to parse author list
                    authors = [a.strip().strip('"') for a in authors_text.split(",")]
                    metadata["authors"] = authors[:5]
            # Note: abstract/summary is now generated separately, not parsed

        return metadata

    async def _call_gemini_api(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        """
        Make async call to Gemini API with retry logic and exponential backoff
        """
        # Rate limiting: ensure minimum time between calls
        current_time = time.time()
        time_since_last_call = current_time - self.last_call_time
        if time_since_last_call < self.min_call_interval:
            await asyncio.sleep(self.min_call_interval - time_since_last_call)
        
        for attempt in range(max_retries):
            try:
                # Using the new google-genai client
                response = await asyncio.to_thread(
                    self.client.models.generate_content, model=self.model, contents=prompt
                )

                self.last_call_time = time.time()  # Update last call time on success

                if response and response.text:
                    print(f"Gemini API call successful: {len(response.text)} chars")
                    return response.text
                else:
                    print("Gemini API returned empty response")
                    return None

            except Exception as e:
                error_str = str(e).lower()
                is_rate_limit = (
                    "503" in str(e) 
                    or "unavailable" in error_str
                    or "rate limit" in error_str
                    or "quota" in error_str
                    or "overloaded" in error_str
                )
                
                if is_rate_limit and attempt < max_retries - 1:
                    # Exponential backoff: 1s, 2s, 4s, etc.
                    wait_time = 2 ** attempt
                    print(f"Gemini API rate limited (attempt {attempt + 1}/{max_retries}). Waiting {wait_time}s before retry...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    print(f"Gemini API call failed: {e}")
                    if attempt < max_retries - 1:
                        # For other errors, use shorter backoff
                        wait_time = 1 * (attempt + 1)
                        print(f"Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        return None
        
        return None

    def _extract_concepts_from_gemini_response(
        self, gemini_text: str, title: str
    ) -> List[Dict[str, Any]]:
        """Extract structured concepts from Gemini analysis response"""
        # Return empty list - we only want concepts from the JSON response now
        return []

    def _extract_insights_from_gemini_response(self, gemini_text: str) -> List[str]:
        """Extract key insights from Gemini analysis"""
        insights = []

        # Look for insight sections
        lines = gemini_text.split("\n")
        in_insights_section = False

        for line in lines:
            line = line.strip()
            if "insight" in line.lower() or "takeaway" in line.lower():
                in_insights_section = True
            elif in_insights_section and len(line) > 30:
                if line.startswith("-") or line.startswith("•") or line.startswith("*"):
                    insights.append(line[1:].strip())
                elif len(insights) < 5:
                    insights.append(line)

        if not insights:
            # Fallback to extracting meaningful sentences
            sentences = gemini_text.split(".")
            for sentence in sentences:
                sentence = sentence.strip()
                if len(sentence) > 40 and any(
                    word in sentence.lower()
                    for word in [
                        "significant",
                        "important",
                        "demonstrates",
                        "shows",
                        "reveals",
                        "contributes",
                    ]
                ):
                    insights.append(sentence + ".")
                    if len(insights) >= 4:
                        break

        return insights[:5]

    def _parse_gemini_concepts(self, gemini_text: str) -> List[Dict[str, Any]]:
        """Parse Gemini's concept response, try JSON first, fallback to text parsing"""
        try:
            # Try to parse as JSON
            if "[" in gemini_text and "]" in gemini_text:
                start = gemini_text.find("[")
                end = gemini_text.rfind("]") + 1
                json_str = gemini_text[start:end]
                concepts_data = json.loads(json_str)

                concepts = []
                for concept in concepts_data[
                    :3
                ]:  # Limit to 3 concepts for initial analysis
                    if isinstance(concept, dict) and "name" in concept:
                        concepts.append(
                            {
                                "name": concept.get("name", "")[:80],
                                "description": concept.get("description", "")[:400],
                                "importance_score": min(
                                    1.0,
                                    max(
                                        0.5, float(concept.get("importance_score", 0.8))
                                    ),
                                ),
                                "concept_type": concept.get(
                                    "concept_type", "conceptual"
                                ),
                            }
                        )

                if concepts:
                    return concepts

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"JSON parsing failed, using text parsing: {e}")

        # Fallback to text parsing similar to Claude method
        return self._extract_concepts_from_gemini_response(gemini_text, "")

    def _clean_manim_code(self, code_text: str, concept_name: str) -> str:
        """Clean and ensure valid Manim code"""
        # Remove markdown formatting
        code_text = code_text.replace("```python", "").replace("```", "")

        # Ensure we have a valid class name
        safe_name = "".join(c for c in concept_name.replace(" ", "") if c.isalnum())[
            :20
        ]
        if not safe_name or safe_name[0].isdigit():
            safe_name = "Concept" + safe_name if safe_name else "ConceptScene"

        # If no valid class found, create a simple one
        if "class " not in code_text or "Scene" not in code_text:
            return self._generate_fallback_manim_code(
                concept_name, "Key research concept"
            )

        return code_text

    def _generate_fallback_manim_code(
        self, concept_name: str, concept_description: str
    ) -> str:
        """Generate optimized, simple Manim code for fast, reliable rendering"""
        safe_name = "".join(c for c in concept_name.replace(" ", "") if c.isalnum())[
            :15
        ]
        if not safe_name or safe_name[0].isdigit():
            safe_name = "ConceptScene"

        # Keep concept name and description short for better rendering
        short_name = concept_name[:40] if len(concept_name) > 40 else concept_name
        short_desc = (
            concept_description[:80]
            if len(concept_description) > 80
            else concept_description
        )

        return f'''
class {safe_name}Scene(Scene):
    def construct(self):
        # Title - clean and simple
        title = Text("{short_name}", font_size=36, color=WHITE)
        title.to_edge(UP, buff=0.5)
        self.play(Write(title), run_time=1)
        self.wait(0.5)
        
        # Description - shorter for readability
        desc = Text(
            "{short_desc}",
            font_size=20,
            color=BLUE,
            line_spacing=1.2
        ).scale(0.8)
        desc.next_to(title, DOWN, buff=0.8)
        self.play(FadeIn(desc), run_time=1)
        self.wait(1)
        
        # Simple mathematical visualization
        equation = MathTex("f(x) = ax + b", font_size=48, color=YELLOW)
        equation.next_to(desc, DOWN, buff=1)
        self.play(Write(equation), run_time=1)
        self.wait(1)
        
        # Quick clean exit
        self.play(
            FadeOut(title, desc, equation),
            run_time=0.8
        )
        self.wait(0.2)
'''

    def _generate_fallback_intro_manim(self, concept_name: str) -> str:
        """Generate fallback intro Manim code"""
        return f'''
class IntroScene(Scene):
    def construct(self):
        # Title
        title = Text("{concept_name[:50]}", font_size=48)
        title.to_edge(UP)
        self.play(Write(title))
        self.wait(2)
        
        # Fade out
        self.play(FadeOut(title))
        self.wait(1)
'''

    async def generate_python_implementation(
        self, concept_name: str, concept_description: str
    ) -> str:
        """
        Generate a practical Python implementation for a given concept.
        """
        if not self.client:
            return "# Code generation service temporarily unavailable."

        try:
            prompt = f'''
Your task is to write a **single, concise** Python script that demonstrates the concept of "{concept_name}".

**Concept Description:** {concept_description}

**Requirements:**
1.  **Single Script:** You must generate only one Python script. Do not provide multiple alternatives.
2.  **Concise:** The implementation should be clear, practical, and not overly long.
3.  **Runnable:** The script must be a complete, runnable Python file.
4.  **Comments:** Keep comments brief and to the point.
5.  **Example Usage:** Include a simple `if __name__ == "__main__":` block to show how the code is used.
6.  **Standard Libraries:** Use only standard Python libraries.
7.  **Raw Code Only:** Your final output must be only the raw Python code, with no markdown formatting or explanations outside of the code's comments.
'''

            response = await self._call_gemini_api(prompt)

            if response:
                # Clean the response to ensure it's just the code
                if "```python" in response:
                    response = response.split("```python")[1].split("```")[0]
                elif "```" in response:
                    response = response.split("```")[1].split("```")[0]
                return response.strip()
            else:
                return "# Unable to generate code at this time."

        except Exception as e:
            print(f"Error in Python code generation: {e}")
            return f"# An error occurred: {e}"

    async def _fallback_analysis(self, content: str, title: str) -> Dict[str, Any]:
        """Fallback analysis when API fails - provide some basic concepts"""
        print(f"Using fallback analysis for: {title}")

        # Generate some basic concepts based on common research paper patterns
        basic_concepts = []
        content_lower = content.lower()

        # Look for common technical terms
        if "neural network" in content_lower or "deep learning" in content_lower:
            basic_concepts.append(
                {
                    "name": "Neural Network Architecture",
                    "description": "The paper discusses neural network models and deep learning approaches",
                    "importance_score": 0.8,
                }
            )

        if "algorithm" in content_lower:
            basic_concepts.append(
                {
                    "name": "Algorithmic Approach",
                    "description": "The research presents or utilizes specific algorithms",
                    "importance_score": 0.7,
                }
            )

        if "model" in content_lower and "training" in content_lower:
            basic_concepts.append(
                {
                    "name": "Model Training",
                    "description": "The paper covers model training methodologies and techniques",
                    "importance_score": 0.6,
                }
            )

        # Ensure we have at least one concept
        if not basic_concepts:
            basic_concepts.append(
                {
                    "name": "Research Methodology",
                    "description": f"Core methodology and approach presented in {title}",
                    "importance_score": 0.7,
                }
            )

        return {
            "concepts": basic_concepts[:3],  # Limit to 3 concepts for initial analysis
            "insights": [
                "Basic analysis completed. For better results, check Gemini API connection."
            ],
            "methodology": "Fallback Analysis",
            "full_analysis": f"Fallback analysis completed for '{title}'",
        }

    async def _fallback_concept_extraction(self, content: str) -> List[Dict[str, Any]]:
        """Fallback concept extraction - generate one basic concept"""
        print("Using fallback concept extraction")
        return [
            {
                "name": "Additional Research Concept",
                "description": "An additional concept identified from the research paper",
                "importance_score": 0.6,
            }
        ]

    async def _fallback_additional_concept(
        self, timestamp: int = None
    ) -> Dict[str, Any]:
        """Fallback for when additional concept generation fails - make it unique each time"""
        print("Using fallback additional concept")

        import time

        if timestamp is None:
            timestamp = int(time.time())

        # Generate varied fallback concepts to ensure uniqueness
        fallback_concepts = [
            {
                "name": "Research Implementation Details",
                "description": "Specific implementation aspects and technical details of the research methodology",
                "importance_score": 0.6,
                "concept_type": "technical",
            },
            {
                "name": "Experimental Design Framework",
                "description": "The underlying framework and design principles used in the experimental approach",
                "importance_score": 0.7,
                "concept_type": "methodological",
            },
            {
                "name": "Technical Analysis Method",
                "description": "The analytical methodology and technical approach employed in this research",
                "importance_score": 0.6,
                "concept_type": "technical",
            },
            {
                "name": "Data Processing Technique",
                "description": "The specific data processing and analysis techniques utilized in the study",
                "importance_score": 0.6,
                "concept_type": "methodological",
            },
            {
                "name": "Statistical Evaluation Approach",
                "description": "The statistical methods and evaluation criteria used to assess the research results",
                "importance_score": 0.6,
                "concept_type": "mathematical",
            },
            {
                "name": "Performance Optimization Strategy",
                "description": "Techniques and strategies employed to optimize system or model performance",
                "importance_score": 0.7,
                "concept_type": "technical",
            },
        ]

        # Use timestamp to select different fallback each time
        selected = fallback_concepts[timestamp % len(fallback_concepts)]
        print(f"Selected fallback concept: {selected['name']}")
        return selected
