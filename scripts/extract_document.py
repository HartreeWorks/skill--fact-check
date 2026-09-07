#!/usr/bin/env python3
"""Turn the document under review into document.json and document.txt.

Usage:
  extract_document.py <input> <out_dir> [--account EMAIL] [--selector CSS]

<input> is one of:
  - a web page URL
  - a Google Doc URL or id  (read with the gdoc CLI if installed, else the export URL)
  - a local .html or .md file

Writes:
  out_dir/document.json   {"source", "title", "blocks": [{"type", "text", "html", "links"}]}
  out_dir/document.txt    one block per line, plain text (what claims are anchored to)
  out_dir/links.txt       every distinct outbound URL, one per line (for linkcheck.sh)

Block types: heading, paragraph, list, quote, cell. The html field keeps inline links,
bold and italics so the review page reads like the original.
"""
import argparse, html, json, os, re, shutil, subprocess, sys, urllib.request, urllib.error
from html.parser import HTMLParser

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
BLOCK_TAGS = {"h1": "heading", "h2": "heading", "h3": "heading", "h4": "heading", "h5": "heading", "h6": "heading",
              "p": "paragraph", "li": "list", "blockquote": "quote", "td": "cell", "th": "cell", "figcaption": "paragraph", "dt": "paragraph", "dd": "paragraph"}
DROP_TAGS = {"script", "style", "noscript", "nav", "header", "footer", "aside", "form", "button", "svg", "iframe", "template"}
INLINE_KEEP = {"a", "strong", "b", "em", "i", "code", "sup", "sub", "u", "s"}
CONTAINER_TAGS = {"div", "section", "article", "main", "body", "tr", "table", "ul", "ol", "dl", "figure", "details", "summary", "span"}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.read().decode(r.headers.get_content_charset() or "utf-8", errors="replace"), r.geturl()
    except urllib.error.HTTPError as e:
        if e.code in (403, 429, 503):
            avail = json.load(urllib.request.urlopen("https://archive.org/wayback/available?url=" + urllib.parse.quote(url, safe=""), timeout=30))
            snap = avail.get("archived_snapshots", {}).get("closest", {}).get("url")
            if snap:
                sys.stderr.write(f"note: {url} returned {e.code}; using Wayback snapshot {snap}\n")
                with urllib.request.urlopen(urllib.request.Request(snap, headers={"User-Agent": UA}), timeout=60) as r:
                    return r.read().decode("utf-8", errors="replace"), snap
        raise


