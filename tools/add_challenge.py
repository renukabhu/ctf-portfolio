#!/usr/bin/env python3
"""Copy a challenge folder into the portfolio and add/refresh its entry in challenges.json.

Usage:
    python3 tools/add_challenge.py SOURCE_DIR [SOURCE_DIR ...] [--category web] [--slug name]

Pass several SOURCE_DIRs when the same challenge ran in more than one quarter
(oldest first). Files are copied from the last one; every one is listed as an event.

The source folder is only read, never modified. What gets copied:
  * pages and static assets players see (index.html, robots.txt, templates/, src/, ...)
  * files listed under `provide:` in challenge.yml (what players could download)
What is left out: Docker/npm files, the unused main.js template script, solve
scripts (they go into the manifest's hidden solution instead), challenge.yml
itself (its plaintext flag would spoil the challenge), and server code that was
never handed to players.

Server-side behaviour is ported by hand: put a `sw.js` (Express-style routes,
see emu/express-sw.js) or a `port.js` (page-level port, see emu/flask-lite.js)
in challenges/<slug>/. Re-running this script keeps those files and wires them
into the page.
"""
import argparse
import base64
import json
import re
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "challenges.json"
KEY = b"post-it"  # must match emu/secret.js

SKIP_NAMES = {
    "Dockerfile", "docker-compose.yml", "docker-compose.yaml", "package.json",
    "package-lock.json", "node_modules", "main.js", ".DS_Store", "__pycache__",
    "challenge.yml", "challenge.yaml",
}
SERVER_FILES = {"app.js", "app.py", "server.js", "server.py", "flag.txt"}
SOLVE_RE = re.compile(r"^solve(\..+)?$")
HAND_PORTS = {"sw.js", "port.js", "env.js"}
TERMS = {"w": ("Winter", 0), "s": ("Spring", 1), "f": ("Fall", 2)}
GROUPS = {"cyber-gm": "Cyber GM", "cyber-academy": "Cyber Academy", "cyber-lab": "Cyber Lab",
          "pbrctf": "PBR CTF", "pwn-gang": "Pwn Gang"}
CATEGORY_ALIASES = {"fundamentals": "web"}


def encode(s: str) -> str:
    data = s.encode()
    return base64.b64encode(bytes(b ^ KEY[i % len(KEY)] for i, b in enumerate(data))).decode()


def event_for(src: Path):
    """cyber-challs-w26/cyber-gm/web/x -> ("Cyber GM", "Winter 2026", sort_key)."""
    parts = src.resolve().parts
    for i, p in enumerate(parts):
        m = re.fullmatch(r"(?:cyber-challs|cyber-gm)-([wsf])(\d\d)", p)
        if m:
            term, order = TERMS[m.group(1)]
            year = 2000 + int(m.group(2))
            group = "cyber-gm" if p.startswith("cyber-gm-") else parts[i + 1]
            return {"group": GROUPS.get(group, group), "term": f"{term} {year}", "sort": year * 10 + order}
    return {"group": "", "term": "", "sort": 0}


def load_yaml(src: Path):
    for name in ("challenge.yml", "challenge.yaml"):
        if (src / name).exists():
            return yaml.safe_load((src / name).read_text())
    sys.exit(f"no challenge.yml in {src}")


def copy_tree(src: Path, dest: Path, provide: set):
    for path in sorted(src.rglob("*")):
        rel = path.relative_to(src)
        if any(part in SKIP_NAMES for part in rel.parts) or path.is_dir():
            continue
        relpath = rel.as_posix()
        if SOLVE_RE.match(rel.name) and len(rel.parts) == 1:
            continue
        if len(rel.parts) == 1 and rel.name in SERVER_FILES and relpath not in provide:
            continue
        out = dest / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, out)
    # Flask apps keep their landing page in templates/, poster-wall in src/.
    # Static hosting serves the folder's index.html, so put a copy there.
    if not (dest / "index.html").exists():
        for cand in ("templates/index.html", "src/index.html", "public/index.html"):
            if (dest / cand).exists():
                shutil.copy2(dest / cand, dest / "index.html")
                break


