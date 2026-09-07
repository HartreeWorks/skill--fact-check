#!/usr/bin/env python3
"""Fetch each source into sources/<slug>.txt so quotes can be verified by string search.

Usage:
  fetch_source.py <sources_dir> <url-or-file> [<url-or-file> ...] [--account EMAIL]
  fetch_source.py <sources_dir> --list sources.txt        # one URL per line, optional "slug<TAB>url"

Handles HTML (tags stripped, scripts dropped), PDF (pdftotext if installed, else pypdf),
Google Docs (gdoc CLI, else export URL), and bot-blocked pages (403/429/503 fall back to
the newest Wayback Machine snapshot). Appends a row per source to sources/index.tsv:
slug, status (ok, THIN for under 500 characters, FAILED), bytes, url, how.
"""
import argparse, html, json, os, re, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request, urllib.error

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"


def slugify(url):
    u = re.sub(r"^https?://(www\.)?", "", url).strip("/")
    u = re.sub(r"[^A-Za-z0-9]+", "-", u).strip("-")
    return u[:80].lower() or "source"


def html_to_text(s):
    s = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>|</(p|div|li|h[1-6]|tr|blockquote|section|article)>", "\n", s, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", " ", s))
    t = re.sub(r"[ \t ]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t).strip() + "\n"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(), r.headers.get("Content-Type", ""), r.geturl()


def wayback(url):
    q = "https://archive.org/wayback/available?url=" + urllib.parse.quote(url, safe="")
    avail = json.load(urllib.request.urlopen(q, timeout=30))
    return avail.get("archived_snapshots", {}).get("closest", {}).get("url")


def pdf_to_text(data):
    if shutil.which("pdftotext"):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(data); p = f.name
        r = subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True)
        os.unlink(p)
        if r.returncode == 0: return r.stdout
    try:
        import io, pypdf
        return "\n".join(pg.extract_text() or "" for pg in pypdf.PdfReader(io.BytesIO(data)).pages)
    except ImportError:
        raise RuntimeError("PDF: install poppler (pdftotext) or `pip install pypdf`")


def google_doc(doc_id, account):
    if shutil.which("gdoc"):
        r = subprocess.run(["gdoc", "cat"] + (["--account", account] if account else []) + [doc_id], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip(): return r.stdout, "gdoc cat"
    data, _, _ = get(f"https://docs.google.com/document/d/{doc_id}/export?format=txt")
    return data.decode("utf-8", errors="replace"), "docs export"


def fetch_one(target, account):
    """Return (text, how)."""
    if os.path.exists(target):
        data = open(target, "rb").read()
        if target.lower().endswith(".pdf"): return pdf_to_text(data), "local pdf"
        if target.lower().endswith((".html", ".htm")): return html_to_text(data.decode("utf-8", errors="replace")), "local html"
        return data.decode("utf-8", errors="replace"), "local file"
    m = re.search(r"docs\.google\.com/document/d/([A-Za-z0-9_-]+)", target)
    if m: return google_doc(m.group(1), account)
    try:
        data, ctype, final = get(target); how = "fetched"
    except urllib.error.HTTPError as e:
        if e.code not in (403, 429, 503): raise
        snap = wayback(target)
        if not snap: raise RuntimeError(f"HTTP {e.code} and no Wayback snapshot")
        data, ctype, final = get(snap); how = f"wayback {snap}"
    if "pdf" in ctype.lower() or data[:5] == b"%PDF-": return pdf_to_text(data), how + " (pdf)"
    text = data.decode("utf-8", errors="replace")
    if "html" in ctype.lower() or "<html" in text[:2000].lower(): return html_to_text(text), how + " (html)"
    return text, how + " (text)"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sources_dir"); ap.add_argument("targets", nargs="*")
    ap.add_argument("--list", help="file with one target per line, optionally 'slug<TAB>url'")
    ap.add_argument("--account", help="gdoc account email for Google Doc sources")
    a = ap.parse_args()
    os.makedirs(a.sources_dir, exist_ok=True)
    items = [(None, t) for t in a.targets]
    if a.list:
        for line in open(a.list):
            line = line.strip()
            if not line or line.startswith("#"): continue
            parts = line.split("\t")
            items.append((parts[0], parts[1]) if len(parts) == 2 else (None, parts[0]))
    index = open(os.path.join(a.sources_dir, "index.tsv"), "a")
    ok = 0
    for slug, target in items:
        slug = slug or slugify(target)
        try:
            text, how = fetch_one(target, a.account)
            path = os.path.join(a.sources_dir, slug + ".txt")
            open(path, "w").write(text)
            status = "ok" if len(text.strip()) >= 500 else "THIN"
            index.write(f"{slug}\t{status}\t{len(text)}\t{target}\t{how}\n")
            print(f"{status:<5} {slug}.txt  {len(text):>8} chars  {how}" + ("  (too little text to cite; fetch it another way)" if status == "THIN" else ""))
            ok += 1
        except Exception as e:
            index.write(f"{slug}\tFAILED\t0\t{target}\t{e}\n")
            print(f"FAIL  {slug}  {target}  {e}")
    index.close()
    print(f"{ok}/{len(items)} fetched into {a.sources_dir}")


if __name__ == "__main__":
    main()
