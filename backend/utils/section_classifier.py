import re

def classify_page(page_text: str) -> str:
    """
    Classifies an AIP page into a category based on headers and keywords:
    - GEN: General Info
    - ENR: En-route Info
    - SID: Standard Instrument Departures
    - STAR: Standard Terminal Arrivals
    - IAP: Instrument Approach Procedures
    - AD_RUNWAY: Runway physical characteristics and declared distances
    - AD_OTHER: Other Aerodrome details
    - UNKNOWN: Fallback
    """
    text_lower = page_text.lower()
    
    # Get first 10 lines for header/footer analysis
    lines = [line.strip() for line in page_text.split("\n") if line.strip()]
    header = " | ".join(lines[:10])
    header_lower = header.lower()
    
    is_gen = bool(re.search(r'\bgen\b', header_lower))
    is_enr = bool(re.search(r'\benr\b', header_lower))
    is_ad = bool(re.search(r'\bad\b', header_lower)) or "ad 2" in header_lower or "ad-2" in header_lower
    
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
        if "runway physical characteristics" in text_lower or "rwy physical characteristics" in text_lower:
            return "AD_RUNWAY"
        if "runway" in text_lower or "rwy" in text_lower:
            has_table_fields = any(field in text_lower for field in ["dimension", "bearing strength", "tora", "toda", "asda", "lda"])
            if has_table_fields:
                return "AD_RUNWAY"
                
        return "AD_OTHER"
        
    if "standard departure chart" in text_lower:
        return "SID"
    if "standard arrival chart" in text_lower:
        return "STAR"
    if "instrument approach chart" in text_lower or "approach chart" in text_lower:
        return "IAP"
        
    return "UNKNOWN"
