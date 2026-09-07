#!/usr/bin/env python3
"""Merge verifier outputs into claims.json.

Usage:
  merge_verifiers.py <work_dir>

Reads every work_dir/verify/*.json (a list of {"id","status","sources","note"}), and for each
matching claim sets status, sources and note, and appends "verifier:<file>" to checked_by.
Unknown ids and unparsable files are reported, not fatal. Statuses outside the allowed set
become "unchecked".
"""
import glob, json, os, sys

STATUSES = {"supported", "supported-with-caveat", "unsupported", "contradicted", "unverifiable", "unchecked"}


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__); sys.exit(0)
    wd = sys.argv[1] if len(sys.argv) > 1 else "."
    claims = json.load(open(os.path.join(wd, "claims.json")))
    byid = {c["id"]: c for c in claims}
    n, files = 0, sorted(glob.glob(os.path.join(wd, "verify", "*.json")))
    for f in files:
        name = os.path.basename(f)
        if name.startswith("adversary"): continue
        try: rows = json.load(open(f))
        except Exception as e: print(f"skip {name}: {e}"); continue
        for r in rows:
            c = byid.get(r.get("id"))
            if not c: print(f"unknown id {r.get('id')} in {name}"); continue
            st = r.get("status", "unchecked")
            c["status"] = st if st in STATUSES else "unchecked"
            c["sources"] = r.get("sources", []) or []
            c["note"] = r.get("note", "") or ""
            tag = "verifier:" + name.rsplit(".", 1)[0]
            c.setdefault("checked_by", [])
            if tag not in c["checked_by"]: c["checked_by"].append(tag)
            n += 1
    json.dump(claims, open(os.path.join(wd, "claims.json"), "w"), indent=1, ensure_ascii=False)
    unchecked = [c["id"] for c in claims if c.get("status", "unchecked") == "unchecked"]
    print(f"merged {n} rows from {len(files)} files; {len(unchecked)} claims still unchecked" + (": " + ", ".join(unchecked[:20]) if unchecked else ""))


if __name__ == "__main__":
    main()
