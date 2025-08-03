"""
PDF parsing service using pdfplumber
Extracts text, metadata, and structure from research papers
"""
import pdfplumber
import re
from typing import Dict, List, Tuple, Optional
from pathlib import Path

class PDFParser:
    def __init__(self):
        pass
    
    async def parse_pdf(self, file_path: str) -> Dict[str, any]:
        """
        Parse PDF file and extract content, metadata, and structure
        """
        try:
            # Open PDF document
            with pdfplumber.open(file_path) as pdf:
                # Extract metadata
                metadata = pdf.metadata or {}
                
                # Extract text content
                full_text = ""
                page_texts = []
                
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    page_texts.append(page_text)
                    full_text += page_text + "\n"
            
            # Extract title, authors, and abstract
            title, authors, abstract = self._extract_paper_metadata(full_text, metadata)
            
            # Clean the full text
            cleaned_text = self._clean_text(full_text)
            
            return {
                "title": title,
                "authors": authors,
                "abstract": abstract,
                "content": cleaned_text,
                "page_count": len(page_texts),
                "metadata": metadata,
                "success": True
            }
            
        except Exception as e:
            print(f"✗ Error parsing PDF: {e}")
            return {
                "title": "",
                "authors": [],
                "abstract": "",
                "content": "",
                "page_count": 0,
                "metadata": {},
                "success": False,
                "error": str(e)
            }
    
    def _extract_paper_metadata(self, text: str, pdf_metadata: dict) -> Tuple[str, List[str], str]:
        """
        Extract title, authors, and abstract from paper text
        """
        lines = text.split('\n')
        clean_lines = [line.strip() for line in lines if line.strip()]
        
        # Extract title - usually one of the first few substantial lines
        title = ""
        if pdf_metadata.get('Title'):
            title = pdf_metadata['Title']
        elif pdf_metadata.get('title'):
            title = pdf_metadata['title']
        else:
            # Look for title in first 10 lines
            for line in clean_lines[:10]:
                if len(line) > 20 and len(line) < 200:
                    # Skip common headers/footers
                    if not any(skip in line.lower() for skip in ['page', 'doi:', 'arxiv:', 'abstract', 'introduction']):
                        title = line
                        break
        
        # Extract authors
        authors = []
        if pdf_metadata.get('Author'):
            authors = [pdf_metadata['Author']]
        elif pdf_metadata.get('author'):
            authors = [pdf_metadata['author']]
        else:
            # Look for author patterns in first 20 lines
            for i, line in enumerate(clean_lines[:20]):
                if self._looks_like_authors(line):
                    authors = self._parse_authors(line)
                    break
        
        # Extract abstract
        abstract = ""
        abstract_start = -1
        
        # Find abstract section
        for i, line in enumerate(clean_lines):
            if line.lower().startswith('abstract'):
                abstract_start = i
                break
        
        if abstract_start > -1:
            # Extract abstract content
            abstract_lines = []
            for i in range(abstract_start + 1, min(abstract_start + 20, len(clean_lines))):
                line = clean_lines[i]
                # Stop at next section
                if any(section in line.lower() for section in ['introduction', '1.', 'keywords', 'index terms']):
                    break
                if len(line) > 10:
                    abstract_lines.append(line)
            
            abstract = ' '.join(abstract_lines)[:500]  # Limit abstract length
        
        return title, authors, abstract
    
    def _looks_like_authors(self, line: str) -> bool:
        """
        Check if a line looks like it contains author names
        """
        # Common patterns for author lines
        author_patterns = [
            r'\b[A-Z][a-z]+ [A-Z][a-z]+\b',  # First Last
            r'\b[A-Z]\. [A-Z][a-z]+\b',      # F. Last
            r'\b[A-Z][a-z]+, [A-Z][a-z]+\b', # Last, First
        ]
        
        for pattern in author_patterns:
            if re.search(pattern, line):
                return True
        
        return False
    
    def _parse_authors(self, author_line: str) -> List[str]:
        """
        Parse author names from a line
        """
        # Common separators
        separators = [',', ' and ', '&', ';']
        
        authors = [author_line]  # Default to whole line
        
        for sep in separators:
            if sep in author_line:
                authors = [author.strip() for author in author_line.split(sep)]
                break
        
        # Clean and filter authors
        cleaned_authors = []
        for author in authors:
            author = author.strip()
            # Remove common non-name elements
            if author and len(author) > 2 and not any(skip in author.lower() for skip in ['university', 'department', 'email', '@']):
                cleaned_authors.append(author)
        
        return cleaned_authors[:5]  # Limit to 5 authors
    
    def _clean_text(self, text: str) -> str:
        """
        Clean extracted text for better processing
        """
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove page headers/footers (simple heuristic)
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            # Skip very short lines that are likely artifacts
            if len(line) < 3:
                continue
            # Skip lines that look like page numbers or headers
            if re.match(r'^\d+$', line) or re.match(r'^Page \d+', line):
                continue
            cleaned_lines.append(line)
        
        cleaned_text = '\n'.join(cleaned_lines)
        
        # Limit text length for API efficiency
        if len(cleaned_text) > 10000:
            cleaned_text = cleaned_text[:10000] + "..."
        
        return cleaned_text
    
    def validate_pdf(self, file_path: str) -> Tuple[bool, str]:
        """
        Validate that the file is a readable PDF
        """
        try:
            if not Path(file_path).exists():
                return False, "File does not exist"
            
            with pdfplumber.open(file_path) as pdf:
                page_count = len(pdf.pages)
            
            if page_count == 0:
                return False, "PDF has no pages"
            
            return True, f"Valid PDF with {page_count} pages"
            
        except Exception as e:
            return False, f"Invalid PDF: {str(e)}"