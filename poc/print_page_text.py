import fitz

pdf_path = "/Users/wsl/Code/AIP_Reader/data/RP_Amendment.pdf"
doc = fitz.open(pdf_path)

# Pages are 0-indexed, so Page 187 is index 186, Page 278 is index 277
for page_num in [186, 277]:
    page = doc[page_num]
    print(f"\n================ PAGE {page_num + 1} ================")
    print(page.get_text())
