import os
import sys
import subprocess
import requests

from dotenv import load_dotenv
load_dotenv(dotenv_path="/Users/wsl/Code/AIP_Reader/.env")
TOKEN = os.getenv("HF_TOKEN", "")
WEATHER_REPO = "sunnywslau/aip-amendment-parser"
NEW_SPACE_NAME = "aip-pdf-summarizer-backend"

def run_cmd(cmd):
    print(f"Running: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error: {res.stderr}")
        return False, res.stderr
    return True, res.stdout

def pause_and_deploy():
    # 1. Install huggingface_hub if not present
    try:
        from huggingface_hub import HfApi
    except ImportError:
        print("huggingface_hub not found. Installing...")
        run_cmd(f"{sys.executable} -m pip install huggingface_hub")
        from huggingface_hub import HfApi

    api = HfApi(token=TOKEN)
    
    # 2. Pause the existing weather space
    print(f"Attempting to pause space: {WEATHER_REPO}...")
    try:
        api.pause_space(repo_id=WEATHER_REPO)
        print(f"Successfully requested pause for {WEATHER_REPO}.")
    except Exception as e:
        print(f"Warning/Error pausing space: {e}")
        print("We will attempt to proceed anyway.")
        
    # 3. Request user info to get username
    headers = {"Authorization": f"Bearer {TOKEN}"}
    r = requests.get("https://huggingface.co/api/whoami-v2", headers=headers)
    if r.status_code != 200:
        print(f"Failed to authenticate with Hugging Face: {r.text}")
        return
    username = r.json().get("name")
    
    # 4. Try creating the new Docker space now
    print(f"Creating new Docker space '{NEW_SPACE_NAME}' under user '{username}'...")
    create_url = "https://huggingface.co/api/repos/create"
    payload = {
        "name": NEW_SPACE_NAME,
        "type": "space",
        "sdk": "docker",
        "private": False,
        "hardware": "cpu-basic"
    }
    
    r_create = requests.post(create_url, headers=headers, json=payload)
    if r_create.status_code in [200, 201]:
        print(f"Space '{NEW_SPACE_NAME}' created successfully!")
    elif r_create.status_code == 409:
        print(f"Space '{NEW_SPACE_NAME}' already exists. Proceeding to deploy.")
    else:
        print(f"Failed to create Space (HTTP {r_create.status_code}): {r_create.text}")
        print("Hugging Face may still enforce the subscription check. Let's try running deployment using the Streamlit-based app.py fallback if needed.")
        return

    # 5. Build git remote url and push the files
    local_dir = "/Users/wsl/Code/AIP_Reader/temp_hf_deploy"
    if os.path.exists(local_dir):
        import shutil
        shutil.rmtree(local_dir)
    os.makedirs(local_dir)
    
    # Copy backend files (using the original Dockerfile structure)
    backend_src = "/Users/wsl/Code/AIP_Reader/aip-pdf-summarizer/backend"
    import shutil
    for item in os.listdir(backend_src):
        s = os.path.join(backend_src, item)
        d = os.path.join(local_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
            
    # We should restore the original app.py as fastapi entrypoint for Docker!
    # Because for Docker, the entrypoint should be app.py which uvicorn runs directly.
    # Let's overwrite app.py in deployment directory to be the clean fastapi app
    shutil.copy2(os.path.join(backend_src, "fastapi_app.py"), os.path.join(local_dir, "app.py"))
    
    # Initialize Git
    run_cmd(f"git init", cwd=local_dir)
    run_cmd(f"git config user.name 'Antigravity'", cwd=local_dir)
    run_cmd(f"git config user.email 'antigravity@google.com'", cwd=local_dir)
    run_cmd(f"git add .", cwd=local_dir)
    run_cmd(f"git commit -m 'Deploy FastAPI backend to Hugging Face Spaces'", cwd=local_dir)
    
    hf_remote_url = f"https://:{TOKEN}@huggingface.co/spaces/{username}/{NEW_SPACE_NAME}"
    run_cmd(f"git remote add origin {hf_remote_url}", cwd=local_dir)
    
    print("Pushing to Hugging Face Spaces...")
    success, output = run_cmd("git push -u origin master --force", cwd=local_dir)
    if not success:
        success, output = run_cmd("git push -u origin main --force", cwd=local_dir)
        
    if success:
        print("\n==============================================")
        print("🎉 Deployment Completed Successfully!")
        print(f"Hugging Face Space URL: https://huggingface.co/spaces/{username}/{NEW_SPACE_NAME}")
        print(f"API Endpoint URL (to paste in Extension settings):")
        print(f"👉 https://{username}-{NEW_SPACE_NAME.replace('_', '-')}.hf.space")
        print("==============================================")
    else:
        print(f"Failed to push to Hugging Face Space: {output}")

if __name__ == "__main__":
    # Run using the local venv python to make sure we use correct pip env
    pause_and_deploy()
