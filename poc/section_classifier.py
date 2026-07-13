import fitz
import re
from typing import Dict, Any

def classify_page(page_text: str) -> str:
    """
    將 AIP 頁面分類為：
    - GEN: 通用資訊
    - ENR: 航路資訊
    - SID: 標準儀器離場圖與程序
    - STAR: 標準儀器到場圖與程序
    - IAP: 儀器進場圖與程序
    - AD_RUNWAY: 跑道實體參數與資料 (AD 2.12)
    - AD_OTHER: 機場其他資料
    - UNKNOWN: 無法判斷
    """
    text_lower = page_text.lower()
    
    # 取得前 10 行做為 Header 分析
    lines = [line.strip() for line in page_text.split("\n") if line.strip()]
    header = " | ".join(lines[:10])
    header_lower = header.lower()
    
    # 判斷大章節
    is_gen = bool(re.search(r'\bgen\b', header_lower))
    is_enr = bool(re.search(r'\benr\b', header_lower))
    is_ad = bool(re.search(r'\bad\b', header_lower)) or "ad 2" in header_lower or "ad-2" in header_lower
    
    # 判斷是否為 SID, STAR, IAP (在 AD 機場章節下，或者全文具有強烈特徵)
    is_sid = bool(re.search(r'\bsid\b', header_lower)) or "standard departure" in text_lower or "instrument departure" in text_lower
    is_star = bool(re.search(r'\bstar\b', header_lower)) or "standard arrival" in text_lower or "instrument arrival" in text_lower
    is_iap = bool(re.search(r'\biac\b', header_lower)) or bool(re.search(r'\biap\b', header_lower)) or "instrument approach" in text_lower or "approach chart" in text_lower

    if is_gen:
        return "GEN"
    
    if is_enr:
        return "ENR"
    
    if is_sid:
        return "SID"
    if is_star:
        return "STAR"
    if is_iap:
        return "IAP"
    
    if is_ad:
        # 判斷是否為跑道物理特性 (AD 2.12 RUNWAY PHYSICAL CHARACTERISTICS)
        if "runway physical characteristics" in text_lower or "rwy physical characteristics" in text_lower:
            return "AD_RUNWAY"
        if "runway" in text_lower or "rwy" in text_lower:
            # 進一步過濾是否包含跑道物理參數表格欄位如 dimension, bearing strength, threshold 等
            has_table_fields = any(field in text_lower for field in ["dimension", "bearing strength", "tora", "toda", "asda", "lda"])
            if has_table_fields:
                return "AD_RUNWAY"
                
        return "AD_OTHER"
        
    # 後備方案（當沒有明顯 Header 時，使用全局關鍵字判斷）
    if "standard departure chart" in text_lower:
        return "SID"
    if "standard arrival chart" in text_lower:
        return "STAR"
    if "instrument approach chart" in text_lower or "approach chart" in text_lower:
        return "IAP"
        
    return "UNKNOWN"

if __name__ == "__main__":
    # 簡單的測試邏輯
    doc = fitz.open("/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf")
    
    # 測試幾個已知頁面
    test_pages = [7, 23, 25, 71, 89, 90, 91, 143]
    for p in test_pages:
        page = doc[p - 1]
        cat = classify_page(page.get_text())
        print(f"Page {p}: Classified as {cat}")
