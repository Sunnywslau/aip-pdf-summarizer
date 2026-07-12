import os
import sys
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Add the current directory to path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.intel_agent import IntelAgent

load_dotenv()

app = FastAPI(
    title="AIP Amendment Parser API",
    description="Backend service for filtering and analyzing large AIP Amendments.",
    version="1.0"
)

# Enable CORS for Chrome Extension origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows extension origins (chrome-extension://...)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = IntelAgent()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "AIP Amendment Parser API",
        "description": "Post PDF binary file to /analyze to get the change report."
    }

@app.post("/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    x_gemini_api_key: Optional[str] = Header(None)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        pdf_bytes = await file.read()
        report_text = agent.analyze_aip(pdf_bytes, user_api_key=x_gemini_api_key)
        return {
            "filename": file.filename,
            "analysis": report_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")
