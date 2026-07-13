import fitz

def scan_amendment_list(pdf_path):
    doc = fitz.open(pdf_path)
    print("Scanning amendment cover pages (Page 1-6) for replaced pages...")
    
    all_text = ""
    for i in range(6):
        all_text += doc[i].get_text()
        
    print("\nExtracting all lines matching AD 2 or ENR page names in the replacement list:")
    lines = all_text.split("\n")
    
    # 尋找包含 SID, STAR, IAC, 或 IAC 字眼的頁面標示
    matching_lines = []
    for line in lines:
        l_strip = line.strip()
        if not l_strip:
            continue
        # 匹配常見的頁面編號格式
        if "sid" in l_strip.lower() or "star" in l_strip.lower() or "iac" in l_strip.lower() or "approach" in l_strip.lower():
            matching_lines.append(l_strip)
            
    print(f"Found {len(matching_lines)} mentions of procedures in the replacement list:")
    for line in matching_lines:
        print(f"  {line}")

if __name__ == "__main__":
    pdf = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    scan_amendment_list(pdf)
