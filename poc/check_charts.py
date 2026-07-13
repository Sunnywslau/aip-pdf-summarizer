import fitz
import os
import sys

sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars
from utils.section_classifier import classify_page

pdf_path = "/Users/wsl/Code/AIP_Reader/data/RP_Amendment.pdf"
doc = fitz.open(pdf_path)
changed_pages = detect_change_bars(pdf_path)

proc_keywords = ["departure", "arrival", "approach", "ils", "vor", "rnav", "sid", "star", "chart", "rnp", "ndb"]

for p_num in changed_pages:
    page = doc[p_num]
    text = page.get_text()
    category = classify_page(text)
    
    if category == "AD_OTHER":
        text_lower = text.lower()
        matched = [kw for kw in proc_keywords if kw in text_lower]
        
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        header = " | ".join(lines[:3])
        
        # Check if the header contains "CHART"
        has_chart_in_header = "chart" in header.lower()
        
        if has_chart_in_header or matched:
            print(f"Page {p_num+1:3d} | Header: {header[:80]} | Matched KWs: {matched}")
