#!/usr/bin/env python3
"""Fold linkcheck.sh results into the link claims.

Usage:
  fold_links.py <work_dir>

Reads work_dir/links.tsv (url, status<TAB>final_url, title) and, for every claim with a
`link` field, sets `link_status`, `link_final_url`, `link_title`. A non-2xx status or a
redirect to a different path downgrades a `supported` link claim to
`supported-with-caveat` and says why in the note; 403 and 429 are reported as
"bot-blocked, check in a browser" rather than dead.
"""
import json, os, sys


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"): print(__doc__); sys.exit(0)
    wd = sys.argv[1]
    rows = {}
    for line in open(os.path.join(wd, "links.tsv")):
        parts = line.rstrip("\n").split("\t")
        if len(parts) >= 3: rows[parts[0]] = (parts[1], parts[2], parts[3] if len(parts) > 3 else "")
    claims = json.load(open(os.path.join(wd, "claims.json")))
    n = 0
    for c in claims:
        u = c.get("link")
        if not u or u not in rows: continue
        code, final, title = rows[u]
        c["link_status"], c["link_final_url"], c["link_title"] = code, final, title
        n += 1
        problem = ""
        if code in ("403", "429"): problem = f"Link returned HTTP {code} to an automated fetch (bot-blocked); confirm it opens in a browser."
        elif not code.startswith("2"): problem = f"Link returned HTTP {code}."
        elif final.rstrip("/") != u.rstrip("/"): problem = f"Link redirects to {final}; consider linking the final URL."
        if problem and problem not in c.get("note", ""):
            c["note"] = (c.get("note", "") + " " if c.get("note") else "") + problem
            if c.get("status") == "supported": c["status"] = "supported-with-caveat"
    json.dump(claims, open(os.path.join(wd, "claims.json"), "w"), indent=1, ensure_ascii=False)
    print(f"folded link results into {n} link claims")


if __name__ == "__main__":
    main()
