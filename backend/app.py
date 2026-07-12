import os
import sys
import uvicorn

# Add current path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi_app import app

# Hijack Streamlit execution by starting uvicorn directly on port 7860
if __name__ == "__main__" or True:
    port = int(os.getenv("PORT", 7860))
    print(f"Hijacking Streamlit process. Starting uvicorn on port {port}...")
    uvicorn.run("fastapi_app:app", host="0.0.0.0", port=port, reload=False)
