import fitz
from change_bar_detector import detect_change_bars
from section_classifier import classify_page

def generate_report(pdf_path):
    doc = fitz.open(pdf_path)
    print(f"Analyzing {pdf_path}...")
    
    # 偵測有 Change Bar 的頁面
    changed_pages_0indexed = detect_change_bars(pdf_path)
    changed_pages_1indexed = [p + 1 for p in changed_pages_0indexed]
    
    print(f"Total pages: {len(doc)}")
    print(f"Total changed pages: {len(changed_pages_1indexed)}")
    
    # 進行分類
    changed_by_category = {}
    details = []
    
    for page_num in changed_pages_0indexed:
        page = doc[page_num]
        text = page.get_text()
        category = classify_page(text)
        
        # 取得前兩行非空文字作為簡介
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        header = " | ".join(lines[:3])
        
        changed_by_category[category] = changed_by_category.get(category, 0) + 1
        details.append({
            "page": page_num + 1,
            "category": category,
            "header": header
        })
        
    print("\n--- Changed Pages Category Breakdown ---")
    for cat, count in sorted(changed_by_category.items()):
        print(f"  {cat}: {count} pages")
        
    print("\n--- Detailed List of Changed Pages ---")
    for d in details:
        print(f"  Page {d['page']:3d} | Category: {d['category']:10s} | Header: {d['header'][:80]}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    generate_report(pdf)
