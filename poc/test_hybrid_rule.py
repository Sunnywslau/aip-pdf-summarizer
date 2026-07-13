import fitz
import os
import sys

sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars
from poc.test_routing import test_classify_and_route

data_dir = "/Users/wsl/Code/AIP_Reader/data"
files = ["VD-amdt-en-GB-A08-26.pdf", "SQ_AMDT-04-2026.pdf"]

for fn in files:
    fp = os.path.join(data_dir, fn)
    if not os.path.exists(fp):
        print(f"File not found: {fn}")
        continue
    doc = fitz.open(fp)
    changed_pages_cb = set(detect_change_bars(fp))
    
    print(f"\n================ {fn} ================")
    print(f"Total pages in PDF: {len(doc)}")
    print(f"Pages with Change Bars: {len(changed_pages_cb)}")
    
    selected_pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        header = " | ".join(lines[:4])
        
        cat, r_rwy, r_proc = test_classify_and_route(text, header)
        
        has_cb = page_num in changed_pages_cb
        is_procedure_chart = cat in ["AD_CHART", "SID", "STAR", "IAP"]
        
        # Selection rule: Has CB or is a procedure chart
        if has_cb or is_procedure_chart:
            selected_pages.append((page_num + 1, cat, has_cb, is_procedure_chart))
            
    print(f"Selected Pages under Hybrid Rule: {len(selected_pages)}")
    for p_num, cat, cb, chart in selected_pages:
        print(f"  Page {p_num:2d} | Cat: {cat:8s} | Has CB: {str(cb):5s} | Is Chart: {str(chart):5s}")
