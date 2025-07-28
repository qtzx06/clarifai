import fitz  # PyMuPDF
import re

SECTION_HEADERS = [
    "abstract",
    "introduction",
    "related work",
    "background",
    "method",
    "methods",
    "approach",
    "experiments",
    "results",
    "discussion",
    "conclusion",
    "references",
]

def clean_text(text):
    # Remove page markers like "--- Page 2 ---"
    text = re.sub(r"--- Page \d+ ---", "", text)

    # Remove repeated whitespace
    text = re.sub(r"\n{2,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)

    return text.strip()

def split_sections(text):
    sections = {}
    lower_text = text.lower()

    # Find start positions of all section headers
    indices = []
    for header in SECTION_HEADERS:
        matches = list(re.finditer(rf"\n\s*{header}\s*\n", lower_text))
        for match in matches:
            indices.append((match.start(), header))

    # Sort by order in doc
    indices.sort()

    # Extract section chunks
    for i in range(len(indices)):
        start_idx, header = indices[i]
        end_idx = indices[i+1][0] if i+1 < len(indices) else len(text)
        content = text[start_idx:end_idx].strip()
        sections[header] = content

    return sections

def extract_clean_sections(pdf_path):
    doc = fitz.open(pdf_path)
    full_text = ""

    for page in doc:
        text = page.get_text()
        full_text += f"\n{text}"

    cleaned = clean_text(full_text)
    split = split_sections(cleaned)

    return split

# Example usage:
pdf_path = "seal.pdf"
sections = extract_clean_sections(pdf_path)

# Preview sections
for name, content in sections.items():
    print(f"\n==== {name.lower()} ====\n{content}...\n")
