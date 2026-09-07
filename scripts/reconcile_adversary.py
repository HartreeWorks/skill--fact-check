#!/usr/bin/env python3
"""Fold the adversarial pass into claims.json.

Usage:
  reconcile_adversary.py <work_dir> [--reject id,id,...] [--reject-reason "text"]

Reads work_dir/verify/adversary.json: a list of
  {"id": existing id or "new-N", "anchor": for new claims, "verdict": "downgrade"|"add",
   "proposed_status", "evidence": "sources/<file>: \\"quote\\"" lines, "problem", "suggested_wording"}

Rules:
- A downgrade never raises a status. Order: supported > supported-with-caveat > unverifiable > unsupported > contradicted.
- Evidence quotes are kept only if found in the named file under work_dir/sources/ (footnote digits tolerated).
- Rejected ids get the adversary's point appended to the note as rejected, with the reason, and no status change.
  Use this for items the adversary called unverifiable only because it could not see a web source.
- "new-N" items become claims c9NN with kind "characterisation" unless the anchor is missing from document.txt.
Idempotent: running twice does not duplicate notes or sources.
"""
import argparse, json, os, re, sys

RANK = {"supported": 0, "supported-with-caveat": 1, "unverifiable": 2, "unsupported": 3, "contradicted": 4}


def nrm(x):
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'), ("–", "-"), ("—", "-"), (" ", " ")): x = x.replace(a, b)
    return re.sub(r"\s+", " ", demark(x))


def demark(x):
    """Strip Markdown markup so a quote copied with or without it still matches."""
    x = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", x)
    x = re.sub(r"^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)", "", x, flags=re.M)
    x = re.sub(r"[*_`]{1,3}", "", x)
    return x.replace("|", " ")


def nd(x): return re.sub(r"\s+", " ", re.sub(r"\d", "", x))


def evidence_sources(item, sdir):
    out = []
    ev = item.get("evidence") or ""
    if isinstance(ev, list): ev = "\n".join(str(x) for x in ev)
    for line in ev.split("\n"):
        m = re.match(r"\s*(?:sources/)?([\w.\-]+\.txt):\s*[\"“](.*)[\"”]\s*$", line.strip())
        if not m: continue
        f, q = m.group(1), m.group(2)
        p = os.path.join(sdir, f)
        if not os.path.exists(p): continue
        t = nrm(open(p, errors="ignore").read()); qq = nrm(q)
        if qq in t or nd(qq) in nd(t):
            out.append({"key": f.rsplit(".", 1)[0], "url": "", "quote": q, "locator": "found by search", "verified_against": f, "no_fragment": True})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("work_dir"); ap.add_argument("--reject", default=""); ap.add_argument("--reject-reason", default="the adversary could not see the web source the verifier used")
    a = ap.parse_args()
    wd, sdir = a.work_dir, os.path.join(a.work_dir, "sources")
    claims = json.load(open(os.path.join(wd, "claims.json"))); byid = {c["id"]: c for c in claims}
    adv = json.load(open(os.path.join(wd, "verify", "adversary.json")))
    text = nrm(open(os.path.join(wd, "document.txt")).read())
    reject = {x.strip() for x in a.reject.split(",") if x.strip()}
    accepted = rejected = added = skipped = 0
    for it in adv:
        i = it.get("id", "")
        sugg = f" Suggest: '{it['suggested_wording']}'." if it.get("suggested_wording") else ""
        point = (it.get("problem") or "").strip()
        if i.startswith("new-"):
            anchor = it.get("anchor", "")
            if nrm(anchor) not in text: print(f"skip {i}: anchor not in document: {anchor[:60]}"); skipped += 1; continue
            nid = "c9" + i.split("-")[1].zfill(2)
            if nid in byid: c = byid[nid]
            else:
                c = {"id": nid, "section": "", "anchor": anchor, "claim": point.split(". ")[0] + ".", "kind": "characterisation", "status": it.get("proposed_status", "unsupported"), "sources": [], "note": "", "checked_by": []}
                claims.append(c); byid[nid] = c; added += 1
        else:
            c = byid.get(i)
            if not c: print(f"unknown id {i}"); skipped += 1; continue
        c.setdefault("checked_by", []); c.setdefault("sources", [])
        if i in reject:
            tag = f"Adversary flagged this but was rejected: {a.reject_reason}."
            if tag not in c["note"]: c["note"] = (c["note"] + " " if c["note"] else "") + tag
            if "adversary(rejected)" not in c["checked_by"]: c["checked_by"].append("adversary(rejected)")
            rejected += 1; continue
        ps = it.get("proposed_status", c["status"])
        if RANK.get(ps, 0) > RANK.get(c["status"], 0): c["status"] = ps
        if point and point not in c["note"]: c["note"] = (c["note"] + " " if c["note"] else "") + point + sugg
        c["adversary_note"] = point + sugg
        have = {s.get("quote") for s in c["sources"]}
        c["sources"] += [s for s in evidence_sources(it, sdir) if s["quote"] not in have]
        if "adversary" not in c["checked_by"]: c["checked_by"].append("adversary")
        accepted += 1
    json.dump(claims, open(os.path.join(wd, "claims.json"), "w"), indent=1, ensure_ascii=False)
    print(f"adversary items: {accepted} accepted, {rejected} rejected, {added} new claims, {skipped} skipped")


if __name__ == "__main__":
    main()
