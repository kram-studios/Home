#!/usr/bin/env python3
"""
Kram Studios - Gallery Builder (v5)
-----------------------------------
Bulk-import photos from any folder, generate thumbnails, and rebuild gallery.json.

Usage:
  # Option A: photos already placed in assets/gallery/full
  python build_gallery.py

  # Option B: import from another folder (keeps subfolders)
  python build_gallery.py --source "/path/to/your/photos"

Requires Pillow:
  python -m pip install pillow
"""

from __future__ import annotations

from pathlib import Path
import argparse
import json
import shutil

from PIL import Image, ImageOps

EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
THUMB_MAX = 1400       # max width/height for thumbnails
JPEG_QUALITY = 82      # thumbnail quality

def is_image(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in EXTS

def rel_web(p: Path) -> str:
    return str(p).replace("\\", "/")

def safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)

def make_thumb(src_path: Path, dst_path: Path) -> None:
    safe_mkdir(dst_path.parent)

    img = Image.open(src_path)
    img = ImageOps.exif_transpose(img)  # fixes phone rotation

    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    else:
        img = img.convert("RGB")

    img.thumbnail((THUMB_MAX, THUMB_MAX))

    dst_path = dst_path.with_suffix(".jpg")
    img.save(dst_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)

def import_source(source_dir: Path, full_dir: Path) -> int:
    """Copy images from source_dir into full_dir preserving subfolders."""
    if not source_dir.exists():
        raise FileNotFoundError(f"Source folder does not exist: {source_dir}")

    copied = 0
    for p in source_dir.rglob("*"):
        if is_image(p):
            rel = p.relative_to(source_dir)
            dest = full_dir / rel
            safe_mkdir(dest.parent)
            shutil.copy2(p, dest)
            copied += 1
    return copied

def build(full_dir: Path, thumb_dir: Path, gallery_json: Path) -> int:
    safe_mkdir(full_dir)
    safe_mkdir(thumb_dir)

    photos = []
    for p in sorted(full_dir.rglob("*")):
        if not is_image(p):
            continue

        rel_full = p.relative_to(gallery_json.parent)
        rel_under_full = p.relative_to(full_dir)

        rel_thumb = (thumb_dir / rel_under_full).relative_to(gallery_json.parent)
        rel_thumb = rel_thumb.with_suffix(".jpg")

        make_thumb(p, gallery_json.parent / rel_thumb)

        photos.append({
            "src": rel_web(rel_full),
            "thumb": rel_web(rel_thumb),
            "alt": "Kram Studios",
            "category": "Featured"
        })

    data = {
        "brand": "Kram Studios",
        "service_area": "Located in VA — shoots anywhere in the US",
        "categories": [
            {"name": "Featured", "slug": "featured", "photos": photos}
        ]
    }
    gallery_json.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return len(photos)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=str, default="~/Desktop/full_Photos", help="Folder containing photos to import (optional). Default: ~/Desktop/full_Photos")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    full_dir = root / "assets" / "gallery" / "full"
    thumb_dir = root / "assets" / "gallery" / "thumb"
    gallery_json = root / "gallery.json"

    if args.source.strip():
        source_dir = Path(args.source).expanduser().resolve()
        copied = import_source(source_dir, full_dir)
        print(f"✅ Imported {copied} photos into {full_dir}")

    total = build(full_dir, thumb_dir, gallery_json)
    print(f"✅ Rebuilt gallery.json with {total} photos")
    print(f"✅ Thumbnails updated in {thumb_dir}")

if __name__ == "__main__":
    main()
