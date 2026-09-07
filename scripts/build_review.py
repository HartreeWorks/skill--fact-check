#!/usr/bin/env python3
"""Build the self-contained review page.

Usage:
  build_review.py <work_dir> [--out review.html]

Reads work_dir/document.json and work_dir/claims.json, inlines assets/overlay.js and the
claims, and writes work_dir/review.html: a single file with no external requests that
opens from disk, a static host, or a tunnel. Every claim's anchor is checked against the
rendered text before writing; orphans are listed on stderr and shown in the page bar.
"""
import argparse, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OVERLAY = os.path.join(HERE, "..", "assets", "overlay.js")

CSS = """
:root{color-scheme:light}
body{margin:0;background:#f4f4f2;color:#1a1a1a;font:17px/1.6 Georgia,'Times New Roman',serif}
#document{max-width:760px;margin:0 auto;padding:40px 24px 120px;background:#fff;box-shadow:0 0 0 1px #e6e6e3}
#document h1{font:700 2rem/1.2 -apple-system,Helvetica,Arial,sans-serif;margin:0 0 .6em}
#document h2{font:700 1.4rem/1.25 -apple-system,Helvetica,Arial,sans-serif;margin:1.6em 0 .5em}
#document h3,#document h4,#document h5,#document h6{font:700 1.1rem/1.3 -apple-system,Helvetica,Arial,sans-serif;margin:1.4em 0 .4em}
#document p{margin:0 0 1em}
#document li{margin:0 0 .4em}
#document blockquote{margin:0 0 1em;padding:0 0 0 14px;border-left:3px solid #ccc;color:#444}
#document .cell{display:inline-block;margin:0 12px 6px 0;padding:2px 6px;background:#f7f7f5;border:1px solid #e3e3e0;border-radius:3px;font-size:.9em}
#document a{color:#0b6bcb}
#fc-meta{max-width:760px;margin:0 auto;padding:10px 24px;font:12px/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#666}
#fc-meta a{color:#0b6bcb}
"""


def norm(s):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), (" ", " ")): s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def render_block(b):
    t, h = b["type"], b.get("html") or html.escape(b["text"])
    if t == "heading": lvl = min(max(int(b.get("level", 2)), 1), 6); return f"<h{lvl}>{h}</h{lvl}>"
    if t == "list": return f"<li>{h}</li>"
    if t == "quote": return f"<blockquote>{h}</blockquote>"
    if t == "cell": return f'<span class="cell">{h}</span>'
    return f"<p>{h}</p>"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("work_dir"); ap.add_argument("--out")
    a = ap.parse_args()
    doc = json.load(open(os.path.join(a.work_dir, "document.json")))
    claims = json.load(open(os.path.join(a.work_dir, "claims.json")))
    out = a.out or os.path.join(a.work_dir, "review.html")
    # Render blocks, grouping consecutive list items.
    parts, in_list = [], False
    for b in doc["blocks"]:
        if b["type"] == "list" and not in_list: parts.append("<ul>"); in_list = True
        if b["type"] != "list" and in_list: parts.append("</ul>"); in_list = False
        parts.append(render_block(b))
    if in_list: parts.append("</ul>")
    body = "\n".join(parts)
    # Anchor check against the rendered text.
    text = norm(html.unescape(re.sub(r"<[^>]+>", " ", body.replace("</li>", " </li>"))))
    text_tight = norm(html.unescape(re.sub(r"</?(a|strong|em|b|i|code|sup|sub|u|s)\b[^>]*>", "", body)))
    orphans = [c for c in claims if norm(c.get("anchor", "")) not in text_tight]
    for c in orphans: sys.stderr.write(f"orphan {c['id']}: {c.get('anchor','')[:80]}\n")
    overlay = open(OVERLAY, encoding="utf-8").read()
    data = json.dumps({"doc": doc.get("source", ""), "title": doc.get("title", ""), "claims": claims}, ensure_ascii=False).replace("</", "<\\/")
    title = doc.get("title") or "Fact check"
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fact check: {html.escape(title)}</title>
<style>{CSS}</style>
</head><body>
<div id="fc-meta">Fact check of <a href="{html.escape(doc.get('source',''))}" target="_blank" rel="noopener">{html.escape(doc.get('source',''))}</a>. Hover a highlight for sources; click to pin and record a decision. Decisions stay in this browser until you copy them out.</div>
<div id="document">
{body}
</div>
<script>window.FACTCHECK = {data};</script>
<script>{overlay}</script>
</body></html>
"""
    open(out, "w", encoding="utf-8").write(page)
    from collections import Counter
    c = Counter(x.get("status", "unchecked") for x in claims)
    print(f"wrote {out}: {len(claims)} claims, {len(orphans)} orphaned, " + ", ".join(f"{k} {v}" for k, v in c.most_common()))
    if orphans: sys.exit(2)


if __name__ == "__main__":
    main()
