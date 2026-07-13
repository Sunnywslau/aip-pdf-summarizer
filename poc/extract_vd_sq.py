import fitz
import os
import sys

sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars

# Run the test classification function
from poc.test_routing import test_classify_and_route

data_dir = "/Users/wsl/Code/AIP_Reader/data"
files = ["VD-amdt-en-GB-A08-26.pdf", "SQ_AMDT-04-2026.pdf"]

for fn in files:
    fp = os.path.join(data_dir, fn)
    if not os.path.exists(fp):
        print(f"File not found: {fn}")
        continue
    doc = fitz.open(fp)
    changed = detect_change_bars(fp)
    print(f"\n================ {fn} ================")
    print(f"Total changed pages: {len(changed)}")
    
    for p_num in changed:
        page = doc[p_num]
        text = page.get_text()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        header = " | ".join(lines[:4])
        
        cat, r_rwy, r_proc = test_classify_and_route(text, header)
        print(f"Page {p_num+1:3d} | Header: {header[:60]}... | Cat: {cat:8s} | R_Rwy: {r_rwy} | R_Proc: {r_proc}")
