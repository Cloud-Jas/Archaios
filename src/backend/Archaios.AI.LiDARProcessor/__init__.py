import sys
from pathlib import Path

# Add the project root directory to Python path
root_dir = str(Path(__file__).parent.parent.parent)
if root_dir not in sys.path:
    sys.path.append(root_dir)

# Package initialization
