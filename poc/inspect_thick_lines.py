import fitz

def find_pages_with_thick_lines(pdf_path):
    doc = fitz.open(pdf_path)
    thick_line_pages = {}
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        drawings = page.get_drawings()
        page_width = page.rect.width
        
        for d in drawings:
            stroke_width = d.get("width", 0)
            if stroke_width is None:
                stroke_width = 0
                
            rect = d["rect"]
            h = rect.height
            
            # 條件：垂直線、stroke_width >= 2.0
            if h > 5 and stroke_width >= 2.0:
                if page_num + 1 not in thick_line_pages:
                    thick_line_pages[page_num + 1] = []
                thick_line_pages[page_num + 1].append({
                    "rect": (rect.x0, rect.y0, rect.x1, rect.y1),
                    "stroke_width": stroke_width,
                    "height": h
                })
                
    print(f"Total pages with thick lines (sw >= 2.0): {len(thick_line_pages)}")
    for p, items in sorted(thick_line_pages.items()):
        print(f"Page {p}: {len(items)} thick drawings. Examples: {[ (round(item['rect'][0], 1), round(item['rect'][1], 1), round(item['stroke_width'], 1)) for item in items[:3]]}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    find_pages_with_thick_lines(pdf)
