#!/usr/bin/env python3
"""Turn the reviewer's decisions (copied from the review page) into edits.json for the document.

Usage:
  decisions_to_edits.py <work_dir> <decisions.json|decisions.md> [--out edits.json]

Input is the block the page's "Copy decisions" button produces (a JSON object, optionally
inside a ```json fence). Each "apply" decision becomes {"find": anchor, "replace": replacement,
"why": ...}. An "accept" with a reviewer note becomes a comment-only entry so the note reaches
the document. "dismiss" is ignored. Also writes edits.md, a human-readable list, for cases
where no write path to the document exists.

The `find` text must match the document exactly once; the script checks against
document.txt and warns on ambiguity so you can extend the anchor before applying.
"""
import argparse, json, os, re, sys


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("work_dir"); ap.add_argument("decisions"); ap.add_argument("--out")
    a = ap.parse_args()
    raw = open(a.decisions, encoding="utf-8").read()
    m = re.search(r"```json\s*(\{.*?\})\s*```", raw, re.S)
    data = json.loads(m.group(1) if m else raw[raw.find("{"):raw.rfind("}") + 1])
    claims = {c["id"]: c for c in json.load(open(os.path.join(a.work_dir, "claims.json")))}
    text = open(os.path.join(a.work_dir, "document.txt"), encoding="utf-8").read()
    edits, lines = [], []
    for cid, d in data.get("decisions", {}).items():
        c = claims.get(cid, {})
        anchor = d.get("anchor") or c.get("anchor", "")
        why = (c.get("note") or "").split(" Suggest")[0][:400]
        if d.get("note"): why = (why + " Reviewer: " + d["note"]).strip()
        if d.get("d") == "apply":
            if not d.get("replacement"): print(f"skip {cid}: apply with empty replacement"); continue
            n = text.count(anchor)
            if n != 1: print(f"warn {cid}: anchor matches {n} times in document.txt; extend it before applying")
            edits.append({"find": anchor, "replace": d["replacement"], "why": why, "claim": cid})
            lines.append(f"- **{cid}** replace: “{anchor}” → “{d['replacement']}”\n  {why}")
        elif d.get("d") == "accept" and d.get("note"):
            edits.append({"find": anchor, "comment_only": True, "why": why, "claim": cid})
            lines.append(f"- **{cid}** comment on “{anchor}”: {why}")
    out = a.out or os.path.join(a.work_dir, "edits.json")
    json.dump(edits, open(out, "w"), indent=1, ensure_ascii=False)
    open(os.path.join(a.work_dir, "edits.md"), "w").write("# Edits to apply\n\n" + ("\n".join(lines) if lines else "(none)") + "\n")
    print(f"{len(edits)} edits -> {out} and edits.md")


if __name__ == "__main__":
    main()
