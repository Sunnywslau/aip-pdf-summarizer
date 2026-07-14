import fitz

PDF_PATH = "/Users/wsl/Code/AIP_Reader/data/UA_AMDT_A_2026_009_en_2026-09-03.pdf"

doc = fitz.open(PDF_PATH)
page = doc[18]  # Page 19 (0-indexed is 18)

# Get change bars
page_width = page.rect.width
drawings = page.get_drawings()
spans = []
for d in drawings:
    stroke_width = d.get("width", 0) or 0
    rect = d["rect"]
    w = rect.width
    h = rect.height
    is_vertical = h > 5
    is_margin = (rect.x1 < 60) or (rect.x0 > page_width - 60)
    is_thick_stroke = stroke_width >= 2.0
    is_thick_fill = d["type"] in ["f", "fs"] and 1.5 <= w <= 10.0
    
    if is_vertical and is_margin and (is_thick_stroke or is_thick_fill):
        spans.append((rect.y0, rect.y1, rect.x0, rect.x1))

print("=== CHANGE BARS ON PAGE 19 ===")
for i, span in enumerate(spans):
    print(f"Bar {i}: y0={span[0]:.2f}, y1={span[1]:.2f}, x0={span[2]:.2f}, x1={span[3]:.2f}")

print("\n=== TEXT LINES ON PAGE 19 ===")
blocks = page.get_text("dict")["blocks"]
for b in blocks:
    if "lines" not in b:
        continue
    for line in b["lines"]:
        line_text = "".join([span["text"] for span in line["spans"]]).strip()
        ly0, ly1 = line["bbox"][1], line["bbox"][3]
        l_mid = (ly0 + ly1) / 2.0
        # If this line is near any change bar in vertical coordinate
        is_near = any(abs(l_mid - (by0 + by1)/2.0) < 100 for by0, by1, _, _ in spans)
        if is_near:
            print(f"Line: '{line_text}' | y0={ly0:.2f}, y1={ly1:.2f}, mid={l_mid:.2f}")
