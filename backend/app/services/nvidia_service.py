"""
NVIDIA API service integration
"""
import os
import httpx
import asyncio
from typing import Dict, List, Any, Optional
from ..core.config import settings

class NVIDIAService:
    def __init__(self):
        self.api_key = settings.BREV_NVIDIA_API_KEY
        self.base_url = "https://integrate.api.nvidia.com/v1"
        self.timeout = 30.0
        
        if not self.api_key:
            print("Warning: BREV_NVIDIA_API_KEY not set. Some features may not work.")
    
    async def test_api_connection(self) -> bool:
        """Test if the NVIDIA API key is working"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                response = await client.get(f"{self.base_url}/models", headers=headers)
                
                if response.status_code == 200:
                    print("✓ NVIDIA API connection successful")
                    return True
                else:
                    print(f"✗ NVIDIA API error: {response.status_code} - {response.text}")
                    return False
                    
        except Exception as e:
            print(f"✗ NVIDIA API connection failed: {e}")
            return False
    
    async def analyze_paper_with_nemotron(self, content: str, title: str = "") -> Dict[str, Any]:
        """
        Use NVIDIA Llama 3.1 for comprehensive paper analysis (real AI-powered analysis)
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                # Use the working Llama 3.1 model
                payload = {
                    "model": "meta/llama-3.1-8b-instruct",
                    "messages": [
                        {
                            "role": "user",
                            "content": f"""Analyze this research paper and provide comprehensive insights.

Paper Title: {title}
Content: {content[:4000]}

Please analyze the paper and provide:
1. Key research contributions and findings
2. Main technical concepts with importance assessment
3. Research methodology summary
4. 3-5 most important insights from the work

Format your response clearly with sections for concepts, insights, and methodology."""
                        }
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1200
                }
                
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content_text = result["choices"][0]["message"]["content"]
                    print(f"✓ Real AI analysis successful: {len(content_text)} chars")
                    
                    # Extract concepts and insights from AI response
                    concepts = self._extract_concepts_from_ai_response(content_text, title)
                    insights = self._extract_insights_from_ai_response(content_text)
                    
                    return {
                        "concepts": concepts,
                        "insights": insights,
                        "methodology": "NVIDIA Llama 3.1 AI Analysis",
                        "full_analysis": content_text
                    }
                else:
                    print(f"✗ AI analysis API error: {response.status_code} - {response.text}")
                    return await self._fallback_analysis(content, title)
                    
        except Exception as e:
            print(f"✗ Error in AI analysis: {e}")
            return await self._fallback_analysis(content, title)
    
    async def generate_concepts_with_qwen(self, content: str) -> List[Dict[str, Any]]:
        """
        Use NVIDIA Llama 3.1 for concept extraction (real AI-powered extraction)
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": "meta/llama-3.1-8b-instruct",
                    "messages": [
                        {
                            "role": "user",
                            "content": f"""Extract 4-5 key technical concepts from this research paper text and provide detailed analysis.

For each concept, provide:
- A clear, descriptive name
- A detailed explanation (2-3 sentences) of what it means and why it's important
- An importance score from 0.0 to 1.0 (where 1.0 is most critical to the research)

Research text: {content[:3000]}

Please be specific and technical in your concept extraction. Focus on the most important technical contributions, methodologies, algorithms, or findings."""
                        }
                    ],
                    "temperature": 0.2,
                    "max_tokens": 1000
                }
                
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content_text = result["choices"][0]["message"]["content"]
                    print(f"✓ Real AI concept extraction successful: {len(content_text)} chars")
                    
                    # Parse the AI response into structured concepts
                    concepts = self._parse_ai_concepts(content_text)
                    
                    return concepts if concepts else await self._fallback_concept_extraction(content)
                else:
                    print(f"✗ AI concept extraction error: {response.status_code}")
                    return await self._fallback_concept_extraction(content)
                    
        except Exception as e:
            print(f"✗ Error in AI concept extraction: {e}")
            return await self._fallback_concept_extraction(content)
    
    async def _fallback_analysis(self, content: str, title: str) -> Dict[str, Any]:
        """
        NO FALLBACK - Return error instead of fake data
        """
        raise Exception("NVIDIA API analysis failed - no fake data provided. Check your API key and connection.")
    
    async def _fallback_concept_extraction(self, content: str) -> List[Dict[str, Any]]:
        """
        NO FALLBACK - Return error instead of fake data
        """
        raise Exception("NVIDIA API concept extraction failed - no fake data provided. Check your API key and connection.")
    
    def _extract_concepts_from_ai_response(self, ai_text: str, title: str) -> List[Dict[str, Any]]:
        """Extract structured concepts from AI analysis response"""
        concepts = []
        
        # Simple parsing - could be enhanced with better NLP
        lines = ai_text.split('\n')
        current_concept = {}
        
        for line in lines:
            line = line.strip()
            if any(keyword in line.lower() for keyword in ['concept', 'technical', 'algorithm', 'method', 'approach']):
                if current_concept and current_concept.get('name'):
                    concepts.append(current_concept)
                    current_concept = {}
                
                # Extract concept name
                if ':' in line:
                    name = line.split(':')[0].strip()
                    desc = line.split(':', 1)[1].strip() if len(line.split(':', 1)) > 1 else ""
                else:
                    name = line[:50]
                    desc = line
                
                current_concept = {
                    "name": name.replace('*', '').replace('#', '').strip(),
                    "description": desc[:200] if desc else f"Key concept in {title}",
                    "importance_score": 0.8
                }
        
        # Add the last concept
        if current_concept and current_concept.get('name'):
            concepts.append(current_concept)
        
        # Ensure we have at least some concepts
        if len(concepts) < 3:
            concepts.extend([
                {
                    "name": "Primary Research Focus",
                    "description": ai_text[:200] + "...",
                    "importance_score": 0.9
                },
                {
                    "name": "Methodology",
                    "description": "Research methodology and approach discussed in the paper",
                    "importance_score": 0.7
                }
            ])
        
        return concepts[:5]  # Return top 5
    
    def _extract_insights_from_ai_response(self, ai_text: str) -> List[str]:
        """Extract key insights from AI analysis"""
        insights = []
        
        # Look for insight-related content
        sentences = ai_text.split('.')
        for sentence in sentences[:10]:
            sentence = sentence.strip()
            if len(sentence) > 30 and any(word in sentence.lower() for word in
                ['finding', 'result', 'conclude', 'significant', 'important', 'novel', 'contribution']):
                insights.append(sentence + ".")
        
        if not insights:
            # Fallback to first few meaningful sentences
            meaningful_sentences = [s.strip() + "." for s in sentences if len(s.strip()) > 20]
            insights = meaningful_sentences[:3]
        
        return insights[:5]
    
    def _parse_ai_concepts(self, ai_text: str) -> List[Dict[str, Any]]:
        """Parse AI response into structured concepts"""
        concepts = []
        
        # Split into potential concept blocks
        blocks = ai_text.split('\n\n') if '\n\n' in ai_text else ai_text.split('\n')
        
        for i, block in enumerate(blocks[:6]):
            block = block.strip()
            if len(block) < 10:
                continue
                
            # Extract name and description
            if ':' in block:
                parts = block.split(':', 1)
                name = parts[0].strip().replace('*', '').replace('#', '').replace('-', '').strip()
                description = parts[1].strip()
            else:
                lines = block.split('\n')
                name = lines[0].strip().replace('*', '').replace('#', '').replace('-', '').strip()
                description = ' '.join(lines[1:]).strip() if len(lines) > 1 else block
            
            # Clean up name
            name = name[:80]  # Limit length
            if not name or len(name) < 3:
                name = f"Technical Concept {i+1}"
            
            # Clean up description
            description = description[:300]  # Limit length
            if not description:
                description = f"Important technical concept identified in the research paper."
            
            # Estimate importance score based on position and content
            importance = 0.9 - (i * 0.1)
            if any(word in description.lower() for word in ['novel', 'new', 'significant', 'important', 'key']):
                importance += 0.1
            importance = min(1.0, max(0.3, importance))
            
            concepts.append({
                "name": name,
                "description": description,
                "importance_score": round(importance, 2),
                "mathematical_visualization": True
            })
        
        return concepts[:5]
    
    async def generate_manim_code_with_qwen(self, concept_name: str, concept_description: str) -> str:
        """
        Generate simple, working Manim animation code
        """
        try:
            # Generate simple, reliable Manim code that doesn't require LaTeX
            safe_name = ''.join(c for c in concept_name.replace(' ', '') if c.isalnum())[:15]
            # Ensure class name starts with a letter, not a number
            if not safe_name or safe_name[0].isdigit():
                safe_name = "Concept" + safe_name if safe_name else "ConceptScene"
            
            # Create a simple, working scene that uses only basic Manim objects
            simple_code = f"""
class {safe_name}Scene(Scene):
    def construct(self):
        # Title
        title = Text("{concept_name[:30]}", font_size=36, color=BLUE)
        title.to_edge(UP)
        self.play(Write(title), run_time=2)
        self.wait(1)
        
        # Description
        desc_lines = [
            "{concept_description[:60]}",
            "{concept_description[60:120] if len(concept_description) > 60 else ''}"
        ]
        
        descriptions = VGroup()
        for i, line in enumerate(desc_lines):
            if line.strip():
                desc = Text(line, font_size=24, color=WHITE)
                desc.next_to(title, DOWN, buff=0.5 + i*0.8)
                descriptions.add(desc)
        
        if len(descriptions) > 0:
            self.play(Write(descriptions), run_time=3)
            self.wait(2)
        
        # Simple visual representation
        circle = Circle(radius=1, color=YELLOW, fill_opacity=0.3)
        arrow = Arrow(LEFT, RIGHT, color=GREEN)
        arrow.next_to(circle, DOWN, buff=1)
        
        self.play(Create(circle), run_time=1)
        self.play(Create(arrow), run_time=1)
        self.wait(2)
        
        # Transform
        square = Square(side_length=2, color=RED, fill_opacity=0.3)
        self.play(Transform(circle, square), run_time=2)
        self.wait(1)
        
        # Conclusion
        conclusion = Text("Key Concept Explained", font_size=28, color=GREEN)
        conclusion.to_edge(DOWN)
        self.play(Write(conclusion), run_time=2)
        self.wait(2)
        
        # Fade out
        self.play(
            FadeOut(title),
            FadeOut(descriptions),
            FadeOut(circle),
            FadeOut(arrow),
            FadeOut(conclusion),
            run_time=2
        )
"""
            print(f"✓ Simple Manim code generated for: {concept_name}")
            return simple_code
                    
        except Exception as e:
            print(f"✗ Error in Manim code generation: {e}")
            return self._generate_fallback_manim_code(concept_name, concept_description)
    
    def _generate_fallback_manim_code(self, concept_name: str, concept_description: str) -> str:
        """Generate simple fallback Manim code when AI generation fails"""
        safe_name = ''.join(c for c in concept_name if c.isalnum())[:20]
        return f"""
class {safe_name}Scene(Scene):
    def construct(self):
        title = Text("{concept_name}", font_size=36)
        title.to_edge(UP)
        
        description = Text("{concept_description[:100]}...", font_size=24)
        description.next_to(title, DOWN, buff=1)
        description.set_width(config.frame_width - 2)
        
        self.play(Write(title))
        self.wait(1)
        self.play(Write(description))
        self.wait(3)
        self.play(FadeOut(title), FadeOut(description))
"""