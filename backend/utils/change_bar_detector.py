import fitz
from typing import List

def detect_change_bars(pdf_bytes: bytes) -> List[int]:
    """
    Scans a PDF stream (bytes), identifying pages that contain a Change Bar.
    Change Bar features:
    1. Vertical line/rectangle (height > 5)
    2. Stroke width >= 2.0 pt, or filled rectangle width between 1.5 and 10.0 pt
    3. Positioned near margins (left margin < 60 or right margin > page_width - 60)
    
    Returns: List of 0-indexed page numbers.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    changed_pages = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        page_width = page.rect.width
        drawings = page.get_drawings()
        
        has_bar = False
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
                has_bar = True
                break
                
        if has_bar:
            changed_pages.append(page_num)
            
    return changed_pages
