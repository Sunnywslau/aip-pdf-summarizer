from huggingface_hub import HfApi
import inspect

api = HfApi()
methods = [m[0] for m in inspect.getmembers(api, predicate=inspect.ismethod)]
print("=== HfApi Methods ===")
for m in methods:
    if "space" in m.lower() or "log" in m.lower():
        print(f"  {m}")
