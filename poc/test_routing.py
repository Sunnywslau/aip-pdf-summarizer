import fitz
import os
import re

pdf_path = "/Users/wsl/Code/AIP_Reader/data/RP_Amendment.pdf"
doc = fitz.open(pdf_path)

# Import local change bar detector
import sys
sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars

changed_pages = detect_change_bars(pdf_path)

def test_classify_and_route(text, header):
    text_lower = text.lower()
    header_lower = header.lower()
    
    is_gen = bool(re.search(r'\bgen\b', header_lower))
    is_enr = bool(re.search(r'\benr\b', header_lower))
    is_ad = bool(re.search(r'\bad\b', header_lower)) or "ad 2" in header_lower or "ad-2" in header_lower
    
    is_sid = bool(re.search(r'\bsid\b', header_lower)) or "standard departure" in text_lower or "instrument departure" in text_lower
    is_star = bool(re.search(r'\bstar\b', header_lower)) or "standard arrival" in text_lower or "instrument arrival" in text_lower
    is_iap = bool(re.search(r'\biac\b', header_lower)) or bool(re.search(r'\biap\b', header_lower)) or "instrument approach" in text_lower or "approach chart" in text_lower
    is_chart = "chart" in header_lower or "chart" in text_lower[:200].lower()

    category = "UNKNOWN"
    if is_gen:
        category = "GEN"
    elif is_enr:
        category = "ENR"
    elif is_sid:
        category = "SID"
    elif is_star:
        category = "STAR"
    elif is_iap:
        category = "IAP"
    elif is_ad:
        if is_chart:
            category = "AD_CHART"
        elif "runway physical characteristics" in text_lower or "rwy physical characteristics" in text_lower:
            category = "AD_RUNWAY"
        elif "runway" in text_lower or "rwy" in text_lower:
            has_table_fields = any(field in text_lower for field in ["dimension", "bearing strength", "tora", "toda", "asda", "lda"])
            if has_table_fields:
                category = "AD_RUNWAY"
            else:
                category = "AD_OTHER"
        else:
            category = "AD_OTHER"
            
    # Routing Logic
    route_to_runway = False
    route_to_procedure = False
    
    proc_keywords = ["sid", "star", "ils", "vor", "rnav", "departure", "arrival", "approach", "rnp", "ndb", "waypoint", "transition"]
    rwy_keywords = ["runway", "rwy", "tora", "toda", "asda", "lda", "dimension", "bearing strength", "declared distances", "physical characteristics"]
    
    has_proc_kws = any(kw in text_lower for kw in proc_keywords)
    has_rwy_kws = any(kw in text_lower for kw in rwy_keywords)
    
    if category == "AD_RUNWAY":
        route_to_runway = True
    elif category in ["SID", "STAR", "IAP", "ENR"]:
        route_to_procedure = True
    elif category == "AD_CHART":
        # If it's an aerodrome chart, it might contain runway layout, so route to both or based on keywords
        is_rwy_chart = any(kw in header_lower for kw in ["aerodrome chart", "docking chart", "obstacle chart", "movement chart"])
        if is_rwy_chart or has_rwy_kws:
            route_to_runway = True
        if not is_rwy_chart or has_proc_kws:
            route_to_procedure = True
    elif category == "AD_OTHER":
        if has_rwy_kws:
            route_to_runway = True
        if has_proc_kws:
            route_to_procedure = True
        # If it matches neither, default to runway
        if not route_to_runway and not route_to_procedure:
            route_to_runway = True
    else:
        # GEN, UNKNOWN
        if has_rwy_kws:
            route_to_runway = True
        if has_proc_kws:
            route_to_procedure = True
            
    return category, route_to_runway, route_to_procedure

runway_count = 0
proc_count = 0
both_count = 0

print("=== NEW ROUTING RESULTS ===")
for p_num in changed_pages:
    page = doc[p_num]
    text = page.get_text()
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    header = " | ".join(lines[:4])
    
    cat, r_rwy, r_proc = test_classify_and_route(text, header)
    
    route_str = ""
    if r_rwy and r_proc:
        route_str = "BOTH"
        both_count += 1
        runway_count += 1
        proc_count += 1
    elif r_rwy:
        route_str = "RUNWAY ONLY"
        runway_count += 1
    elif r_proc:
        route_str = "PROCEDURE ONLY"
        proc_count += 1
    else:
        route_str = "NONE"
        
    # Print sample mappings for review
    if p_num + 1 in [181, 187, 206, 211, 214, 238, 278, 281, 320, 358]:
        print(f"Page {p_num+1:3d} | Header: {header[:60]}... | Cat: {cat:8s} | Route: {route_str}")

print(f"\nSummary:")
print(f"  Total Changed Pages: {len(changed_pages)}")
print(f"  Routed to Runway prompt: {runway_count}")
print(f"  Routed to Procedure prompt: {proc_count}")
print(f"  Routed to both: {both_count}")
