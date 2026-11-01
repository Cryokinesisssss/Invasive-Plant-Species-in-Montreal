import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = ROOT / "notebooks" / "ChecksPassed.ipynb"


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    notebook = json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))
    original_directory = Path.cwd()
    os.chdir(NOTEBOOK_PATH.parent)
    try:
        namespace = {"__name__": "__main__"}
        for index, cell in enumerate(notebook.get("cells", [])):
            if cell.get("cell_type") != "code":
                continue
            source = "".join(cell.get("source", []))
            print(f"Running notebook code cell {index}", flush=True)
            exec(compile(source, f"{NOTEBOOK_PATH.name} cell {index}", "exec"), namespace)
    finally:
        os.chdir(original_directory)


if __name__ == "__main__":
    main()
