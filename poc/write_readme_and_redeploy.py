import os
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

def redeploy_with_readme():
    local_dir = "/Users/wsl/Code/AIP_Reader/temp_hf_deploy_existing"
    
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
        
    print("README.md written with Hugging Face Space metadata.")
    
    # Commit and push
    run_cmd("git add README.md", cwd=local_dir)
    run_cmd("git commit -m 'Add README.md with Space configuration'", cwd=local_dir)
    
    print("Pushing to Hugging Face...")
    success, output = run_cmd("git push origin main --force", cwd=local_dir)
    
    if success:
        print("🎉 Code pushed successfully. Monitoring build...")
    else:
        print(f"Push failed: {output}")

if __name__ == "__main__":
    redeploy_with_readme()
