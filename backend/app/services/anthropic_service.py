"""
Anthropic Claude API service for high-quality research paper analysis
"""
import os
import asyncio
from typing import Dict, List, Any, Optional
import httpx
from ..core.config import settings

class AnthropicService:
    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.base_url = "https://api.anthropic.com/v1/messages"
        self.timeout = 60.0
        
        if not self.api_key:
            print("Warning: ANTHROPIC_API_KEY not set. Using fallback service.")
    
    async def analyze_paper_with_claude(self, content: str, title: str = "") -> Dict[str, Any]:
        """
        Use Anthropic Claude for comprehensive paper analysis
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01"
                }
                
                payload = {
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 2000,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"""As a research expert, analyze this academic paper thoroughly and provide comprehensive insights.

Paper Title: {title}
Content: {content[:6000]}

Please provide a detailed analysis with:

1. RESEARCH CONTRIBUTIONS: What are the main contributions and novelty of this work?

2. KEY TECHNICAL CONCEPTS: Identify 4-5 core technical concepts that are essential to understanding this paper. For each concept, provide:
   - A clear, descriptive name (not generic like "Concept 1")
   - A detailed explanation of what it means and why it's important
   - Its significance to the overall research

3. METHODOLOGY SUMMARY: What research methods and approaches were used?

4. KEY INSIGHTS: What are the 3-4 most important takeaways from this research?

5. TECHNICAL DEPTH: What mathematical models, algorithms, or technical innovations are presented?

Please be specific, technical, and provide meaningful analysis rather than generic summaries."""
                        }
                    ]
                }
                
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content_text = result["content"][0]["text"]
                    print(f"✓ Claude analysis successful: {len(content_text)} chars")
                    
                    # Extract structured data from Claude's response
                    concepts = self._extract_concepts_from_claude_response(content_text, title)
                    insights = self._extract_insights_from_claude_response(content_text)
                    
                    return {
                        "concepts": concepts,
                        "insights": insights,
                        "methodology": "Anthropic Claude 3.5 Sonnet Analysis",
                        "full_analysis": content_text
                    }
                else:
                    print(f"✗ Claude API error: {response.status_code} - {response.text}")
                    return await self._fallback_analysis(content, title)
                    
        except Exception as e:
            print(f"✗ Error in Claude analysis: {e}")
            return await self._fallback_analysis(content, title)
    
    async def generate_concepts_with_claude(self, content: str) -> List[Dict[str, Any]]:
        """
        Use Claude for high-quality concept extraction
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01"
                }
                
                payload = {
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 1500,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"""As a research expert, extract 4-5 key technical concepts from this research paper. Focus on the most important technical contributions, methodologies, and innovations.

Research text: {content[:5000]}

For each concept, provide:
1. CONCEPT NAME: A specific, descriptive name (not generic like "Concept 1")
2. DETAILED EXPLANATION: 2-3 sentences explaining what this concept means, why it's important, and how it contributes to the research
3. IMPORTANCE SCORE: A score from 0.6 to 1.0 indicating how critical this concept is to understanding the paper

Examples of good concept names:
- "Transformer Self-Attention Mechanism"
- "Positional Encoding in Neural Networks"
- "Multi-Head Attention Architecture"
- "Encoder-Decoder Framework"

Format your response as:

**Concept 1: [Specific Name]**
Explanation: [Detailed explanation]
Importance: [0.X]

**Concept 2: [Specific Name]**
Explanation: [Detailed explanation]
Importance: [0.X]

Continue for all concepts..."""
                        }
                    ]
                }
                
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content_text = result["content"][0]["text"]
                    print(f"✓ Claude concept extraction successful: {len(content_text)} chars")
                    
                    # Parse the Claude response into structured concepts
                    concepts = self._parse_claude_concepts(content_text)
                    
                    return concepts if concepts else await self._fallback_concept_extraction(content)
                else:
                    print(f"✗ Claude concept extraction error: {response.status_code}")
                    return await self._fallback_concept_extraction(content)
                    
        except Exception as e:
            print(f"✗ Error in Claude concept extraction: {e}")
            return await self._fallback_concept_extraction(content)
    
    async def generate_manim_code_with_claude(self, concept_name: str, concept_description: str, paper_title: str = "") -> str:
        """
        Generate high-quality Manim code using Claude
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01"
                }
                
                payload = {
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 2000,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"""Create a professional Manim animation script for this concept from a research paper:

