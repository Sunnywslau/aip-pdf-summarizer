import os
import fitz
import google.generativeai as genai
from dotenv import load_dotenv
from change_bar_detector import detect_change_bars
from section_classifier import classify_page

# 載入環境變數
load_dotenv()

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment.")
    
    genai.configure(api_key=api_key)
    # 使用 gemini-3.5-flash 確保能使用免費額度且分析速度快
    model = genai.GenerativeModel('gemini-3.5-flash')
    
    pdf_path = "/Users/wsl/Code/AIP_Reader/data/Taiwan_AIP_AMDT.pdf"
    
    print("Step 1: Detecting changed pages using Change Bars...")
    changed_pages_0idx = detect_change_bars(pdf_path)
    print(f"Found {len(changed_pages_0idx)} pages with changes out of all pages.")
    
    print("\nStep 2: Classifying pages and extracting text...")
    doc = fitz.open(pdf_path)
    
    runway_pages = []
    procedure_pages = []
    other_pages = []
    
    for page_num in changed_pages_0idx:
        page = doc[page_num]
        text = page.get_text()
        category = classify_page(text)
        
        page_info = {
            "page_num": page_num + 1,
            "category": category,
            "text": text
        }
        
        if category in ["AD_RUNWAY", "AD_OTHER"]:
            runway_pages.append(page_info)
        elif category in ["SID", "STAR", "IAP", "UNKNOWN"]:
            procedure_pages.append(page_info)
        else:
            other_pages.append(page_info)
            
    print(f"Runway candidate pages: {len(runway_pages)}")
    print(f"Procedure candidate pages (SID/STAR/IAP): {len(procedure_pages)}")
    print(f"Other changed pages: {len(other_pages)}")
    
    # 執行 Runway 分析
    runway_report = ""
    if runway_pages:
        print("\nStep 3a: Analyzing Runway Changes with Gemini...")
        runway_text_content = ""
        for p in runway_pages:
            runway_text_content += f"\n--- PAGE {p['page_num']} ({p['category']}) ---\n{p['text']}\n"
            
        runway_prompt = f"""
You are an expert aviation operations analyst. I will provide you with the text extracted from revised pages of a Taiwan AIP (Aeronautical Information Publication) Amendment document. 
These pages contain change bars indicating modified values.

Please identify and extract any RUNWAY data changes. 
Runway data changes include changes to:
- Runway designator, dimensions (length/width), surface type, strength (PCN)
- Threshold coordinates, elevation, geoid undulation
- Declared distances (TORA, TODA, ASDA, LDA)
- Runway lighting or visual aids (approach lights, runway lights, PAPI, etc.)

For each runway change, please provide:
1. Airport Code & Name (e.g. RCTP / Taoyuan)
2. Runway (e.g. 05L/23R)
3. Parameter Changed & Description (Old vs New values, or what was modified)
4. Page Number

Format your response in Traditional Chinese (Taiwan) in a Markdown table.
If no runway changes are found, please state "未偵測到跑道資料變更。".

Here is the text to analyze:
{runway_text_content}
"""
        try:
            response = model.generate_content(runway_prompt)
            runway_report = response.text
            print("Runway analysis completed successfully.")
        except Exception as e:
            runway_report = f"Error analyzing runway data: {e}"
            print(runway_report)
    else:
        runway_report = "未偵測到跑道相關變更頁面。"
        
    # 執行 Procedure 分析
    procedure_report = ""
    if procedure_pages:
        print("\nStep 3b: Analyzing Procedure Changes (SID/STAR/IAP) with Gemini...")
        proc_text_content = ""
        for p in procedure_pages:
            proc_text_content += f"\n--- PAGE {p['page_num']} ({p['category']}) ---\n{p['text']}\n"
            
        proc_prompt = f"""
You are an expert aviation operations analyst. I will provide you with the text extracted from revised pages of a Taiwan AIP (Aeronautical Information Publication) Amendment document. 
These pages contain change bars indicating modified values.

Please identify and extract any changes related to:
1. Standard Instrument Departures (SIDs)
2. Standard Terminal Arrival Routes (STARs)
3. Instrument Approach Procedures (IAPs) / Instrument Approach Charts (IACs)

For each procedure change, please identify:
1. Airport Code & Name (e.g. RCTP / Taoyuan)
2. Procedure Type (SID, STAR, or IAP)
3. Procedure Name (e.g. KADLO 1A, ILS Y Rwy 05L)
4. Description of the change (e.g. new waypoints, altitude/speed restrictions, modified path, or if it is a NEW/CANCELLED procedure)
5. Page Number

Format your response in Traditional Chinese (Taiwan) in a Markdown table.
If no procedure changes are found, please state "未偵測到程序資料變更。".

Here is the text to analyze:
{proc_text_content}
"""
        try:
            response = model.generate_content(proc_prompt)
            procedure_report = response.text
            print("Procedure analysis completed successfully.")
        except Exception as e:
            procedure_report = f"Error analyzing procedure data: {e}"
            print(procedure_report)
    else:
        procedure_report = "未偵測到離到場或進場程序變更頁面。"
        
    # 整合報告
    print("\nStep 4: Generating consolidate report...")
    output_path = "/Users/wsl/Code/AIP_Reader/data/poc_result.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# AIP Amendment 變更分析報告 (POC)\n\n")
        f.write(f"本報告由 AIP Parser 預處理 (Change Bar 偵測 + 機場章節分類) 後，送交 Gemini 1.5 Pro 生成。\n\n")
        f.write(f"- **總頁數**: {len(doc)}\n")
        f.write(f"- **偵測到變更的頁數**: {len(changed_pages_0idx)}\n")
        f.write(f"- **跑道變更候選頁面**: {len(runway_pages)} 頁\n")
        f.write(f"- **程序變更候選頁面**: {len(procedure_pages)} 頁\n\n")
        
        f.write("## 一、 跑道資料變更 (Runway Data Changes)\n\n")
        f.write(runway_report)
        f.write("\n\n---\n\n")
        
        f.write("## 二、 儀器程序變更 (SID / STAR / IAP Changes)\n\n")
        f.write(procedure_report)
        
    print(f"POC report generated successfully at: {output_path}")

if __name__ == "__main__":
    main()
