import fitz
from utils.change_bar_detector import detect_change_bars
from utils.section_classifier import classify_page

def debug_korea(pdf_path):
    doc = fitz.open(pdf_path)
    changed_pages_0idx = detect_change_bars(pdf_path)
    
    print(f"Total pages: {len(doc)}")
    print(f"Changed pages (0-indexed): {changed_pages_0idx}")
    
    for idx, p_num in enumerate(changed_pages_0idx):
        page = doc[p_num]
        text = page.get_text()
        cat = classify_page(text)
        
        print(f"\n--- [{idx+1}/{len(changed_pages_0idx)}] Page {p_num + 1} | Category: {cat} ---")
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        print(f"Header lines:\n  " + "\n  ".join(lines[:5]))
        print(f"Text snippet (first 600 chars):\n{text[:600]}")
        print("-" * 50)

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Korea_AIRAC AIP AMDT 7_26.pdf"
    debug_korea(pdf)
