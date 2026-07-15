import os
import shutil
import subprocess

from dotenv import load_dotenv
load_dotenv(dotenv_path="/Users/wsl/Code/AIP_Reader/.env")
TOKEN = os.getenv("HF_TOKEN", "")
EXISTING_REPO = "sunnywslau/aip-amendment-parser"

def run_cmd(cmd, cwd=None):
    print(f"Running: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    if res.returncode != 0:
        print(f"Error: {res.stderr}")
        return False, res.stderr
    return True, res.stdout

def deploy_to_existing():
    local_dir = "/Users/wsl/Code/AIP_Reader/temp_hf_deploy_existing"
    if os.path.exists(local_dir):
        shutil.rmtree(local_dir)
    os.makedirs(local_dir)
    
    # Copy backend files
    backend_src = "/Users/wsl/Code/AIP_Reader/aip-pdf-summarizer/backend"
    for item in os.listdir(backend_src):
        s = os.path.join(backend_src, item)
        d = os.path.join(local_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
            
    # For Docker Space, app.py must be the FastAPI entrypoint that runs on startup.
    # Let's overwrite app.py in deployment directory to be the clean fastapi app with uvicorn start at bottom
    shutil.copy2(os.path.join(backend_src, "fastapi_app.py"), os.path.join(local_dir, "app.py"))
    
    # Append uvicorn launch code to app.py to make sure it runs on port 7860
    with open(os.path.join(local_dir, "app.py"), "a") as f:
        f.write("\n\nif __name__ == '__main__':\n    import uvicorn\n    port = int(os.getenv('PORT', 7860))\n    uvicorn.run(app, host='0.0.0.0', port=port)\n")
        
    # Create the README.md with the Hugging Face metadata frontmatter
    readme_content = """---
title: AIP Amendment Parser
emoji: ✈️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# AIP Amendment Parser API
FastAPI backend service running in Docker.
"""
    readme_path = os.path.join(local_dir, "README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)

    # Initialize Git
    run_cmd("git init", cwd=local_dir)
    run_cmd("git config user.name 'Antigravity'", cwd=local_dir)
    run_cmd("git config user.email 'antigravity@google.com'", cwd=local_dir)
    run_cmd("git add .", cwd=local_dir)
    run_cmd("git commit -m 'Overwriting existing Space with FastAPI AIP Amendment Parser backend'", cwd=local_dir)
    
    # remote url format: https://user:TOKEN@huggingface.co/spaces/USERNAME/SPACE_NAME
    hf_remote_url = f"https://:{TOKEN}@huggingface.co/spaces/{EXISTING_REPO}"
    run_cmd(f"git remote add origin {hf_remote_url}", cwd=local_dir)
    
    print(f"Deploying to existing Space '{EXISTING_REPO}'...")
    success, output = run_cmd("git push -u origin master --force", cwd=local_dir)
    if not success:
        success, output = run_cmd("git push -u origin main --force", cwd=local_dir)
        
    if success:
        print("\n==============================================")
        print("🎉 Deployment Completed Successfully!")
        print(f"Hugging Face Space URL: https://huggingface.co/spaces/{EXISTING_REPO}")
        print(f"API Endpoint URL (to paste in Extension settings):")
        print(f"👉 https://sunnywslau-aip-amendment-parser.hf.space")
        print("==============================================")
    else:
        print(f"Failed to push changes: {output}")

if __name__ == "__main__":
    deploy_to_existing()
