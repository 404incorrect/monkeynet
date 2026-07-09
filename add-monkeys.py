#!/usr/bin/env python3
"""Append new monkey pics (in monkeys/_new/) to monkeys.js as base64 JPEGs.

Usage:  python add-monkeys.py
"""
import os
import io
import glob
import base64
import sys
import subprocess

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
NEW_DIR = os.path.join(ROOT, "monkeys", "_new")
JS = os.path.join(ROOT, "monkeys.js")

MAX_SIZE = 480
QUALITY = 78
EXTS = ("*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.PNG", "*.JPG", "*.JPEG")

def collect():
    # set() dedupes files matched by both *.jpg and *.JPG on case-insensitive
    # filesystems; sorted() gives a stable append order.
    return sorted({f for e in EXTS for f in glob.glob(os.path.join(NEW_DIR, e))})

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
        uris.append(encode(f))
        print(f"  + {os.path.basename(f)}")
    entries = ",\n" + ",\n".join(f'"{u}"' for u in uris)
    content = f"{content[:-2]}{entries}\n];\n"
    open(JS, "w", encoding="utf-8").write(content)
    for f in files:
        os.remove(f)
    print(f"Added {len(uris)} monkey(s). monkeys.js is now {os.path.getsize(JS) / 1024:.0f} KB.")
    git_deploy(len(uris))


def git_deploy(n):
    """Commit monkeys.js and push, so the changes deploy."""
    msg = f"add {n} monkey{'' if n == 1 else 's'}"
    steps = [
        ["git", "add", "monkeys.js"],
        ["git", "commit", "-m", msg],
        ["git", "push"],
    ]
    print("\nDeploying...")
    for step in steps:
        print(f"  $ {' '.join(step)}")
        result = subprocess.run(step, cwd=ROOT)
        if result.returncode != 0:
            print(f"  ! '{' '.join(step)}' failed (exit {result.returncode}). Stopping.")
            return
    print("Pushed. monkeynet.org will redeploy shortly.")

if __name__ == "__main__":
    main()
