#!/usr/bin/env python3
"""Re-anchor claims after the document changed.

Usage:
  reanchor.py <work_dir> <changes.json>

changes.json:
  {"anchors":  {"c012": "new exact substring", "c040": null},   # null deletes the claim
   "status":   {"c022": "supported"},                            # optional status changes
   "notes":    {"c022": "Fixed in the 5 Sept edit: ..."},        # replaces the note
   "new":      [ {claim record} ]}                               # appended as-is

Every new anchor must exist in document.txt; the script refuses and lists failures
otherwise. Appends "re-check:<date>" to checked_by on touched claims.
"""
import datetime, json, os, re, sys


def nrm(x):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), (" ", " ")): x = x.replace(a, b)
    return re.sub(r"\s+", " ", x).strip()


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__); sys.exit(0)
    wd, chg = sys.argv[1], json.load(open(sys.argv[2]))
    text = nrm(open(os.path.join(wd, "document.txt")).read())
    claims = json.load(open(os.path.join(wd, "claims.json"))); byid = {c["id"]: c for c in claims}
    stamp = "re-check:" + datetime.date.today().isoformat()
    bad = [(i, a) for i, a in chg.get("anchors", {}).items() if a is not None and nrm(a) not in text]
    bad += [(c.get("id"), c.get("anchor")) for c in chg.get("new", []) if nrm(c.get("anchor", "")) not in text]
    if bad:
        for i, a in bad: print(f"NOT IN DOCUMENT {i}: {a[:80]}")
        sys.exit(2)
    removed = 0
    for i, a in chg.get("anchors", {}).items():
        c = byid.get(i)
        if not c: print(f"unknown id {i}"); continue
        if a is None: claims.remove(c); byid.pop(i); removed += 1; continue
        c["anchor"] = a; c.setdefault("checked_by", []).append(stamp)
    for i, s in chg.get("status", {}).items():
        if i in byid: byid[i]["status"] = s; byid[i].setdefault("checked_by", []).append(stamp)
    for i, n in chg.get("notes", {}).items():
        if i in byid: byid[i]["note"] = n
    for c in chg.get("new", []):
        c.setdefault("status", "unchecked"); c.setdefault("sources", []); c.setdefault("note", ""); c.setdefault("checked_by", [stamp])
        claims.append(c); byid[c["id"]] = c
    json.dump(claims, open(os.path.join(wd, "claims.json"), "w"), indent=1, ensure_ascii=False)
    print(f"re-anchored {len(chg.get('anchors', {})) - removed}, removed {removed}, added {len(chg.get('new', []))}; {len(claims)} claims")


if __name__ == "__main__":
    main()
