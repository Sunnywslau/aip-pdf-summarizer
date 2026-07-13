import fitz
import os
import sys

sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars
from utils.section_classifier import classify_page

pdf_path = "/Users/wsl/Code/AIP_Reader/data/RP_Amendment.pdf"
doc = fitz.open(pdf_path)
changed_pages = detect_change_bars(pdf_path)

output_path = "/Users/wsl/Code/AIP_Reader/scratch/rp_pages.txt"
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    f.write(f"Total changed pages in RP_Amendment.pdf: {len(changed_pages)}\n")
    for p_num in changed_pages:
        page = doc[p_num]
        text = page.get_text()
        category = classify_page(text)
        
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        header = " | ".join(lines[:4])
        
        import re
        icaos = re.findall(r'\bRP[A-Z]{2}\b', text)
        
        f.write(f"Page {p_num+1:3d} | Cat: {category:10s} | ICAOs: {list(set(icaos))} | Header: {header[:120]}\n")

print(f"Extraction complete! Saved to {output_path}")
