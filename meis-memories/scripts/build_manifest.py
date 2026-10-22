#!/usr/bin/env python3
"""Scan the images/ folder and write data/manifest.json.

The website reads that file to know which photos exist, so you never have to
edit code when you add a photo.  On GitHub this runs automatically on every
upload.  With --optimize it also shrinks huge phone photos (in the deployed
copy only) so the site opens fast on mobile data.

Folder rules (inside images/):
  cover/                      first photo = big photo on the home page
  gallery/                    loose photos, plus sub-folders = albums
  kids/                       name-then.jpg + name-now.jpg  (flip cards)
  trips/<YYYY-MM-DD_Name>/    one folder per trip
  memories/                   polaroid wall (file name = caption)
  members/                    one photo per person (file name = name)
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
UNSUPPORTED = {".heic", ".heif"}


def nat(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def pretty(stem, title=True):
    s = re.sub(r"^\d+[\s._-]+", "", stem)          # drop "01-" ordering prefix
    s = re.sub(r"[-_]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    words = s.split(" ")
    if title:
        return " ".join(w[:1].upper() + w[1:] for w in words)
    return s[:1].upper() + s[1:]


def keyify(stem):
    s = re.sub(r"^\d+[\s._-]+", "", stem).lower()
    return re.sub(r"[^a-z0-9؀-ۿ]+", "-", s).strip("-")


def files_in(d):
    if not d.is_dir():
        return []
    return sorted(
        (p for p in d.iterdir()
         if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in EXT),
        key=lambda p: nat(p.name),
    )


def subdirs(d):
    if not d.is_dir():
        return []
    return sorted(
        (p for p in d.iterdir() if p.is_dir() and not p.name.startswith((".", "_"))),
        key=lambda p: nat(p.name),
    )


def optimize(path, max_side, quality):
    """Shrink one photo in place. Returns the (possibly new) path."""
    ext = path.suffix.lower()
    if ext in (".gif", ".avif"):
        return path
    from PIL import Image, ImageOps

    size = path.stat().st_size
    with Image.open(path) as src:
        w, h = src.size
        if max(w, h) <= max_side and size <= 700_000:
            return path
        src.load()
        im = ImageOps.exif_transpose(src)
    im.thumbnail((max_side, max_side), Image.LANCZOS)

    if ext in (".jpg", ".jpeg"):
        im.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
        return path
    if ext == ".webp":
        im.save(path, "WEBP", quality=quality)
        return path
    # PNG: big opaque PNGs are photos -> turn them into JPEG
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    target = path.with_suffix(".jpg")
    if not has_alpha and size > 500_000 and not target.exists():
        im.convert("RGB").save(target, "JPEG", quality=quality, optimize=True, progressive=True)
        path.unlink()
        return target
    im.save(path, "PNG", optimize=True)
    return path


def read_size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            w, h = im.size
            try:
                if im.getexif().get(0x0112) in (5, 6, 7, 8):
                    w, h = h, w
            except Exception:
                pass
            return [w, h]
    except Exception:
        return None


TRIP_RE = re.compile(r"^(\d{4})-(\d{2})(?:-(\d{2}))?[\s._-]+(.+)$")


def parse_trip(folder):
    m = TRIP_RE.match(folder)
    if not m:
        return "", pretty(folder)
    y, mo, d, rest = m.groups()
    return f"{y}-{mo}" + (f"-{d}" if d else ""), pretty(rest)


def main():
    here = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(here), help="site folder (default: this project)")
    ap.add_argument("--optimize", action="store_true", help="shrink big photos first")
    ap.add_argument("--max-side", type=int, default=1600)
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()

    root = Path(args.root).resolve()
    img_root = root / "images"
    img_root.mkdir(exist_ok=True)

    for p in img_root.rglob("*"):
        if p.suffix.lower() in UNSUPPORTED:
            print(f"WARNING: {p.relative_to(root)} is HEIC/HEIF - browsers can't show it. "
                  f"Re-save it as JPG.", file=sys.stderr)

    if args.optimize:
        try:
            import PIL  # noqa: F401
        except ImportError:
            print("Pillow not installed - skipping photo shrinking.", file=sys.stderr)
        else:
            for p in sorted(img_root.rglob("*")):
                if p.is_file() and p.suffix.lower() in EXT and not any(
                        part.startswith((".", "_")) for part in p.relative_to(img_root).parts):
                    try:
                        optimize(p, args.max_side, args.quality)
                    except Exception as e:  # never fail the deploy over one photo
                        print(f"Could not shrink {p.name}: {e}", file=sys.stderr)

    def rel(p):
        return p.relative_to(root).as_posix()

    manifest = {"generated": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}

    manifest["cover"] = [rel(p) for p in files_in(img_root / "cover")]

    g = img_root / "gallery"
    manifest["gallery"] = {
        "albums": [
            {"name": pretty(d.name), "images": [rel(p) for p in files_in(d)]}
            for d in subdirs(g) if files_in(d)
        ],
        "loose": [rel(p) for p in files_in(g)],
    }

    kids = {}
    for p in files_in(img_root / "kids"):
        stem = re.sub(r"^\d+[\s._-]+", "", p.stem)
        m = re.match(r"^(.*?)[\s._-]+(then|now)$", stem, re.I)
        base, side = (m.group(1), m.group(2).lower()) if m else (stem, "then")
        k = kids.setdefault(keyify(base), {"key": keyify(base), "name": pretty(base), "then": None, "now": None})
        k[side] = rel(p)
    manifest["kids"] = list(kids.values())

    trips = []
    for d in subdirs(img_root / "trips"):
        date, name = parse_trip(d.name)
        trips.append({"folder": d.name, "date": date, "name": name, "images": [rel(p) for p in files_in(d)]})
    trips.sort(key=lambda t: (t["date"] == "", t["date"], nat(t["name"])))
    manifest["trips"] = trips

    manifest["memories"] = [
        {"src": rel(p), "caption": pretty(p.stem, title=False)} for p in files_in(img_root / "memories")
    ]
    manifest["members"] = [
        {"src": rel(p), "key": keyify(p.stem), "name": pretty(p.stem)} for p in files_in(img_root / "members")
    ]

    paths = set(manifest["cover"])
    for a in manifest["gallery"]["albums"]:
        paths.update(a["images"])
    paths.update(manifest["gallery"]["loose"])
    for k in manifest["kids"]:
        paths.update(x for x in (k["then"], k["now"]) if x)
    for t in manifest["trips"]:
        paths.update(t["images"])
    paths.update(m["src"] for m in manifest["memories"])
    paths.update(m["src"] for m in manifest["members"])
    sizes = {}
    for rp in sorted(paths):
        s = read_size(root / rp)
        if s:
            sizes[rp] = s
    manifest["sizes"] = sizes

    out = root / "data" / "manifest.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {out.relative_to(root)}: {len(paths)} photos, {len(trips)} trips, "
          f"{len(manifest['members'])} people, {len(manifest['kids'])} kid cards.")


if __name__ == "__main__":
    main()
