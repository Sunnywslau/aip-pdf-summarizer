import fitz
from pathlib import Path

PDF_PATH = "/Users/wsl/Code/AIP_Reader/data/UA_AMDT_A_2026_009_en_2026-09-03.pdf"

def get_change_bar_spans(page) -> list:
    page_width = page.rect.width
    drawings = page.get_drawings()
    spans = []
    for d in drawings:
        stroke_width = d.get("width", 0)
        if stroke_width is None:
            stroke_width = 0
        rect = d["rect"]
        w = rect.width
        h = rect.height
        is_vertical = h > 5
        is_margin = (rect.x1 < 60) or (rect.x0 > page_width - 60)
        is_thick_stroke = stroke_width >= 2.0
        is_thick_fill = d["type"] in ["f", "fs"] and 1.5 <= w <= 10.0
        
        if is_vertical and is_margin and (is_thick_stroke or is_thick_fill):
            spans.append((rect.y0, rect.y1))
    return spans

def get_annotated_text(page, cb_spans) -> str:
    if not cb_spans:
        return page.get_text()
        
    annotated_blocks = []
    blocks = page.get_text("dict")["blocks"]
    
    # Sort blocks top-to-bottom
    blocks.sort(key=lambda b: (b["bbox"][1], b["bbox"][0]))
    
    for b in blocks:
        if "lines" not in b:
            continue
        block_lines = []
        for line in b["lines"]:
            line_text = "".join([span["text"] for span in line["spans"]]).strip()
            if not line_text:
                continue
            ly0 = line["bbox"][1]
            ly1 = line["bbox"][3]
            l_mid = (ly0 + ly1) / 2.0
            
            is_changed = False
            for by0, by1 in cb_spans:
                if (by0 - 3) <= l_mid <= (by1 + 3):
                    is_changed = True
                    break
            
            if is_changed:
                block_lines.append(f"[CHANGED] {line_text}")
            else:
                block_lines.append(line_text)
        
        if block_lines:
            annotated_blocks.append("\n".join(block_lines))
            
    return "\n\n".join(annotated_blocks)

doc = fitz.open(PDF_PATH)
print(f"Total pages: {len(doc)}")

# Find first 3 pages that have change bars
count = 0
for idx in range(len(doc)):
    page = doc[idx]
    spans = get_change_bar_spans(page)
    if spans:
        print(f"\n--- Page {idx + 1} has {len(spans)} change bar(s) ---")
        annotated = get_annotated_text(page, spans)
        # Print first 300 characters of the annotated text
        print(annotated[:500])
        print("...")
        count += 1
        if count >= 3:
            break
