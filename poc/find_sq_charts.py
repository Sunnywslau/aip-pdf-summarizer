import fitz
import sys

sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars

pdf_path = "/Users/wsl/Code/AIP_Reader/data/SQ_AMDT-04-2026.pdf"
doc = fitz.open(pdf_path)
changed_pages = set(detect_change_bars(pdf_path))

print(f"Total pages: {len(doc)}")
print(f"Changed pages (with change bars): {len(changed_pages)}")

print("\n--- ALL CHART PAGES IN SQ AMENDMENT ---")
for page_num in range(len(doc)):
    page = doc[page_num]
    text = page.get_text()
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    header = " | ".join(lines[:4])
    
    is_chart = "chart" in header.lower() or "chart" in text[:200].lower()
    
    if is_chart:
        has_cb = page_num in changed_pages
        print(f"Page {page_num+1:2d} | Has CB: {str(has_cb):5s} | Header: {header[:80]}")
