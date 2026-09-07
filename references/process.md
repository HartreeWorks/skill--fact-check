# The process in detail

Four passes with different jobs, so that no single model both writes and grades its own work, and a review surface that puts the evidence on the text.

## Why it is shaped this way

- **Quotes are re-found by string search.** A model asked for a supporting quote will produce one that sounds right. The only defence is to require that every quote exists, verbatim, in a saved copy of the source, and to check that mechanically (`audit_quotes.py`). Anything that fails the check stays amber at best.
- **Verifiers are cheap and parallel; the adversary is separate.** Verification is search and comparison, so a fast model does it well in parallel. Catching "sounds right but overstates" needs a pass whose only job is to find fault and which has not seen the verifier's answers.
- **The document is not edited during the check.** Claims anchor to substrings of the text. The review page renders the text; the original stays as it was until the reviewer decides.
- **Findings are decisions, not a report.** The reviewer works through the page, accepts or dismisses, marks what to apply, and copies the decisions out. The written findings file is the summary for people who will not open the page.

## Pass 1: extract (lead model)

Read `document.txt` in full. For every sentence ask: what would have to be true for this to be right? Write one claim per checkable thing:

- dates, durations and arithmetic ("within six weeks", "a week after")
- counts and figures, including the denominator they imply
- named actors and who did what to whom
- quotations, and the paraphrase around a quotation
- characterisations that carry a factual load: "first", "only", "largest", "historic", "unprecedented", "never before"
- each link: the sentence implies the linked document says something; that is a claim
- the author's own positions when stated as fact ("we have said since 2016")
- headings and timeline labels, which are often stronger than the body text beneath them

Over-extract. Merging is cheap; a missed claim is the one that embarrasses you. Mark opinion and forecast `unverifiable` at this stage so nobody wastes verification time on them. Add a `hint` field when you already suspect a problem, so the verifier answers the question you have.

Completion: `check_anchors.py` reports zero orphans, zero ambiguous anchors, and no unclaimed sentence containing a digit or a month name.

## Pass 2: verify (fast-model subagents, parallel)

Groups of 15 to 20 claims by section. Each subagent gets `verifier-brief.md` with the placeholders filled and writes `verify/<letter>.json`. Merge with `merge_verifiers.py`, then run `audit_quotes.py`. Expect misses: verifiers stitch quotes with "..." or paraphrase. For each miss, find the exact sentence in the source file and replace the quote; do not delete the source. A claim whose only quote cannot be re-found is not supported.

Completion: `audit_quotes.py` exits 0.

## Pass 3: adversary

`adversary-brief.md`. A different model family when available; a Claude subagent otherwise. It reads the document, the claim list and the sources, not the verifier output. Reconcile with `reconcile_adversary.py`. Reject only items whose complaint is "not in the supplied corpus" for a claim the verifier confirmed from a fetched web page; record the rejection reason. Where the adversary and the verifier disagree on wording strength, the adversary usually wins, because that is the failure the verifier is bad at.

Completion: every adversary item is accepted or rejected in `claims.json` (`checked_by` shows `adversary` or `adversary(rejected)`).

## Pass 4: adjudicate (lead model)

Read every non-green claim. For each, the note must say what is wrong, what the source says, and, where a change is warranted, `Suggest: '...'` with replacement text. Resolve conflicts between sources by preferring the primary and saying so. Fill any claim whose sources are empty from the source files yourself. Then build the review page and write `FINDINGS.md`.

Completion: `build_review.py` reports zero orphans; `FINDINGS.md` lists every non-green claim in severity order (contradicted, unsupported, then caveats) with the suggested rewording.

## When sources disagree

State both figures in the note, say which the document should use and why (primary over secondary, later over earlier, the one whose denominator matches the sentence). Status is `supported-with-caveat` if the document picked a defensible one, `contradicted` if it picked one no source gives.

## Re-running after edits

Copy changes between rounds. Re-extract, run `check_anchors.py`, and write a `changes.json` for `reanchor.py`: new anchors for reworded sentences, `null` for deleted ones, new status and note where the edit fixed the problem, and new claim records for new sentences (verify those). Rebuild the page. Do not re-verify claims whose anchor merely moved.

## Scale

A 2,000-word page produced about 95 claims, five verifiers, one adversary run, and roughly two and a half hours of agent time before the human review. Budget a verifier per 15 to 20 claims and one adversary run per document.

## Later addition, not built

Where the reviewer's environment can publish an artifact with a shared database, the review page could store decisions there so several reviewers see each other's calls and the agent reads them back without a paste. The page's decision block is designed to be the same shape either way.
