import os
import fitz
import google.generativeai as genai
from typing import Dict, Optional
from utils.change_bar_detector import detect_change_bars
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
            # Step 1: Detect changed pages in memory
            changed_pages_0idx = detect_change_bars(pdf_bytes)
            
            # Open PDF from bytes stream
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            runway_pages = []
            procedure_pages = []
            
            # Step 2: Classify pages
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
            
            # Step 3a: Analyze Runway Changes
            runway_report = ""
            if runway_pages:
                runway_text_content = ""
                for p in runway_pages:
                    runway_text_content += f"\n--- PAGE {p['page_num']} ({p['category']}) ---\n{p['text']}\n"
                
                runway_prompt = f"""
You are an expert aviation operations analyst. I will provide you with the text extracted from revised pages of an AIP (Aeronautical Information Publication) Amendment document. 
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
