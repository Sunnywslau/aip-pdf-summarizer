import fitz

def search_exact_phrases(pdf_path):
    doc = fitz.open(pdf_path)
    print(f"Searching {pdf_path} for exact chart titles...")
    
    phrases = ["standard departure chart", "standard arrival chart", "instrument approach chart"]
    matches = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().lower()
        
        found = []
        for phrase in phrases:
            if phrase in text:
                found.append(phrase)
                
        if found:
            matches.append((page_num + 1, found))
            
    print(f"\nFound {len(matches)} matches:")
    for p, f in matches:
        print(f"  Page {p:3d} | Matches: {f}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    search_exact_phrases(pdf)
