import requests
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path="/Users/wsl/Code/AIP_Reader/.env")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
API_URL = "https://sunnywslau-aip-amendment-parser.hf.space/analyze"
PDF_PATH = "/Users/wsl/Code/AIP_Reader/data/VD-amdt-en-GB-A08-26.pdf"

print(f"Sending request to: {API_URL}")
print(f"Using Gemini Key: {GEMINI_KEY}")

files = {"file": ("VD-amdt-en-GB-A08-26.pdf", open(PDF_PATH, "rb"), "application/pdf")}
headers = {"X-Gemini-API-Key": GEMINI_KEY}

res = requests.post(API_URL, files=files, headers=headers)
print(f"\nResponse Status Code: {res.status_code}")
try:
    print("Response JSON:")
    import json
    print(json.dumps(res.json(), indent=2))
except Exception:
    print("Response Text:")
    print(res.text)
