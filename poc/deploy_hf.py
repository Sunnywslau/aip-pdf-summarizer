import os
import shutil
import subprocess
import requests
import json

from dotenv import load_dotenv
load_dotenv(dotenv_path="/Users/wsl/Code/AIP_Reader/.env")
TOKEN = os.getenv("HF_TOKEN", "")
SPACE_NAME = "aip-pdf-summarizer-backend"

def run_cmd(cmd, cwd=None):
    print(f"Running: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    if res.returncode != 0:
        print(f"Error executing command: {res.stderr}")
        return False, res.stderr
    return True, res.stdout

def deploy():
    # 1. Get user info from Hugging Face
    headers = {"Authorization": f"Bearer {TOKEN}"}
    r = requests.get("https://huggingface.co/api/whoami-v2", headers=headers)
    if r.status_code != 200:
        print(f"Failed to authenticate with Hugging Face (HTTP {r.status_code}): {r.text}")
        return
        
    user_info = r.json()
    username = user_info.get("name")
    print(f"Authenticated successfully as user: {username}")
    
    # 2. Create the Space repository if it does not exist
    create_url = "https://huggingface.co/api/repos/create"
    payload = {
        "name": SPACE_NAME,
        "type": "space",
        "sdk": "streamlit",
        "private": False,
        "hardware": "cpu-basic"
    }
    
    r_create = requests.post(create_url, headers=headers, json=payload)
    if r_create.status_code in [200, 201]:
        print(f"Space '{SPACE_NAME}' created successfully.")
    elif r_create.status_code == 409:
        print(f"Space '{SPACE_NAME}' already exists. Proceeding to update files.")
    else:
        print(f"Failed to create Space (HTTP {r_create.status_code}): {r_create.text}")
        return
        
    # 3. Prepare temporary local git repo for Hugging Face Space
    local_dir = "/Users/wsl/Code/AIP_Reader/temp_hf_deploy"
    if os.path.exists(local_dir):
        shutil.rmtree(local_dir)
    os.makedirs(local_dir)
    
    # Copy backend files into deployment directory
    backend_src = "/Users/wsl/Code/AIP_Reader/temp_repo/backend"
    for item in os.listdir(backend_src):
        s = os.path.join(backend_src, item)
        d = os.path.join(local_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
            
    print("Files copied to deployment directory.")
    
    # 4. Initialize Git and commit files
    run_cmd("git init", cwd=local_dir)
    # Configure dummy git user locally in this temp repo
    run_cmd("git config user.name 'Antigravity'", cwd=local_dir)
    run_cmd("git config user.email 'antigravity@google.com'", cwd=local_dir)
    
    run_cmd("git add .", cwd=local_dir)
    run_cmd("git commit -m 'Initial deployment of FastAPI AIP Amendment Parser backend'", cwd=local_dir)
    
    # 5. Push to Hugging Face Space
    # Remote URL format: https://user:TOKEN@huggingface.co/spaces/USERNAME/SPACE_NAME
    hf_remote_url = f"https://:{TOKEN}@huggingface.co/spaces/{username}/{SPACE_NAME}"
    run_cmd(f"git remote add origin {hf_remote_url}", cwd=local_dir)
    
    print("Pushing to Hugging Face Spaces (this might take a few seconds)...")
    # Force push to overwrite any previous deployment content
    success, output = run_cmd("git push -u origin master --force", cwd=local_dir)
    if not success:
        # Some repos use 'main' instead of 'master'
        success, output = run_cmd("git push -u origin main --force", cwd=local_dir)
        
    if success:
        print("\n==============================================")
        print("🎉 Deployment Completed Successfully!")
        print(f"Hugging Face Space URL: https://huggingface.co/spaces/{username}/{SPACE_NAME}")
        print(f"API Endpoint URL (to paste in Extension settings):")
        print(f"👉 https://{username}-{SPACE_NAME.replace('_', '-')}.hf.space")
        print("==============================================")
    else:
        print(f"Failed to push to Hugging Face: {output}")

if __name__ == "__main__":
    deploy()
