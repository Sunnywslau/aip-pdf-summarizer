import fitz
from change_bar_detector import detect_change_bars
from section_classifier import classify_page

def show_classification(pdf_path):
    doc = fitz.open(pdf_path)
    changed_pages_0idx = detect_change_bars(pdf_path)
    
    print(f"Total changed pages: {len(changed_pages_0idx)}")
    
    categories_count = {}
    for p_num in changed_pages_0idx:
        page = doc[p_num]
        text = page.get_text()
        cat = classify_page(text)
        categories_count[cat] = categories_count.get(cat, 0) + 1
        
        # 顯示所有非 AD_RUNWAY 的頁面分類
        if cat != "AD_RUNWAY" and cat != "AD_OTHER":
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            header = " | ".join(lines[:3])
            print(f"Page {p_num + 1:3d}: Category={cat:10s} | Header={header[:80]}")
            
    print("\nBreakdown of categories:")
    for cat, count in categories_count.items():
        print(f"  {cat}: {count}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    show_classification(pdf)
