import fitz
from section_classifier import classify_page

def find_procedures(pdf_path):
    doc = fitz.open(pdf_path)
    print(f"Scanning all {len(doc)} pages for instrument procedures...")
    
    procedures_found = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        cat = classify_page(text)
        
        if cat in ["SID", "STAR", "IAP"]:
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            header = " | ".join(lines[:3])
            procedures_found.append({
                "page": page_num + 1,
                "category": cat,
                "header": header
            })
            
    print(f"\nFound {len(procedures_found)} procedure pages:")
    for p in procedures_found:
        print(f"  Page {p['page']:3d} | Category: {p['category']:5s} | Header: {p['header'][:80]}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    find_procedures(pdf)