def inject(dest: Path):
    tags = []
    if (dest / "env.js").exists() and (dest / "port.js").exists():
        tags.append('<script src="env.js"></script>')
    if (dest / "sw.js").exists():
        tags.append('<script src="../../emu/client.js"></script>')
    if (dest / "port.js").exists():
        tags.append('<script type="module" src="port.js"></script>')
    if not tags:
        return
    snippet = "\n".join(["<!-- portfolio: backend ported to run in the browser -->", *tags]) + "\n"
    pages = [dest / "index.html"] + ([dest / "src/index.html"] if (dest / "src/index.html").exists() else [])
    for page in pages:
        html = page.read_text()
        if "portfolio: backend ported" in html:
            continue
        idx = html.lower().rfind("</head>")
        if idx == -1:
            idx = html.lower().rfind("</body>")
        html = html[:idx] + snippet + html[idx:] if idx != -1 else html + snippet
        page.write_text(html)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sources", nargs="+", type=Path)
    ap.add_argument("--category")
    ap.add_argument("--slug")
    args = ap.parse_args()

    src = args.sources[-1]
    meta = load_yaml(src)
    slug = args.slug or src.name
    dest = ROOT / "challenges" / slug

    # Fresh copy of the originals, keeping hand-written ports.
    keep = {}
    if dest.exists():
        keep = {p.name: p.read_bytes() for p in dest.iterdir() if p.name in HAND_PORTS - {"env.js"}}
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for name, data in keep.items():
        (dest / name).write_bytes(data)

    provide = {re.sub(r"^\./", "", p) for p in (meta.get("provide") or [])}
    copy_tree(src, dest, provide)

    env = {}
    for c in (meta.get("containers") or {}).values():
        env.update({k: str(v) for k, v in (c.get("environment") or {}).items()})
    env["CHALLENGE_FLAG"] = str(meta["flag"])
    ported = (dest / "sw.js").exists() or (dest / "port.js").exists()
    if ported:  # only ported backends need it; static challenges stay as shipped
        (dest / "env.js").write_text(
            "// Generated by tools/add_challenge.py: the container's environment, lightly encoded.\n"
            "(function () {\n"
            "  var k = 'post-it', s = atob(" + json.dumps(encode(json.dumps(env))) + "), o = '';\n"
            "  for (var i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length));\n"
            "  self.__ENV = Object.assign(self.__ENV || {}, JSON.parse(decodeURIComponent(escape(o))));\n"
            "})();\n"
        )
    inject(dest)

    description = str(meta.get("description", "")).strip()
    # Old hosted links (e.g. *.acmcyber.com) point at servers that no longer exist.
    description = re.sub(r"\[[^\]]*\]\(https?://[^)]*acmcyber\.com[^)]*\)", "{{ link }}", description)

    solve_files = {p.name: p.read_text() for p in src.iterdir() if SOLVE_RE.match(p.name) and p.is_file()}
    events = [event_for(s) for s in args.sources]
    category = args.category or CATEGORY_ALIASES.get(src.parent.name, src.parent.name)

    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    entry = next((e for e in manifest if e["slug"] == slug), None)
    if entry is None:
        entry = {"slug": slug}
        manifest.append(entry)
    entry.update({
        "name": meta.get("name", slug),
        "category": category,
        "points": meta.get("value"),
        "events": [{"group": e["group"], "term": e["term"]} for e in events],
        "sort": max(e["sort"] for e in events),
        "description": description,
        "play": f"challenges/{slug}/" if (dest / "index.html").exists() else None,
        "files": sorted(f"challenges/{slug}/{p}" for p in provide if (dest / p).exists()),
        "in_browser_backend": (dest / "sw.js").exists() or (dest / "port.js").exists(),
        "flag": encode(str(meta["flag"])),
        "solve_files": solve_files,
    })
    entry.setdefault("solution", "")
    manifest.sort(key=lambda e: (-e["sort"], e["slug"]))
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"{slug}: {len(list(dest.rglob('*')))} files -> challenges/{slug}/")


if __name__ == "__main__":
    main()
