# Kram Studios — Static Website

## What’s included
- Home / Portfolio / About / Contact pages
- Portfolio grid with lightbox (keyboard + mobile-friendly)
- `gallery.json` controls what images appear

## How to preview locally
Open `index.html` by double-clicking (basic), or run a local server (recommended):
```bash
python -m http.server 8080
```
Then open http://localhost:8080

## How to add more images (manual for now)
1. Put full images in: `assets/gallery/full/`
2. Put thumbnails in: `assets/gallery/thumb/`
3. Add entries to `gallery.json`

## Next milestone (recommended)
We’ll add an auto-ingest script that scans a folder (including subfolders) and generates:
- optimized full images + thumbnails
- `gallery.json` automatically
- multiple categories/galleries