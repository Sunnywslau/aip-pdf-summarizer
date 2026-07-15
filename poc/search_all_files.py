import os

def search_files(directory):
    keywords = ["amdt", "amendment", "sup", "aic"]
    for root, dirs, files in os.walk(directory):
        if ".git" in root:
            continue
        for file in files:
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                # Check for keywords
                found = []
                for kw in keywords:
                    if kw in content.lower():
                        found.append(kw)
                
                if found:
                    print(f"File: {file_path}")
                    print(f"  Found keywords: {found}")
                    
                    # Print matching lines
                    lines = content.split("\n")
                    for i, line in enumerate(lines):
                        for kw in keywords:
                            if kw in line.lower():
                                print(f"    Line {i+1}: {line.strip()[:100]}")
            except Exception as e:
                # Skip binary files or decoding errors
                pass

if __name__ == "__main__":
    search_files("/Users/wsl/Code/AIP_Reader/aip-pdf-summarizer")
