# Statuses and the claims record

## Statuses

| Status | Meaning | Example |
| --- | --- | --- |
| `supported` | A source directly supports the wording as written. | "About 1,200 agents joined the board." METR: "Roughly 1200 agents ... found a way to communicate". |
| `supported-with-caveat` | True in substance, but the wording overstates, simplifies, picks one of several figures, changes the actor, or rests on a single non-independent source. | "Within four hours" where the source says "within hours". "Over 70,000 messages" where the figure is messages and files. |
| `unsupported` | No source found after searching the approved sources and the linked page. | "Systems far more capable have already been trained." Nothing in any source says so. |
| `contradicted` | A source says otherwise. Say what. | "Three weeks old" when the report is nine days old. "Swap easy problems for hard ones" when the source describes the reverse. |
| `unverifiable` | Opinion, forecast, or the author's own judgement presented as fact. Flagged so it is not mistaken for a checkable claim; the note says whether it is reasonable. | "A historic event." "Deserves more attention." |
| `unchecked` | Extracted, not yet verified. Never ships. | |

A downgrade never becomes an upgrade later in the pipeline. The adversary can only lower a status or add a claim; the adjudicator can raise one only by adding a verified quote.

Link claims (`kind: link`) are `supported` when the URL resolves to the described document and the sentence around the link describes it fairly.

## The claims record

`claims.json` is a list. One record per claim:

```json
{
  "id": "c014",
  "section": "what-happened",
  "anchor": "around 1,200 joined the board and exchanged over 70,000 messages",
  "occurrence": 1,
  "claim": "About 1,200 agents joined the message board and sent over 70,000 messages and files.",
  "kind": "fact",
  "link": "https://example.org/report",
  "status": "supported-with-caveat",
  "sources": [
    {
      "key": "METR",
      "url": "https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/",
      "quote": "Roughly 1200 agents meant to be isolated from one another found a way to communicate with one another on an unsanctioned message board, sending over 70,000 messages and files during the investigation period.",
      "locator": "Summary, para 2",
      "verified_against": "metr-report.txt",
      "no_fragment": false
    }
  ],
  "note": "The 70,000 figure is messages and files. Suggest: 'exchanged over 70,000 messages and files'.",
  "checked_by": ["extractor", "verifier:A", "adversary"]
}
```

Field rules:

- `anchor` is an exact substring of `document.txt`. Curly quotes, dashes and whitespace are normalised on both sides, so either form works. Keep anchors short enough to survive nearby edits and long enough to be unique; add `occurrence` (1-based) when the same phrase appears more than once. Anchors of different claims must not overlap.
- `claim` is the claim in the checker's own words: what would have to be true.
- `kind`: `fact`, `characterisation` (a strength-of-wording claim such as "first known", "only", "historic"), `link` (the link points at the document the sentence implies), `author-view` (the publishing organisation's own position; check it against their published material).
- `sources[].quote` is verbatim. `verified_against` is the file under `sources/` where the quote was re-found, or the URL with "(fetched <date>)" when the source could not be saved as text. `audit_quotes.py` enforces the file case.
- `no_fragment: true` stops the review page adding a text-fragment link (use for PDFs and pages whose text differs from the saved copy).
- `note` says what the page gets right or wrong and, when wording should change, ends with `Suggest: '...'`. The review page pre-fills the replacement box from that phrase.
- `checked_by` records every pass that touched the claim.
