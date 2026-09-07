#!/usr/bin/env python3
"""Check claims.json against document.txt.

Usage:
  check_anchors.py <work_dir>

Prints: anchors that no longer match the document (orphans), anchors that match more than
once without an `occurrence` field, and sentences containing a digit or a month name that no
claim touches (candidates for extraction). Exit 2 if there are orphans or ambiguous anchors.
"""
import json, os, re, sys

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec"


def norm(s):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), (" ", " ")): s = s.replace(a, b)
    return re.sub(r"\s+", " ", s).strip()


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__); sys.exit(0)
    wd = sys.argv[1] if len(sys.argv) > 1 else "."
    text = norm(open(os.path.join(wd, "document.txt")).read())
    claims = json.load(open(os.path.join(wd, "claims.json")))
    covered, orphans, ambiguous = [], [], []
    for c in claims:
        a = norm(c.get("anchor", ""))
        if not a: orphans.append(c); continue
        n = text.count(a)
        if n == 0: orphans.append(c); continue
        if n > 1 and not c.get("occurrence"): ambiguous.append((c, n))
        at, occ = text.find(a), c.get("occurrence", 1)
        while occ > 1 and at >= 0: at = text.find(a, at + 1); occ -= 1
        if at < 0: orphans.append(c); continue
        covered.append((at, at + len(a)))
    overlaps = []
    spans = sorted(zip(covered, [c for c in claims if c not in orphans]), key=lambda x: x[0])
    for (a, ca), (b, cb) in zip(spans, spans[1:]):
        if b[0] < a[1]: overlaps.append((ca["id"], cb["id"]))
    print(f"{len(claims)} claims, {len(orphans)} orphaned, {len(ambiguous)} ambiguous, {len(overlaps)} overlapping")
    for x, y in overlaps: print(f"  OVERLAP   {x} and {y} share text; shorten one anchor")
    for c in orphans: print(f"  ORPHAN    {c['id']}: {c.get('anchor','')[:80]}")
    for c, n in ambiguous: print(f"  AMBIGUOUS {c['id']} ({n} matches; add \"occurrence\"): {c['anchor'][:70]}")
    for m in re.finditer(r"[^.!?\n]*[.!?](?=\s|$)|[^.!?\n]+$", text):
        s, e, sent = m.start(), m.end(), m.group().strip()
        if len(sent) < 25 or not re.search(r"\d|\b(" + MONTHS + r")\b", sent): continue
        if any(cs < e and ce > s for cs, ce in covered): continue
        print(f"  UNCLAIMED {sent[:110]}")
    sys.exit(2 if orphans or ambiguous or overlaps else 0)


if __name__ == "__main__":
    main()
