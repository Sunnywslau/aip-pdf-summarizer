import os
import sys
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Add the current directory to path to resolve imports correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.intel_agent import IntelAgent
from services.sup_agent import SupAgent

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
sup_agent = SupAgent()

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
    x_gemini_api_key: Optional[str] = Header(None),
    x_deepseek_api_key: Optional[str] = Header(None),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        pdf_bytes = await file.read()
        res_dict = agent.analyze_aip(
            pdf_bytes,
            user_api_key=x_gemini_api_key,
            user_deepseek_key=x_deepseek_api_key,
        )
        return {
            "filename": file.filename,
            "analysis": res_dict["analysis"],
            "model_used": res_dict["model_used"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


class SupRequest(BaseModel):
    text: str
    system_prompt: str = None
    model: str = None


@app.post("/analyze-sup")
async def analyze_sup(
    body: SupRequest,
    x_deepseek_api_key: Optional[str] = Header(None),
    x_gemini_api_key: Optional[str] = Header(None),
):
    """Summarize an AIP SUP / AIC document via server-side LLM call.
    Accepts extracted text (not a PDF). Tries DeepSeek first, then Gemini.
    All calls originate from the Hugging Face server, bypassing regional
    and corporate firewall restrictions on AI endpoints.
    """
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text field is required and must not be empty.")
    if not x_deepseek_api_key and not x_gemini_api_key:
        raise HTTPException(
            status_code=401,
            detail="Provide at least one of: X-DeepSeek-API-Key or X-Gemini-API-Key header.",
        )
    try:
        res_dict = await sup_agent.summarize(
            text=body.text,
            user_deepseek_key=x_deepseek_api_key,
            user_gemini_key=x_gemini_api_key,
            system_prompt=body.system_prompt,
            model=body.model,
        )
        return {
            "summary": res_dict["summary"],
            "model_used": res_dict["model_used"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to summarize document: {str(e)}")
