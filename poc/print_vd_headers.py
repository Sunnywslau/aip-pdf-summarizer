import fitz

pdf_path = "/Users/wsl/Code/AIP_Reader/data/VD-amdt-en-GB-A08-26.pdf"
doc = fitz.open(pdf_path)

for page_num in range(len(doc)):
    page = doc[page_num]
    text = page.get_text()
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    header = " | ".join(lines[:3])
    print(f"Page {page_num+1:2d} | Header: {header[:100]}")
