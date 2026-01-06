#!/bin/bash
set -e

cd "$(dirname "$0")"

python -m pip install --quiet pillow || true

python build_gallery.py --source "/Users/balumadduluri/Desktop/Kram Website/full_Photos"

echo ""
echo "✅ Done. Press Enter to close."
read
