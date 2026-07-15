import os
import fitz
import google.generativeai as genai
from typing import Dict, Optional
from utils.change_bar_detector import detect_change_bars, get_change_bar_spans, get_annotated_text
from utils.section_classifier import classify_page

class IntelAgent:
    def analyze_aip(self, pdf_bytes: bytes, user_api_key: Optional[str] = None) -> str:
        """
        Analyzes AIP PDF bytes using Change Bar detection + page classification,
        then calls Gemini 3.5 Flash using the dynamically provided API key.
        """
        # Configure API key dynamically
        active_key = user_api_key or os.getenv("GEMINI_API_KEY")
        if not active_key:
            return "Error: No Gemini API Key provided. Please set it in the Extension Settings."
            
        genai.configure(api_key=active_key)
        model = genai.GenerativeModel('gemini-3.5-flash')
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            # --- Cover Sheet / Change Summary Extraction ---
            summary_pages_text = []
            for page_idx in range(min(3, len(doc))):
                p_text = doc[page_idx].get_text()
                p_text_lower = p_text.lower()
                has_summary_kws = any(kw in p_text_lower for kw in ["summary of changes", "summary of aeronautical information changes", "highlights", "hand amendments", "contains the following"])
                if has_summary_kws or page_idx == 0:
                    summary_pages_text.append(f"--- Cover Page {page_idx+1} Change Summary ---\n{p_text}\n")
            change_summary_context = "\n".join(summary_pages_text) if summary_pages_text else "No high-level change summary found."
            
            # Step 1: Detect changed pages in memory
            changed_pages_0idx = detect_change_bars(pdf_bytes)
            changed_pages_set = set(changed_pages_0idx)
            
            runway_pages = []
            procedure_pages = []
            
            # 分流關鍵字定義
            proc_keywords = ["sid", "star", "ils", "vor", "rnav", "departure", "arrival", "approach", "rnp", "ndb", "waypoint", "transition"]
            rwy_keywords = ["runway", "rwy", "tora", "toda", "asda", "lda", "dimension", "bearing strength", "declared distances", "physical characteristics"]
            
            # Step 2: Classify and route pages
            for page_num in range(len(doc)):
                page = doc[page_num]
                raw_text = page.get_text()
                category = classify_page(raw_text)
                text_lower = raw_text.lower()
                
                has_cb = page_num in changed_pages_set
                is_procedure_chart = category in ["AD_CHART", "SID", "STAR", "IAP"]
                
                if not (has_cb or is_procedure_chart):
                    continue
                
                # If page has change bars, annotate line-level changes
                if has_cb:
                    cb_spans = get_change_bar_spans(page)
                    annotated_text = get_annotated_text(page, cb_spans)
                else:
                    annotated_text = raw_text
                    
                page_info = {
                    "page_num": page_num + 1,
                    "category": category,
                    "text": annotated_text
                }
                
                has_proc_kws = any(kw in text_lower for kw in proc_keywords)
                has_rwy_kws = any(kw in text_lower for kw in rwy_keywords)
                
                route_to_runway = False
                route_to_procedure = False
                
                if category == "AD_RUNWAY":
                    route_to_runway = True
                elif category in ["SID", "STAR", "IAP", "ENR"]:
                    route_to_procedure = True
                elif category == "AD_CHART":
                    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
                    header_lower = " | ".join(lines[:4]).lower()
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
                    if not route_to_runway and not route_to_procedure:
                        route_to_runway = True
                else:
                    if has_rwy_kws:
                        route_to_runway = True
                    if has_proc_kws:
                        route_to_procedure = True
                
                if route_to_runway:
                    runway_pages.append(page_info)
                if route_to_procedure:
                    procedure_pages.append(page_info)
            
            # Step 3a: Analyze Runway Changes
            runway_report = ""
            if runway_pages:
                runway_text_content = ""
                for p in runway_pages:
                    runway_text_content += f"\n--- PAGE {p['page_num']} ({p['category']}) ---\n{p['text']}\n"
                
                runway_prompt = f"""
You are an expert aviation operations analyst. I will provide you with the text extracted from revised pages of an AIP (Aeronautical Information Publication) Amendment document. 

High-level Change Summary (from the amendment cover sheet):
<summary>
{change_summary_context}
</summary>

Please identify and extract any RUNWAY data changes. 
Runway data changes include changes to:
- Runway designator, dimensions (length/width), surface type, strength (PCN)
- Threshold coordinates, elevation, geoid undulation
- Declared distances (TORA, TODA, ASDA, LDA)
- Runway lighting or visual aids (approach lights, runway lights, PAPI, etc.)

Use the high-level summary above to help you identify which airports have runway changes, and verify those changes against the actual page text below.

For each runway change, please provide:
1. Airport Code & Name (e.g. RCTP / Taoyuan)
2. Runway (e.g. 05L/23R)
3. Parameter Changed & Description (Old vs New values, or what was modified)
4. Page Number

Format your response in English in a Markdown table.
If no runway changes are found, please state "No runway data changes detected.".

Here is the text to analyze:
{runway_text_content}
"""
                response = model.generate_content(runway_prompt)
                runway_report = response.text
            else:
                runway_report = "No runway data changes detected."
 
            # Step 3b: Analyze Procedure Changes
            procedure_report = ""
            if procedure_pages:
                proc_text_content = ""
                for p in procedure_pages:
                    proc_text_content += f"\n--- PAGE {p['page_num']} ({p['category']}) ---\n{p['text']}\n"
                
                proc_prompt = f"""
You are an expert aviation operations analyst. I will provide you with the text extracted from revised pages of an AIP (Aeronautical Information Publication) Amendment document. 

High-level Change Summary (from the amendment cover sheet):
<summary>
{change_summary_context}
</summary>

Please identify and extract any changes related to:
1. Standard Instrument Departures (SIDs)
2. Standard Terminal Arrival Routes (STARs)
3. Instrument Approach Procedures (IAPs) / Instrument Approach Charts (IACs)

Use the high-level summary above to help you identify which airports have procedure changes, and extract the details from the actual page text below.

For each procedure change, please identify:
1. Airport Code & Name (e.g. RCTP / Taoyuan)
2. Procedure Type (SID, STAR, or IAP)
3. Procedure Name (e.g. KADLO 1A, ILS Y Rwy 05L)
4. Description of the change (e.g. new waypoints, altitude/speed restrictions, modified path, or if it is a NEW/CANCELLED procedure)
5. Page Number

Format your response in English in a Markdown table.
If no procedure changes are found, please state "No procedure changes detected.".

Here is the text to analyze:
{proc_text_content}
"""
                response = model.generate_content(proc_prompt)
                procedure_report = response.text
            else:
                procedure_report = "No procedure changes detected."
 
            # Step 4: Consolidate
            analysis_md = f"""# AIP Amendment Change Analysis Report
*   **Total Pages**: {len(doc)}
*   **Changed Pages (with Change Bars)**: {len(changed_pages_0idx)}
*   **Runway Candidate Pages**: {len(runway_pages)}
*   **Procedure Candidate Pages**: {len(procedure_pages)}
 
## 1. Runway Data Changes
{runway_report}
 
---
 
## 2. Instrument Procedure Changes (SID / STAR / IAP)
{procedure_report}
"""
            return analysis_md
        except Exception as e:
            return f"Error during AI analysis: {e}"
