"""
PDF parsing service using PyMuPDF
"""
import fitz  # PyMuPDF
import os
from typing import Dict, List, Tuple
from pathlib import Path

class PDFParser:
    def __init__(self):
        self.supported_formats = ['.pdf']
    
    async def extract_text_and_metadata(self, file_path: str) -> Dict:
        """
        Extract text content and metadata from PDF file
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            Dictionary containing text, metadata, and structure info
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")
        
        try:
            # Open PDF document
            doc = fitz.open(file_path)
            
            # Extract metadata
            metadata = doc.metadata
            
            # Extract text from all pages
            full_text = ""
            page_texts = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                page_text = page.get_text()
                
                # Clean up the page text - remove excessive whitespace
                page_text = '\n'.join(line.strip() for line in page_text.split('\n') if line.strip())
                
                page_texts.append({
                    "page_number": page_num + 1,
                    "text": page_text
                })
                full_text += f"\n--- Page {page_num + 1} ---\n{page_text}\n"
            
            # Extract title, authors, abstract if available
            title = metadata.get('title', '') or self._extract_title_from_text(page_texts[0]['text'] if page_texts else '')
            authors = self._extract_authors_from_text(page_texts[0]['text'] if page_texts else '')
            abstract = self._extract_abstract_from_text(full_text)
            
            doc.close()
            
            return {
                "title": title,
                "authors": authors,
                "abstract": abstract,
                "content": full_text.strip(),
                "page_count": len(page_texts),
                "pages": page_texts,
                "metadata": {
                    "title": metadata.get('title', ''),
                    "author": metadata.get('author', ''),
                    "subject": metadata.get('subject', ''),
                    "creator": metadata.get('creator', ''),
                    "producer": metadata.get('producer', ''),
                    "creation_date": metadata.get('creationDate', ''),
                    "modification_date": metadata.get('modDate', '')
                }
            }
            
        except Exception as e:
            raise Exception(f"Error parsing PDF: {str(e)}")
    
    def _extract_title_from_text(self, first_page_text: str) -> str:
        """
        Attempt to extract title from first page text
        """
        if not first_page_text:
            return "Research Paper"
        
        lines = first_page_text.split('\n')
        
        # Extended skip patterns for copyright/permission text
        skip_patterns = [
            'provided proper attribution', 'permission to', 'copyright', '©', 'arxiv:', 'doi:',
            'www.', 'http', 'reproduce', 'tables and figures', 'journalistic', 'scholarly',
            'license', 'creative commons', 'all rights reserved', 'ieee', 'acm', 'springer',
            'elsevier', 'wiley', 'nature', 'science', 'plos', 'bmc', 'frontiers'
        ]
        
        # Look for actual title - typically the first substantial line that's not header/copyright
        for i, line in enumerate(lines[:25]):  # Check more lines
            line = line.strip()
            
            # Skip empty or very short lines
            if not line or len(line) < 10:
                continue
                
            # Skip lines with skip patterns
            if any(pattern in line.lower() for pattern in skip_patterns):
                continue
                
            # Skip very long lines (likely paragraphs)
            if len(line) > 150:
                continue
            
            # Skip lines that look like headers/footers (all caps, numbers only, etc.)
            if line.isupper() or line.isdigit() or len(line.split()) < 3:
                continue
                
            # Skip common academic headers
            if any(header in line.lower() for header in ['abstract', 'introduction', 'page', 'vol', 'no.']):
                continue
            
            # This looks like a potential title
            if 10 <= len(line) <= 150 and len(line.split()) >= 3:
                return line
        
        # If no good title found, look for the longest reasonable line
        reasonable_lines = []
        for line in lines[:15]:
            line = line.strip()
            if (10 <= len(line) <= 100 and
                not any(pattern in line.lower() for pattern in skip_patterns) and
                len(line.split()) >= 3):
                reasonable_lines.append(line)
        
        if reasonable_lines:
            return max(reasonable_lines, key=len)
        
        return "Research Paper"
    
    def _extract_authors_from_text(self, first_page_text: str) -> List[str]:
        """
        Attempt to extract authors from first page text with improved filtering
        """
        authors = []
        if not first_page_text:
            return authors
        
        lines = first_page_text.split('\n')
        
        # Patterns to identify and skip legal/copyright boilerplate text
        legal_skip_patterns = [
            'provided proper attribution', 'permission to', 'copyright', '©', 'all rights reserved',
            'license', 'creative commons', 'reproduce', 'distribution', 'scholarly', 'journalistic',
            'tables and figures', 'ieee', 'acm', 'springer', 'elsevier', 'wiley', 'nature',
            'grant permission', 'hereby grants', 'attribution is provided', 'proper attribution',
            'terms and conditions', 'subject to the following', 'disclaims all warranties',
            'liability', 'commercial use', 'non-commercial', 'educational use', 'google hereby'
        ]
        
        # Look for author patterns in first 30 lines (expanded range)
        for i, line in enumerate(lines[:30]):
            line = line.strip()
            if not line or len(line) < 3:
                continue
                
            # Skip lines with legal/copyright patterns
            if any(pattern in line.lower() for pattern in legal_skip_patterns):
                continue
            
            # Look for explicit author labels
            if any(keyword in line.lower() for keyword in ['author:', 'authors:', 'written by:', 'authored by:']):
                potential_authors = self._clean_author_line(line)
                if potential_authors and self._validate_author_names(potential_authors):
                    authors.extend(self._split_authors(potential_authors))
                    break
            
            # Look for "by" patterns but be more selective
            elif ' by ' in line.lower():
                # Additional checks for "by" patterns to avoid copyright text
                if (len(line) < 100 and  # Not too long (avoid paragraphs)
                    not any(skip in line.lower() for skip in ['provided', 'permission', 'grant', 'license', 'copyright']) and
                    self._looks_like_author_line(line)):
                    
                    # Extract text after "by"
                    by_index = line.lower().find(' by ')
                    potential_authors = line[by_index + 4:].strip()
                    
                    if potential_authors and self._validate_author_names(potential_authors):
                        authors.extend(self._split_authors(potential_authors))
                        break
        
        # If no explicit authors found, look for name-like patterns after title
        if not authors:
            authors = self._find_implicit_authors(lines)
        
        return authors[:5]  # Limit to 5 authors max
    
    def _clean_author_line(self, line: str) -> str:
        """Clean author line by removing common prefixes"""
        line = line.strip()
        prefixes_to_remove = ['author:', 'authors:', 'by:', 'written by:', 'authored by:']
        
        for prefix in prefixes_to_remove:
            if line.lower().startswith(prefix):
                line = line[len(prefix):].strip()
                break
        
        return line
    
    def _validate_author_names(self, text: str) -> bool:
        """Validate that text looks like actual author names"""
        if not text or len(text) < 2:
            return False
        
        # Skip if it contains patterns that don't look like names
        invalid_patterns = [
            'www.', 'http', '.com', '.org', '.edu', '@',
            'university', 'department', 'institute', 'college',
            'et al.', 'and others', 'corresponding author',
            'email:', 'phone:', 'address:', 'affiliation:',
            'abstract', 'introduction', 'conclusion'
        ]
        
        text_lower = text.lower()
        if any(pattern in text_lower for pattern in invalid_patterns):
            return False
        
        # Check if it contains reasonable name-like patterns
        words = text.split()
        if len(words) < 1 or len(words) > 10:  # Reasonable word count for author names
            return False
        
        # Check for reasonable character patterns (letters, spaces, periods, commas)
        import re
        if not re.match(r'^[a-zA-Z\s\.,\-&]+$', text):
            return False
        
        return True
    
    def _looks_like_author_line(self, line: str) -> bool:
        """Check if a line with 'by' looks like it contains author names"""
        # Simple heuristics to identify author lines vs copyright text
        line_lower = line.lower()
        
        # Positive indicators
        if any(indicator in line_lower for indicator in ['dr.', 'prof.', 'ph.d', 'b.s.', 'm.s.']):
            return True
        
        # Check word pattern - author lines typically have 2-6 words after "by"
        by_index = line_lower.find(' by ')
        if by_index != -1:
            after_by = line[by_index + 4:].strip()
            words = after_by.split()
            if 1 <= len(words) <= 6 and all(len(word) > 1 for word in words[:3]):
                return True
        
        return False
    
    def _split_authors(self, author_text: str) -> List[str]:
        """Split author text into individual author names"""
        authors = []
        
        # Try different separators in order of preference
        separators = [' and ', ', and ', ',', '&', ';']
        
        for separator in separators:
            if separator in author_text:
                authors = [name.strip() for name in author_text.split(separator) if name.strip()]
                break
        else:
            # No separator found, treat as single author
            authors = [author_text.strip()]
        
        # Filter out empty or invalid names
        valid_authors = []
        for author in authors:
            if author and len(author) > 1 and self._validate_author_names(author):
                valid_authors.append(author)
        
        return valid_authors
    
    def _find_implicit_authors(self, lines: List[str]) -> List[str]:
        """Look for author names that appear without explicit labels"""
        authors = []
        
        # Look for name-like patterns in first 15 lines (after title)
        for i, line in enumerate(lines[1:16]):  # Skip first line (likely title)
            line = line.strip()
            
            if not line or len(line) < 5 or len(line) > 80:
                continue
            
            # Skip lines that look like headers, emails, or institutional info
            if any(skip in line.lower() for skip in [
                'university', 'institute', 'department', 'college', '@', 'email',
                'abstract', 'introduction', 'arxiv', 'doi:', 'www.', 'http'
            ]):
                continue
            
            # Look for patterns that might be author names
            words = line.split()
            if (2 <= len(words) <= 6 and  # Reasonable word count
                all(word[0].isupper() if word else False for word in words[:2]) and  # Capitalized words
                not any(char.isdigit() for char in line) and  # No numbers
                len([w for w in words if len(w) > 1]) >= 2):  # At least 2 substantial words
                
                if self._validate_author_names(line):
                    authors.append(line)
                    if len(authors) >= 3:  # Don't get too many implicit authors
                        break
        
        return authors
    
    def _extract_abstract_from_text(self, full_text: str) -> str:
        """
        Attempt to extract abstract from full text
        """
        if not full_text:
            return ""
        
        text_lower = full_text.lower()
        
        # Look for abstract section
        abstract_start = -1
        for keyword in ['abstract', 'summary']:
            start_pos = text_lower.find(keyword)
            if start_pos != -1:
                abstract_start = start_pos
                break
        
        if abstract_start == -1:
            return ""
        
        # Find end of abstract (usually next section or double newline)
        abstract_text = full_text[abstract_start:]
        
        # Look for section endings
        end_keywords = ['\nintroduction', '\n1.', '\n1 ', '\nkeywords', '\nkey words']
        abstract_end = len(abstract_text)
        
        for keyword in end_keywords:
            end_pos = abstract_text.lower().find(keyword)
            if end_pos != -1 and end_pos < abstract_end:
                abstract_end = end_pos
        
        abstract = abstract_text[:abstract_end].strip()
        
        # Clean up abstract
        if abstract.lower().startswith('abstract'):
            abstract = abstract[8:].strip()
        
        # Limit length
        if len(abstract) > 2000:
            abstract = abstract[:2000] + "..."
        
        return abstract
    
    async def extract_text_with_positions(self, file_path: str) -> List[Dict]:
        """
        Extract text with position information for highlighting
        """
        doc = fitz.open(file_path)
        text_blocks = []
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            blocks = page.get_text("dict")
            
            for block in blocks["blocks"]:
                if block.get("type") == 0:  # Text block
                    for line in block["lines"]:
                        for span in line["spans"]:
                            text_blocks.append({
                                "page": page_num + 1,
                                "text": span["text"],
                                "bbox": span["bbox"],  # [x0, y0, x1, y1]
                                "font": span["font"],
                                "size": span["size"]
                            })
        
        doc.close()
        return text_blocks