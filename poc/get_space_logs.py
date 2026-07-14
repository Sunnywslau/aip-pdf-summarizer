from huggingface_hub import HfApi
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="/Users/wsl/Code/AIP_Reader/.env")
TOKEN = os.getenv("HF_TOKEN", "")
REPO_ID = "sunnywslau/aip-amendment-parser"

api = HfApi(token=TOKEN)
try:
    print("=== LIVE CONTAINER RUNTIME LOGS ===")
    # fetch_space_logs returns a generator of logs
    logs = api.fetch_space_logs(repo_id=REPO_ID)
    
    # Print the logs retrieved so far
    # Since it's a stream, we will print the first 100 log lines and then stop
    count = 0
    for log_line in logs:
        print(log_line, end="")
        count += 1
        if count >= 150:
            break
except Exception as e:
    print(f"Error fetching logs: {e}")
