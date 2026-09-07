#!/usr/bin/env python3
"""Build the self-contained review page.

Usage:
  build_review.py <work_dir> [--out review.html] [--page] [--no-fonts]

--page: instead of the plain template, overlay the claims on a snapshot of the original web
page (work_dir/page.html, saved by extract_document.py). Scripts are removed, relative URLs
are resolved against the original site so its styles and images still load, and the overlay
is injected. The result looks like the site but is static; interactive widgets will not work.

Reads work_dir/document.json and work_dir/claims.json, inlines assets/overlay.js and the
claims, and writes work_dir/review.html: a single file with no external requests that
opens from disk, a static host, or a tunnel. Every claim's anchor is checked against the
rendered text before writing; orphans are listed on stderr and shown in the page bar.
"""
import argparse, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OVERLAY = os.path.join(HERE, "..", "assets", "overlay.js")

SANS = '"IBM Plex Sans",-apple-system,"Helvetica Neue",Helvetica,sans-serif'
SERIF = '"Source Serif 4",Georgia,"Iowan Old Style",serif'
CSS = f"""
:root{{color-scheme:light}}
body{{margin:0;background:#eeece6;color:#1c1b18;font:18px/1.7 {SERIF};text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}}
#document{{max-width:720px;margin:36px auto 0;padding:56px 64px 72px;background:#fff;border-radius:4px;box-shadow:0 1px 0 rgba(0,0,0,.05),0 0 0 1px #e6e3dc}}
#document h1{{font:700 30px/1.15 {SANS};letter-spacing:-.01em;margin:0 0 22px}}
#document h2{{font:700 20px/1.25 {SANS};margin:34px 0 10px}}
#document h3,#document h4,#document h5,#document h6{{font:700 17px/1.3 {SANS};margin:26px 0 8px}}
#document p{{margin:0 0 16px;text-wrap:pretty}}
#document ul{{margin:0 0 16px;padding-left:22px}}#document li{{margin:0 0 6px}}
#document blockquote{{margin:0 0 16px;padding-left:14px;border-left:3px solid #d9d5cb;color:#4a4740}}
#document .cell{{display:inline-block;margin:0 12px 6px 0;padding:2px 6px;background:#f7f7f5;border:1px solid #e3e3e0;border-radius:3px;font-size:.9em}}
#document a{{color:#2456a4;text-decoration-color:#a9bde0}}
@media (max-width:860px){{#document{{padding:32px 24px 48px;margin-top:16px}}}}
"""
# Optional webfonts. The page still works offline: the stacks above fall back to Georgia / system sans.
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">'


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


def build_page_snapshot(work_dir, doc, claims, out):
    src = open(os.path.join(work_dir, "page.html"), encoding="utf-8", errors="replace").read()
    base = doc.get("source", "")
    origin = re.match(r"https?://[^/]+", base).group(0) if re.match(r"https?://", base) else ""
    page = re.sub(r"<script\b[^>]*>.*?</script>", "", src, flags=re.S | re.I)
    page = re.sub(r"<noscript\b[^>]*>.*?</noscript>", "", page, flags=re.S | re.I)
    page = re.sub(r"\son[a-z]+=\"[^\"]*\"", "", page, flags=re.I)
    page = re.sub(r"<base\b[^>]*>", "", page, flags=re.I)
    if "<head" in page.lower():
        page = re.sub(r"(<head\b[^>]*>)", r"\1<base href=\"%s/\">" % (base.rsplit("/", 1)[0] if "/" in base[8:] else origin), page, count=1, flags=re.I)
    # Lazy-loaded images: promote data-src / srcset so pictures show without scripts.
    page = re.sub(r"<img\b([^>]*?)\sdata-src=", r"<img\1 src=", page, flags=re.I)
    overlay = open(OVERLAY, encoding="utf-8").read()
    data = json.dumps({"doc": base, "title": doc.get("title", ""), "claims": claims}, ensure_ascii=False).replace("</", "<\\/")
    inject = "<script>window.FACTCHECK = %s;</script>\n<script>%s</script>\n" % (data, overlay)
    page = re.sub(r"</body>", lambda m: inject + "</body>", page, count=1, flags=re.I) if re.search(r"</body>", page, re.I) else page + inject
    open(out, "w", encoding="utf-8").write(page)
    print(f"wrote {out} (page snapshot mode): {len(claims)} claims; orphans are reported in the page bar")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("work_dir"); ap.add_argument("--out")
    ap.add_argument("--no-fonts", action="store_true", help="skip the Google Fonts link (fully offline page)")
    ap.add_argument("--page", action="store_true", help="overlay on a snapshot of the original web page (work_dir/page.html)")
    a = ap.parse_args()
    doc = json.load(open(os.path.join(a.work_dir, "document.json")))
    claims = json.load(open(os.path.join(a.work_dir, "claims.json")))
    out = a.out or os.path.join(a.work_dir, "review.html")
    if a.page:
        return build_page_snapshot(a.work_dir, doc, claims, out)
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
{'' if a.no_fonts else FONTS}
<style>{CSS}</style>
</head><body>
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
