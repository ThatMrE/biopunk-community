#!/usr/bin/env python3
"""Check that every local link and asset reference in the site resolves.

Catches the real failure mode of a static site: a renamed image or a page
link that quietly 404s. Only local references are checked - external URLs,
mailto:, tel: and anchors are reported but never fetched, so the check stays
offline and deterministic.

Usage:  check_links.py [ROOT]        (default: repo root)
Exits 1 if any local reference is missing.
"""
import pathlib
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "www"}
ATTRS = {"href", "src", "poster", "data-src", "action"}


class Refs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ATTRS and value:
                self.refs.append(value.strip())
            if name == "srcset" and value:
                for part in value.split(","):
                    url = part.strip().split(" ")[0]
                    if url:
                        self.refs.append(url)


def is_local(ref):
    if not ref or ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return False
    p = urlparse(ref)
    return not p.scheme and not p.netloc


def site_roots(root):
    """Where a root-relative path like /favicon.png can legitimately live.

    A static site is often published from a build directory that does not
    exist in the repo (Vite's dist/), with public/ copied into it verbatim.
    Resolving /foo against the repo root alone reports the whole site as
    broken, so accept any candidate root.
    """
    roots = [root]
    for name in ("public", "static", "site", "src"):
        d = root / name
        if d.is_dir():
            roots.append(d)
    toml = root / "netlify.toml"
    if toml.exists():
        m = re.search(r'^\s*publish\s*=\s*"([^"]+)"', toml.read_text(
            encoding="utf-8", errors="ignore"), re.M)
        if m:
            d = (root / m.group(1)).resolve()
            if d.is_dir() and d not in roots:
                roots.append(d)
    return roots


def redirect_targets(root):
    """Paths served by a redirect/rewrite rule rather than by a file."""
    out = set()
    for name in ("_redirects", "netlify.toml", "vercel.json"):
        f = root / name
        if not f.exists():
            continue
        text = f.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r'^\s*(/\S+)\s+\S+', text, re.M):
            out.add(m.group(1).rstrip("*"))
        for m in re.finditer(r'from\s*=\s*"([^"]+)"', text):
            out.add(m.group(1).rstrip("*"))
    return out


def main():
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    roots = site_roots(root)
    redirects = redirect_targets(root)
    pages = [p for p in root.rglob("*.html")
             if not any(d in p.parts for d in SKIP_DIRS)]
    if not pages:
        print("no HTML pages found", file=sys.stderr)
        return 0

    missing, checked = [], 0
    for page in pages:
        parser = Refs()
        parser.feed(page.read_text(encoding="utf-8", errors="ignore"))
        for ref in parser.refs:
            if not is_local(ref):
                continue
            target = unquote(urlparse(ref).path)
            if not target:
                continue
            checked += 1
            if target.rstrip("/") in redirects or target in redirects:
                continue
            bases = roots if target.startswith("/") else [page.parent]
            rel = target.lstrip("/")
            if any((b / rel).exists() or (b / rel / "index.html").exists()
                   or (b / (rel + ".html")).exists() for b in bases):
                continue
            missing.append((page.relative_to(root), ref))

    print(f"checked {checked} local references across {len(pages)} pages")
    print("site roots: " + ", ".join(str(r.relative_to(root)) or "." for r in roots))
    if missing:
        print(f"\n{len(missing)} broken:", file=sys.stderr)
        for page, ref in sorted(set(missing)):
            print(f"  {page}: {ref}", file=sys.stderr)
        return 1
    print("all local references resolve")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
