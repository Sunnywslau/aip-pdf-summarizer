from huggingface_hub import HfApi

import os
from dotenv import load_dotenv
load_dotenv(dotenv_path="/Users/wsl/Code/AIP_Reader/.env")
TOKEN = os.getenv("HF_TOKEN", "")
REPO_ID = "sunnywslau/aip-amendment-parser"

def resume():
    api = HfApi(token=TOKEN)
    print(f"Restarting/resuming space: {REPO_ID}...")
    try:
        api.restart_space(repo_id=REPO_ID)
        print("Successfully restarted the space.")
    except Exception as e:
        print(f"Error restarting space: {e}")

if __name__ == "__main__":
    resume()
