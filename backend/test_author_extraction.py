#!/usr/bin/env python3
"""
Test script for the improved author extraction functionality
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from services.pdf_parser import PDFParser

def test_author_extraction():
    """Test the improved author extraction with various text patterns"""
    parser = PDFParser()
    
    # Test cases with copyright text that should be filtered out
    test_cases = [
        # Case 1: Copyright text that was causing issues
        {
            "text": """Research Paper Title
by Provided proper attribution is provided, Google hereby grants permission to
reproduce the licensed material as long as the original copyright notice""",
            "expected_behavior": "Should skip copyright text",
        },
        
        # Case 2: Actual author names with explicit labels
        {
            "text": """Machine Learning in Healthcare
Authors: John Smith, Mary Johnson, Robert Chen
Department of Computer Science""",
            "expected_behavior": "Should extract: John Smith, Mary Johnson, Robert Chen",
        },
        
        # Case 3: Authors with "by" but no copyright text
        {
            "text": """Deep Learning Applications
by Dr. Sarah Williams and Prof. Michael Brown
Stanford University""",
            "expected_behavior": "Should extract: Dr. Sarah Williams, Prof. Michael Brown",
        },
        
        # Case 4: Implicit authors (no explicit labels)
        {
            "text": """Neural Networks for Image Recognition
Alice Cooper
Bob Dylan
Carnegie Mellon University
Abstract: This paper presents...""",
            "expected_behavior": "Should extract: Alice Cooper, Bob Dylan",
        },
        
        # Case 5: Mixed case with copyright that should be skipped
        {
            "text": """AI Research Paper
by Provided proper attribution is provided, IEEE grants permission
Author: Jane Doe
Computer Science Department""",
            "expected_behavior": "Should extract: Jane Doe (skip copyright line)",
        },
    ]
    
    print("Testing improved author extraction...")
    print("=" * 60)
    
    for i, case in enumerate(test_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"Input text preview: {case['text'][:80]}...")
        print(f"Expected: {case['expected_behavior']}")
        
        # Extract authors using the improved method
        authors = parser._extract_authors_from_text(case['text'])
        
        print(f"Extracted authors: {authors}")
        
        # Basic validation
        if authors:
            # Check that no author contains copyright-like text
            has_copyright_text = any(
                any(pattern in author.lower() for pattern in [
                    'provided proper attribution', 'permission', 'copyright', 'grants'
                ]) for author in authors
            )
            
            if has_copyright_text:
                print("❌ FAIL: Extracted authors contain copyright text!")
            else:
                print("✅ PASS: No copyright text in extracted authors")
        else:
            print("⚠️  No authors extracted")
        
        print("-" * 40)
    
    print("\nTesting completed!")

if __name__ == "__main__":
    test_author_extraction()