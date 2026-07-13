import fitz
import os
import sys

# Add path
sys.path.append("/Users/wsl/Code/AIP_Reader")
from utils.change_bar_detector import detect_change_bars

data_dir = "/Users/wsl/Code/AIP_Reader/data"
files = ["RP_Amendment.pdf", "SQ_AMDT-04-2026.pdf", "VD-amdt-en-GB-A08-26.pdf"]

for fn in files:
    fp = os.path.join(data_dir, fn)
    if not os.path.exists(fp):
        print(f"File not found: {fn}")
        continue
    try:
        doc = fitz.open(fp)
        changed = detect_change_bars(fp)
        print(f"File: {fn}")
        print(f"  Total Pages: {len(doc)}")
        print(f"  Changed Pages: {len(changed)}")
        print(f"  Changed Page Numbers (1-based): {[x+1 for x in changed]}")
    except Exception as e:
        print(f"Error reading {fn}: {e}")