class Extractor(HTMLParser):
    """Collect block-level text with inline html kept for a, strong, em."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks, self.stack, self.drop, self.cur, self.title, self.in_title = [], [], 0, None, "", False
        self.selector_hit, self.main_depth, self.seen_main, self.title_done = False, 0, False, False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title" and not self.title_done: self.in_title = True
        if tag in DROP_TAGS or (a.get("hidden") is not None) or (a.get("aria-hidden") == "true"):
            self.drop += 1; self.stack.append((tag, True)); return
        self.stack.append((tag, False))
        if self.drop: return
        if tag in ("article", "main") or (a.get("role") == "main"):
            self.seen_main = True; self.main_depth += 1
        if tag in BLOCK_TAGS:
            if self.cur: self.close_block()
            self.cur = {"type": BLOCK_TAGS[tag], "tag": tag, "text": "", "html": "", "links": [], "in_main": self.main_depth > 0}
        elif tag in CONTAINER_TAGS:
            if self.cur and self.cur["tag"] == "_implicit": self.close_block()
        elif tag in INLINE_KEEP:
            if self.cur is None: self.open_implicit()
            if tag == "a" and a.get("href"):
                href = a["href"]
                self.cur["html"] += '<a href="%s">' % html.escape(href, quote=True)
                self.cur["links"].append({"href": href, "text": ""}); self.cur["_open_link"] = True
            elif tag != "a":
                self.cur["html"] += "<%s>" % tag
        elif tag == "br" and self.cur is not None:
            self.cur["text"] += " "; self.cur["html"] += " "

    def handle_endtag(self, tag):
        if tag == "title" and self.in_title: self.in_title = False; self.title_done = True
        while self.stack:
            t, dropped = self.stack.pop()
            if dropped: self.drop -= 1
            if t == tag: break
        if self.drop: return
        if tag in ("article", "main") and self.main_depth: self.main_depth -= 1
        if tag in BLOCK_TAGS and self.cur is not None and self.cur["tag"] == tag:
            self.close_block()
        elif tag in CONTAINER_TAGS and self.cur is not None and self.cur["tag"] == "_implicit":
            self.close_block()
        elif tag in INLINE_KEEP and self.cur is not None:
            if tag == "a":
                if self.cur.get("_open_link"): self.cur["html"] += "</a>"; self.cur["_open_link"] = False
            else:
                self.cur["html"] += "</%s>" % tag

    def open_implicit(self):
        # Text sitting directly in a div or span, with no p or heading around it.
        self.cur = {"type": "paragraph", "tag": "_implicit", "text": "", "html": "", "links": [], "in_main": self.main_depth > 0}

    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.drop: return
        if self.cur is None:
            if not data.strip(): return
            self.open_implicit()
        self.cur["text"] += data; self.cur["html"] += html.escape(data)
        if self.cur.get("_open_link") and self.cur["links"]: self.cur["links"][-1]["text"] += data

    def close_block(self):
        b = self.cur; self.cur = None
        b.pop("_open_link", None)
        b["text"] = re.sub(r"\s+", " ", b["text"]).strip()
        b["html"] = re.sub(r"\s+", " ", b["html"]).strip()
        if b["text"]: self.blocks.append(b)


def from_html(src, base_url=""):
    p = Extractor(); p.feed(src)
    blocks = p.blocks
    if p.seen_main and any(b["in_main"] for b in blocks):
        blocks = [b for b in blocks if b["in_main"]]
    for b in blocks:
        b.pop("in_main", None)
        tag = b.pop("tag", "")
        if b["type"] == "heading" and tag[:1] == "h" and tag[1:].isdigit(): b["level"] = int(tag[1:])
        for l in b["links"]:
            if base_url and l["href"].startswith("/"): l["href"] = re.match(r"https?://[^/]+", base_url).group(0) + l["href"]
    return p.title.strip(), blocks


def inline_html_to_md(h):
    """Inline html kept by the extractor (a, strong, em, code) -> Markdown."""
    h = re.sub(r'<a href="([^"]*)">(.*?)</a>', lambda m: "[%s](%s)" % (m.group(2), html.unescape(m.group(1))), h, flags=re.S)
    h = re.sub(r"<(strong|b)>(.*?)</\1>", r"**\2**", h, flags=re.S)
    h = re.sub(r"<(em|i)>(.*?)</\1>", r"*\2*", h, flags=re.S)
    h = re.sub(r"<code>(.*?)</code>", r"`\1`", h, flags=re.S)
    h = re.sub(r"<[^>]+>", "", h)
    return html.unescape(h)


def blocks_to_markdown(blocks):
    """Render extracted blocks as readable Markdown (headings, lists, quotes, links kept)."""
    out, prev = [], None
    for b in blocks:
        t = b["type"]; body = inline_html_to_md(b.get("html") or html.escape(b["text"]))
        if t == "heading": out.append("\n" + "#" * min(max(int(b.get("level", 2)), 1), 6) + " " + body + "\n")
        elif t == "list": out.append(("" if prev == "list" else "\n") + "- " + body)
        elif t == "quote": out.append("\n> " + body + "\n")
        elif t == "cell": out.append(("" if prev == "cell" else "\n") + "| " + body + " |")
        else: out.append("\n" + body + "\n")
        prev = t
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip() + "\n"


def from_markdown(md):
    blocks, title = [], ""
    def inline(t):
        h = html.escape(t)
        h = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: '<a href="%s">%s</a>' % (m.group(2), m.group(1)), h)
        h = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", h); h = re.sub(r"(?<!\*)\*(?!\*)(.+?)\*", r"<em>\1</em>", h)
        return h
    def plain(t):
        t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t); t = re.sub(r"\*\*(.+?)\*\*", r"\1", t); return re.sub(r"(?<!\*)\*(?!\*)(.+?)\*", r"\1", t)
    para = []
    def flush():
        if para:
            t = " ".join(para); blocks.append({"type": "paragraph", "text": plain(t), "html": inline(t), "links": [{"href": u, "text": x} for x, u in re.findall(r"\[([^\]]+)\]\(([^)\s]+)\)", t)]}); para.clear()
    for line in md.splitlines():
        s = line.rstrip()
        if not s.strip(): flush(); continue
        m = re.match(r"^(#{1,6})\s+(.*)", s)
        if m:
            flush(); t = m.group(2).strip(); title = title or t
            blocks.append({"type": "heading", "level": len(m.group(1)), "text": plain(t), "html": inline(t), "links": []}); continue
        m = re.match(r"^\s*(?:[-*+]|\d+[.)])\s+(.*)", s)
        if m:
            flush(); t = m.group(1); blocks.append({"type": "list", "text": plain(t), "html": inline(t), "links": [{"href": u, "text": x} for x, u in re.findall(r"\[([^\]]+)\]\(([^)\s]+)\)", t)]}); continue
        m = re.match(r"^>\s?(.*)", s)
        if m:
            flush(); blocks.append({"type": "quote", "text": plain(m.group(1)), "html": inline(m.group(1)), "links": []}); continue
        if s.startswith("|"):
            flush()
            for cell in [c.strip() for c in s.strip("|").split("|")]:
                if cell and not re.fullmatch(r"-+:?|:?-+:?", cell): blocks.append({"type": "cell", "text": plain(cell), "html": inline(cell), "links": []})
            continue
        para.append(s.strip())
    flush()
    return title, blocks


def google_doc_id(s):
    m = re.search(r"/document/d/([A-Za-z0-9_-]+)", s)
    return m.group(1) if m else (s if re.fullmatch(r"[A-Za-z0-9_-]{25,}", s) else None)


def read_google_doc(doc_id, account):
    if shutil.which("gdoc"):
        cmd = ["gdoc", "cat"] + (["--account", account] if account else []) + [doc_id]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout, "gdoc cat"
        sys.stderr.write("note: gdoc cat failed (%s); trying the export URL\n" % r.stderr.strip()[:200])
    url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", errors="replace"), "export URL (plain text; headings and links lost)"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input"); ap.add_argument("out_dir")
    ap.add_argument("--account", help="gdoc account email for Google Docs")
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    src, title, blocks, how = a.input, "", [], ""
    gid = google_doc_id(a.input) if "docs.google.com" in a.input or not re.match(r"https?://|\.", a.input) else None
    if gid:
        text, how = read_google_doc(gid, a.account)
        title, blocks = from_markdown(text)
        src = f"https://docs.google.com/document/d/{gid}/edit"
    elif re.match(r"https?://", a.input):
        page, final = fetch(a.input); how = "fetched " + final
        title, blocks = from_html(page, final)
    elif a.input.endswith(".md"):
        title, blocks = from_markdown(open(a.input, encoding="utf-8").read()); how = "local markdown"
    else:
        title, blocks = from_html(open(a.input, encoding="utf-8", errors="replace").read()); how = "local html"
    doc = {"source": src, "title": title or (blocks[0]["text"] if blocks else ""), "read_via": how, "blocks": blocks}
    json.dump(doc, open(os.path.join(a.out_dir, "document.json"), "w"), indent=1, ensure_ascii=False)
    open(os.path.join(a.out_dir, "document.txt"), "w").write("\n".join(b["text"] for b in blocks) + "\n")
    links = sorted({l["href"] for b in blocks for l in b["links"] if l["href"].startswith("http")})
    open(os.path.join(a.out_dir, "links.txt"), "w").write("\n".join(links) + ("\n" if links else ""))
    words = sum(len(b["text"].split()) for b in blocks)
    print(f"{len(blocks)} blocks, {words} words, {len(links)} outbound links, read via {how}")
    print(f"title: {doc['title']}")


if __name__ == "__main__":
    import urllib.parse
    main()
