import fitz
import os

pdf_path = "/Users/wsl/Code/AIP_Reader/data/VD-amdt-en-GB-A08-26.pdf"
doc = fitz.open(pdf_path)

print(f"VD Amendment: {len(doc)} pages")
for page_num in range(len(doc)):
    page = doc[page_num]
    drawings = page.get_drawings()
    text = page.get_text()
    
    # Let's count vertical lines/rectangles
    vertical_lines = []
    for d in drawings:
        rect = d["rect"]
        w = rect.width
        h = rect.height
        is_vertical = h > 5
        if is_vertical:
            vertical_lines.append(d)
            
    # Print summary of lines
    print(f"Page {page_num+1:2d} | Drawings: {len(drawings):4d} | Vertical Lines: {len(vertical_lines):3d} | Text Length: {len(text):5d}")
    if len(vertical_lines) > 0:
        # Print info about the first few vertical lines
        for idx, line in enumerate(vertical_lines[:3]):
            rect = line["rect"]
            w = rect.width
            h = rect.height
            stroke_width = line.get("width", 0)
            print(f"   Line {idx+1}: type={line['type']}, rect=({rect.x0:.1f}, {rect.y0:.1f}, {rect.x1:.1f}, {rect.y1:.1f}), w={w:.2f}, h={h:.2f}, stroke_w={stroke_width}")
