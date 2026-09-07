"""Apply a list of edits to a Google Doc as real tracked suggestions (with --dry-run to preview).

Usage:
    python3 apply_suggestions.py <doc-id-or-url> <edits.json> [--account EMAIL]

edits.json is a list of objects:
    {"find": "exact text in the doc", "replace": "new text", "why": "rationale"}

`replace` may be "" for a pure deletion, or the entry may set
`"comment_only": true` to raise a question without proposing new text.
`why`, if present, is added as an anchored comment on the same range.

Mechanics: each edit becomes one batchUpdate with writeControl.writeMode=SUGGEST
containing an insertText (at the end of the target range) followed by a
deleteContentRange (over the target range). Inserting after the range means the
deletion indices do not shift within the batch.

Suggested-deleted text stays in the document, so subsequent finds still resolve
against the original prose. Text this script has itself suggested for insertion
is excluded from the search space, so edits cannot cascade into each other and
may be listed in any order.

SAFETY: SUGGEST mode is silently ignored without Docs API developer-preview
access — the API returns HTTP 200 and applies the edits directly. This script
verifies after the first edit that a suggestion ID actually appeared, and aborts
if it did not.

Auth: reuses the OAuth credentials stored by the gdoc CLI
(https://github.com/LucaDeLeo/gdoc) under ~/.config/gdoc.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

DOCS = "https://docs.googleapis.com/v1/documents"
GDOC_CONFIG = Path.home() / ".config/gdoc"


def get_token(account):
    """Mint an access token from the gdoc CLI's stored OAuth credentials."""
    client = json.loads((GDOC_CONFIG / "credentials.json").read_text())["installed"]
    token_file = GDOC_CONFIG / "accounts" / account / "token.json"
    if not token_file.exists():
        sys.exit(f"No gdoc token for {account}. Run: gdoc auth --account {account}")
    tok = json.loads(token_file.read_text())
    creds = Credentials(
        token=tok.get("token"),
        refresh_token=tok["refresh_token"],
        token_uri=client["token_uri"],
        client_id=client["client_id"],
        client_secret=client["client_secret"],
        scopes=tok["scopes"],
    )
    creds.refresh(Request())
    return creds.token


def parse_doc_id(s):
    m = re.search(r"/document/d/([A-Za-z0-9_-]+)", s)
    return m.group(1) if m else s


class Doc:
    def __init__(self, session, doc_id):
        self.s = session
        self.id = doc_id

    def get(self):
        r = self.s.get(f"{DOCS}/{self.id}")
        r.raise_for_status()
        return r.json()

    def batch(self, requests_, suggest=False):
        body = {"requests": requests_}
        if suggest:
            body["writeControl"] = {"writeMode": "SUGGEST"}
        r = self.s.post(f"{DOCS}/{self.id}:batchUpdate", json=body)
        if r.status_code >= 400:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text}")
        return r.json()


def text_runs(doc):
    """Yield (paragraph_element, text_run) for every text run in the body."""
    for el in doc["body"]["content"]:
        for pe in el.get("paragraph", {}).get("elements", []):
            tr = pe.get("textRun")
            if tr:
                yield pe, tr


def char_map(doc):
    """Flatten the body into (text, [doc_index_per_char]), skipping our own
    suggested insertions so edits never match text this script wrote."""
    chars, idxs = [], []
    for pe, tr in text_runs(doc):
        if tr.get("suggestedInsertionIds"):
            continue
        for i, ch in enumerate(tr["content"]):
            chars.append(ch)
            idxs.append(pe["startIndex"] + i)
    return "".join(chars), idxs


def locate(doc, needle):
    text, idxs = char_map(doc)
    pos = text.find(needle)
    if pos == -1:
        raise LookupError(f"not found: {needle!r}")
    if text.find(needle, pos + 1) != -1:
        raise LookupError(f"ambiguous (appears more than once): {needle!r}")
    return idxs[pos], idxs[pos + len(needle) - 1] + 1


def suggestion_count(doc):
    n = 0
    for _, tr in text_runs(doc):
        n += len(tr.get("suggestedInsertionIds", []))
        n += len(tr.get("suggestedDeletionIds", []))
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doc", help="document ID or URL")
    ap.add_argument("edits", help="path to edits.json")
    ap.add_argument("--account", required=True, help="gdoc account email")
    ap.add_argument("--dry-run", action="store_true", help="locate each edit and print what would change; write nothing")
    args = ap.parse_args()

    doc_id = parse_doc_id(args.doc)
    edits = json.loads(Path(args.edits).read_text())

    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {get_token(args.account)}"
    doc = Doc(s, doc_id)

    applied = failed = 0
    for n, edit in enumerate(edits, 1):
        find, replace = edit["find"], edit.get("replace", "")
        try:
            start, end = locate(doc.get(), find)
        except LookupError as e:
            print(f"{n:2}. SKIP  {e}")
            failed += 1
            continue

        if args.dry_run:
            arrow = "(comment only)" if edit.get("comment_only") else f"-> {replace[:60]!r}"
            print(f"{n:2}. WOULD {find[:60]!r} {arrow}")
            applied += 1
            continue
        if not edit.get("comment_only"):
            reqs = []
            if replace:
                reqs.append({"insertText": {"location": {"index": end}, "text": replace}})
            reqs.append({"deleteContentRange": {
                "range": {"startIndex": start, "endIndex": end}}})
            doc.batch(reqs, suggest=True)

        if edit.get("why"):
            try:
                doc.batch([{"insertComment": {
                    "content": edit["why"],
                    "range": {"startIndex": start, "endIndex": end},
                }}])
            except RuntimeError as e:
                print(f"    comment failed: {e}")

        applied += 1
        arrow = "(comment only)" if edit.get("comment_only") else f"-> {replace[:48]!r}"
        print(f"{n:2}. OK    {find[:48]!r} {arrow}")

        if applied == 1 and not edit.get("comment_only") and suggestion_count(doc.get()) == 0:
            sys.exit(
                "ABORT: the first edit produced no suggestion — SUGGEST mode is being "
                "ignored and edits are landing directly. Check developer-preview access."
            )

    print(f"\n{applied} applied, {failed} skipped")
    print(f"https://docs.google.com/document/d/{doc_id}/edit")


if __name__ == "__main__":
    main()
