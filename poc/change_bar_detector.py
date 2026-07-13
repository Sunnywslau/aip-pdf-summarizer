import fitz
from typing import List, Dict, Any

def detect_change_bars(pdf_path: str) -> List[int]:
    """
    掃描 PDF 文件，辨識含有 Change Bar 的頁面。
    Change Bar 定義為：
    1. 垂直線段 (height > 5)
    2. 線條粗細 (stroke_width) >= 2.0 點，或填充矩形寬度在 1.5 ~ 10 之間
    3. 位於頁面左邊緣 (x < 60) 或右邊緣 (x > page_width - 60)
    
    回傳：0-indexed 的頁碼清單 (如 [6, 22, 24, ...])
    """
    doc = fitz.open(pdf_path)
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
            
            # 條件 1：粗筆跡的線條 (stroke_width >= 2.0)
            is_thick_stroke = stroke_width >= 2.0
            
            # 條件 2：填充矩形 (type 為 'f' 或 'fs')，且寬度介於 1.5 和 10 之間
            is_thick_fill = d["type"] in ["f", "fs"] and 1.5 <= w <= 10.0
            
            if is_vertical and is_margin and (is_thick_stroke or is_thick_fill):
                has_bar = True
                break  # 只要這頁有一個 change bar，就認定這頁有變更
                
        if has_bar:
            changed_pages.append(page_num)
            
    return changed_pages

if __name__ == "__main__":
    import sys
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    pages = detect_change_bars(pdf)
    print(f"Detected {len(pages)} pages with change bars (0-indexed):")
    print(pages[:20])
