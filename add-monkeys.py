#!/usr/bin/env python3
"""Append new monkey pics (in monkeys/_new/) to monkeys.js as base64 JPEGs.

Usage:  python add-monkeys.py
"""
import os, io, glob, base64, sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow not installed. Run:  pip install Pillow")

ROOT = os.path.dirname(os.path.abspath(__file__))
NEW_DIR = os.path.join(ROOT, "monkeys", "_new")
JS = os.path.join(ROOT, "monkeys.js")

MAX_SIZE = 480
QUALITY = 78
EXTS = ("*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.PNG", "*.JPG", "*.JPEG")

def collect():
    files = []
    for e in EXTS:
        files += glob.glob(os.path.join(NEW_DIR, e))
    return sorted(set(files))

def encode(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((MAX_SIZE, MAX_SIZE))
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=QUALITY)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def main():
    files = collect()
    if not files:
        print("No new pics in monkeys/_new/ — nothing to do.")
        return
    content = open(JS, encoding="utf-8").read().rstrip()
    if not content.endswith("];"):
        sys.exit("monkeys.js does not end with '];' — aborting to avoid corruption.")
    uris = []
    for f in files:
        try:
            uris.append(encode(f))
            print("  +", os.path.basename(f))
        except Exception as ex:
            print("  ! skipped", os.path.basename(f), "-", ex)
    if not uris:
        return
    entries = ",\n" + ",\n".join('"%s"' % u for u in uris)
    content = content[:-2] + entries + "\n];\n"
    open(JS, "w", encoding="utf-8").write(content)
    for f in files:
        try: os.remove(f)
        except OSError: pass
    print("Added %d monkey(s). monkeys.js is now %.0f KB." % (len(uris), os.path.getsize(JS) / 1024))
    print("Next:")
    print("  git add monkeys.js")
    print("  git commit -m 'add monkeys'")
    print("  git push")

if __name__ == "__main__":
    main()