Paper: {paper_title}
Concept: {concept_name}
Description: {concept_description}

Requirements:
1. Create a Scene class that inherits from Scene
2. Use clear, educational animations that explain the concept step by step
3. Include smooth transitions and appropriate timing
4. Use colors effectively (BLUE, YELLOW, GREEN, RED, etc.)
5. Make it engaging and informative like 3Blue1Brown videos
6. Duration: 10-15 seconds
7. Include text explanations and visual demonstrations

The code should:
- Start with a clear title
- Explain the concept visually
- Use mathematical objects, diagrams, or animations where appropriate
- End with a summary or key takeaway

Please provide ONLY the Python class code, no markdown formatting."""
                        }
                    ]
                }
                
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content_text = result["content"][0]["text"]
                    print(f"✓ Claude Manim code generation successful for: {concept_name}")
                    
                    # Clean up the code to ensure it's valid Python
                    clean_code = self._clean_manim_code(content_text, concept_name)
                    return clean_code
                else:
                    print(f"✗ Claude Manim generation error: {response.status_code}")
                    return self._generate_fallback_manim_code(concept_name, concept_description)
                    
        except Exception as e:
            print(f"✗ Error in Claude Manim generation: {e}")
            return self._generate_fallback_manim_code(concept_name, concept_description)
    
    async def generate_intro_manim_code(self, paper_title: str, abstract: str = "") -> str:
        """
        Generate high-quality introduction Manim code using Claude
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "x-api-key": self.api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01"
                }
                
                payload = {
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 2000,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"""Create a professional Manim animation script for introducing a research paper:

Paper Title: {paper_title}
Abstract Summary: {abstract[:500] if abstract else "Research paper introduction"}

Requirements:
1. Create an IntroScene class that inherits from Scene
2. Create an engaging introduction with:
   - Animated title reveal
   - Brief paper context
   - Visual elements that represent research/academia
   - Smooth transitions and professional styling
3. Use colors effectively (BLUE for title, WHITE for text, YELLOW/GREEN for highlights)
4. Duration: 8-12 seconds
5. Include mathematical or academic visual elements if appropriate
6. Make it polished like academic presentation videos

The animation should:
- Start with a clean title presentation
- Add contextual elements about the research domain
- Use geometric shapes, arrows, or academic symbols
- End with a transition cue

Please provide ONLY the Python class code, no markdown formatting."""
                        }
                    ]
                }
                
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content_text = result["content"][0]["text"]
                    print(f"✓ Claude intro Manim generation successful for: {paper_title[:50]}")
                    
                    # Clean up the code to ensure it's valid Python
                    clean_code = self._clean_intro_manim_code(content_text, paper_title)
                    return clean_code
                else:
                    print(f"✗ Claude intro generation error: {response.status_code}")
                    return self._generate_fallback_intro_code(paper_title)
                    
        except Exception as e:
            print(f"✗ Error in Claude intro generation: {e}")
            return self._generate_fallback_intro_code(paper_title)
    
    def _clean_intro_manim_code(self, code_text: str, paper_title: str) -> str:
        """Clean and ensure valid intro Manim code"""
        # Remove markdown formatting
        code_text = code_text.replace('```python', '').replace('```', '')
        
        # If no valid class found, create a sophisticated intro
        if 'class ' not in code_text or 'Scene' not in code_text:
            return self._generate_fallback_intro_code(paper_title)
        
        return code_text
    
    def _generate_fallback_intro_code(self, paper_title: str) -> str:
        """Generate high-quality fallback intro code"""
        return f"""
class IntroScene(Scene):
    def construct(self):
        # Title Animation
        title = Text("{paper_title[:50]}", font_size=32, color=BLUE, weight=BOLD)
        title.to_edge(UP, buff=1)
        
        # Subtitle
        subtitle = Text("Research Paper Analysis", font_size=20, color=WHITE)
        subtitle.next_to(title, DOWN, buff=0.5)
        
        # Academic elements
        left_line = Line(start=LEFT*3, end=LEFT*1, color=YELLOW, stroke_width=3)
        right_line = Line(start=RIGHT*1, end=RIGHT*3, color=YELLOW, stroke_width=3)
        left_line.next_to(title, DOWN, buff=1.5)
        right_line.next_to(title, DOWN, buff=1.5)
        
        # Research icon (simple representation)
        research_symbol = Circle(radius=0.5, color=GREEN, fill_opacity=0.3)
        research_symbol.next_to(subtitle, DOWN, buff=1)
        
        # Animation sequence
        self.play(Write(title), run_time=2)
        self.wait(0.5)
        self.play(Write(subtitle), run_time=1.5)
        self.wait(0.5)
        self.play(Create(left_line), Create(right_line), run_time=1.5)
        self.play(Create(research_symbol), run_time=1)
        self.wait(1)
        
        # Transition out
        self.play(
            FadeOut(title), FadeOut(subtitle),
            FadeOut(left_line), FadeOut(right_line),
            FadeOut(research_symbol),
            run_time=1.5
        )
"""
    
    def _extract_concepts_from_claude_response(self, claude_text: str, title: str) -> List[Dict[str, Any]]:
        """Extract structured concepts from Claude analysis response"""
        concepts = []
        
        # Look for sections that mention technical concepts
        lines = claude_text.split('\n')
        current_concept = {}
        
        for line in lines:
            line = line.strip()
            if any(keyword in line.lower() for keyword in ['technical concept', 'key concept', 'main concept', 'concept:']):
                if current_concept and current_concept.get('name'):
                    concepts.append(current_concept)
                    current_concept = {}
                
                # Extract concept name and description
                if ':' in line:
                    name = line.split(':')[1].strip()
                    name = name.replace('*', '').replace('#', '').strip()[:60]
                else:
                    name = line.replace('*', '').replace('#', '').strip()[:60]
                
                current_concept = {
                    "name": name or f"Key Concept from {title[:30]}",
                    "description": "",
                    "importance_score": 0.85
                }
            elif current_concept and len(line) > 20:
                # Add to description
                if not current_concept["description"]:
                    current_concept["description"] = line[:300]
                elif len(current_concept["description"]) < 200:
                    current_concept["description"] += " " + line[:200]
        
        # Add the last concept
        if current_concept and current_concept.get('name'):
            concepts.append(current_concept)
        
        # Ensure we have meaningful concepts
        if len(concepts) < 3:
            # Extract from different sections
            concepts.extend([
                {
                    "name": "Primary Research Innovation",
                    "description": "The main technical innovation or contribution presented in this research paper.",
                    "importance_score": 0.95
                },
                {
                    "name": "Methodological Approach",
                    "description": "The research methodology and experimental approach used in this study.",
                    "importance_score": 0.8
                }
            ])
        
        return concepts[:5]
    
    def _extract_insights_from_claude_response(self, claude_text: str) -> List[str]:
        """Extract key insights from Claude analysis"""
        insights = []
        
        # Look for insight sections
        lines = claude_text.split('\n')
        in_insights_section = False
        
        for line in lines:
            line = line.strip()
            if 'insight' in line.lower() or 'takeaway' in line.lower():
                in_insights_section = True
            elif in_insights_section and len(line) > 30:
                if line.startswith('-') or line.startswith('•') or line.startswith('*'):
                    insights.append(line[1:].strip())
                elif len(insights) < 5:
                    insights.append(line)
        
        if not insights:
            # Fallback to extracting meaningful sentences
            sentences = claude_text.split('.')
            for sentence in sentences:
                sentence = sentence.strip()
                if len(sentence) > 40 and any(word in sentence.lower() for word in 
                    ['significant', 'important', 'demonstrates', 'shows', 'reveals', 'contributes']):
                    insights.append(sentence + ".")
                    if len(insights) >= 4:
                        break
        
        return insights[:5]
    
    def _parse_claude_concepts(self, claude_text: str) -> List[Dict[str, Any]]:
        """Parse Claude's structured concept response"""
        concepts = []
        
        # Split by concept markers
        concept_blocks = []
        current_block = ""
        
        for line in claude_text.split('\n'):
            if line.strip().startswith('**Concept') and ':' in line:
                if current_block:
                    concept_blocks.append(current_block)
                current_block = line + '\n'
            else:
                current_block += line + '\n'
        
        if current_block:
            concept_blocks.append(current_block)
        
        for i, block in enumerate(concept_blocks[:5]):
            try:
                # Extract name
                name_line = [line for line in block.split('\n') if line.startswith('**Concept')][0]
                name = name_line.split(':', 1)[1].replace('**', '').strip()
                
                # Extract explanation
                explanation_lines = [line for line in block.split('\n') if line.startswith('Explanation:')]
                explanation = explanation_lines[0].replace('Explanation:', '').strip() if explanation_lines else ""
                
                # Extract importance
                importance_lines = [line for line in block.split('\n') if line.startswith('Importance:')]
                importance_str = importance_lines[0].replace('Importance:', '').strip() if importance_lines else "0.8"
                
                try:
                    importance = float(importance_str)
                except:
                    importance = 0.8 - (i * 0.05)
                
                if name and explanation:
                    concepts.append({
                        "name": name[:80],
                        "description": explanation[:400],
                        "importance_score": min(1.0, max(0.5, importance)),
                        "mathematical_visualization": True
                    })
            except Exception as e:
                print(f"Error parsing concept block {i}: {e}")
                continue
        
        return concepts
    
    def _clean_manim_code(self, code_text: str, concept_name: str) -> str:
        """Clean and ensure valid Manim code"""
        # Remove markdown formatting
        code_text = code_text.replace('```python', '').replace('```', '')
        
        # Ensure we have a valid class name
        safe_name = ''.join(c for c in concept_name.replace(' ', '') if c.isalnum())[:20]
        if not safe_name or safe_name[0].isdigit():
            safe_name = "Concept" + safe_name if safe_name else "ConceptScene"
        
        # If no valid class found, create a simple one
        if 'class ' not in code_text or 'Scene' not in code_text:
            return f"""
class {safe_name}Scene(Scene):
    def construct(self):
        title = Text("{concept_name}", font_size=36, color=BLUE)
        title.to_edge(UP)
        self.play(Write(title), run_time=2)
        self.wait(1)
        
        subtitle = Text("Key Research Concept", font_size=24, color=WHITE)
        subtitle.next_to(title, DOWN, buff=0.5)
        self.play(Write(subtitle), run_time=1.5)
        self.wait(2)
        
        # Visual element
        circle = Circle(radius=1.5, color=YELLOW, fill_opacity=0.3)
        self.play(Create(circle), run_time=2)
        self.wait(1)
        
        conclusion = Text("Concept Explained", font_size=28, color=GREEN)
        conclusion.to_edge(DOWN)
        self.play(Write(conclusion), run_time=2)
        self.wait(2)
        
        self.play(FadeOut(title), FadeOut(subtitle), FadeOut(circle), FadeOut(conclusion))
"""
        
        return code_text
    
    def _generate_fallback_manim_code(self, concept_name: str, concept_description: str) -> str:
        """Generate simple fallback Manim code"""
        safe_name = ''.join(c for c in concept_name.replace(' ', '') if c.isalnum())[:15]
        if not safe_name or safe_name[0].isdigit():
            safe_name = "Concept" + safe_name if safe_name else "ConceptScene"
        
        return f"""
class {safe_name}Scene(Scene):
    def construct(self):
        title = Text("{concept_name[:40]}", font_size=36, color=BLUE)
        title.to_edge(UP)
        self.play(Write(title), run_time=2)
        self.wait(1)
        
        description = Text("{concept_description[:80]}...", font_size=20, color=WHITE)
        description.next_to(title, DOWN, buff=1)
        self.play(Write(description), run_time=2)
        self.wait(3)
        
        self.play(FadeOut(title), FadeOut(description))
"""
    
    async def _fallback_analysis(self, content: str, title: str) -> Dict[str, Any]:
        """Fallback analysis when API fails"""
        return {
            "concepts": [
                {
                    "name": f"Primary Focus: {title[:50]}",
                    "description": "Main research focus and contribution of this paper.",
                    "importance_score": 0.9
                }
            ],
            "insights": ["Analysis temporarily unavailable. Please try again."],
            "methodology": "Fallback Analysis",
            "full_analysis": f"Paper analysis for '{title}' is temporarily unavailable."
        }
    
    async def _fallback_concept_extraction(self, content: str) -> List[Dict[str, Any]]:
        """Fallback concept extraction"""
        return [
            {
                "name": "Research Methodology",
                "description": "The methodological approach used in this research study.",
                "importance_score": 0.8,
                "mathematical_visualization": True
            }
        ]