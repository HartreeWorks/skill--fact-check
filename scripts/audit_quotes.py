#!/usr/bin/env python3
"""Re-find every quote in the source text it claims to come from.

Usage:
  audit_quotes.py <work_dir> [--fix]

For each source entry whose `verified_against` names a file in work_dir/sources/, search
that file for the quote. Tolerates whitespace, curly quotes, dashes, and footnote digits
glued to words; a quote containing "..." or "[...]" is checked segment by segment.

Without --fix: prints every miss and exits 2 if there are any.
With --fix: marks each miss in claims.json (`verified_against` gets " (NOT FOUND by string
search)"), downgrades a `supported` claim that loses its only found quote to
`supported-with-caveat`, and drops sources that cite a notes or evidence file rather than
a source (key or file containing "evidence", "notes", "sheet").
"""
import json, os, re, sys

NOTES = re.compile(r"evidence|notes|sheet|summary", re.I)


def nrm(x):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), (" ", " ")): x = x.replace(a, b)
    return re.sub(r"\s+", " ", x)


def nd(x):
    return re.sub(r"\s+", " ", re.sub(r"\d", "", x)).replace("'", '"')


_cache = {}


def found(path, quote):
    if path not in _cache: _cache[path] = nrm(open(path, errors="ignore").read())
    t = _cache[path]; q = nrm(quote).strip().strip('"').strip()
    segs = [s.strip(' .,;:"') for s in re.split(r"\.\.\.|…|\[[^\]]*\]", q)]
    segs = [s for s in segs if len(s) >= 20] or [q]
    return all(s in t or nd(s) in nd(t) for s in segs)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__); sys.exit(0)
    wd = sys.argv[1] if len(sys.argv) > 1 else "."
    fix = "--fix" in sys.argv
    sdir = os.path.join(wd, "sources")
    claims = json.load(open(os.path.join(wd, "claims.json")))
    misses, dropped, checked = [], 0, 0
    for c in claims:
        keep = []
        for s in c.get("sources", []):
            v = s.get("verified_against", "") or ""
            if NOTES.search(v) or NOTES.search(s.get("key", "")):
                if fix: dropped += 1; continue
            fname = v.split(" ")[0]
            path = os.path.join(sdir, fname) if fname and not fname.startswith("http") else None
            if path and os.path.exists(path) and s.get("quote"):
                checked += 1
                if not found(path, s["quote"]):
                    misses.append((c["id"], s.get("key"), s["quote"][:90]))
                    if fix and "NOT FOUND" not in v: s["verified_against"] = v + " (NOT FOUND by string search)"
            keep.append(s)
        if fix:
            c["sources"] = keep
            good = [s for s in keep if "NOT FOUND" not in (s.get("verified_against") or "")]
            if c.get("status") == "supported" and not good and (keep or dropped):
                c["status"] = "supported-with-caveat"
                c["note"] = (c.get("note", "") + " " if c.get("note") else "") + "No quote could be re-found in a source file; needs a verbatim citation."
    print(f"{checked} quotes checked, {len(misses)} not found" + (f", {dropped} notes-file citations dropped" if fix else ""))
    for id, key, q in misses: print(f"  MISS {id} [{key}] {q}")
    if fix: json.dump(claims, open(os.path.join(wd, "claims.json"), "w"), indent=1, ensure_ascii=False)
    sys.exit(2 if misses and not fix else 0)


if __name__ == "__main__":
    main()
