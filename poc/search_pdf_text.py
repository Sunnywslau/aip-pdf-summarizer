import fitz
import re

def search_keywords(pdf_path):
    doc = fitz.open(pdf_path)
    print(f"Searching {pdf_path} for procedure keywords...")
    
    matches = []
    keywords = ["departure", "arrival", "approach", "sid", "star", "iac", "standard instrument"]
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().lower()
        
        found = []
        for kw in keywords:
            if kw in text:
                found.append(kw)
                
        if found:
            matches.append((page_num + 1, found, text[:200].replace("\n", " | ")))
            
    print(f"\nFound {len(matches)} pages containing keywords:")
    for p, f, snippet in matches[:30]:
        print(f"  Page {p:3d} | Matches: {f} | Snippet: {snippet[:80]}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    search_keywords(pdf)
