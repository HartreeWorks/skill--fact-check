---
name: fact-check
description: Use when asked to fact-check, verify the claims in, or find the sources for a draft document, web page, article, landing page or Google Doc, or to check that a piece says only what its sources support.
---

# Fact check

Output: a review page where every factual claim is highlighted with its status and the verbatim source passage behind it, a findings file, and optionally the reviewer's chosen fixes pushed into the Google Doc as suggested edits. Read `references/process.md` before the first run.

Scripts are in `scripts/` (`--help` for arguments). Work in `fact-check/<slug>/` next to the user's project.

## Steps

1. **Intake.** `extract_document.py <url-or-doc> <work_dir>` (`--account` for Google Docs). Read `document.txt`. Then ask three things in one message: which sources to trust, offering the document's links plus a short web search as a list for approval; whether to write suggested edits into the Google Doc at the end; and which mode to run, with the cost stated in plain terms: "This page is N words, so expect about M claims. A full check of a page this size is roughly one to two hours of heavy Claude Code use (three for a long report); light mode is about a third of that. Run `/usage` now if you want a before-and-after reading." Modes: **checkpoint** (default: full pipeline, pausing after extraction and again after the verifiers so the user can check `/usage`), **light** (verifiers only, one per 30 claims, no adversary; use for anything over 2,500 words or a first pass), **full** (no pauses). Done when the source list and mode are agreed.
2. **Fetch sources.** `fetch_source.py <work_dir>/sources --list sources.txt`. Done when `sources/index.tsv` has a row per source and failures are reported to the user.
3. **Extract claims.** Write `claims.json` following `references/statuses.md`: one record per checkable thing, exact-substring anchors, `status: unchecked`, a `hint` where you already suspect a problem. Over-extract. Done when `check_anchors.py <work_dir>` reports no orphans, no ambiguous anchors, and no unclaimed sentence with a digit or a date.
4. **Verify and attack, in the same turn.** In checkpoint mode, report the claim count and pause for a yes before this step, and again before the adversary once the verifiers are merged. One fast-model subagent per 15 to 20 claims (30 in light mode) with `references/verifier-brief.md`, plus, except in light mode, one adversary subagent with `references/adversary-brief.md` (another model family if installed, otherwise Claude; it reads nothing under `verify/`). While they run, `linkcheck.sh <work_dir>/links.txt`. Then `merge_verifiers.py`, `audit_quotes.py` (replace every quote it cannot re-find with the exact sentence from the source file), `reconcile_adversary.py` (reject only items called unverifiable because the adversary could not see a web source the verifier fetched), `fold_links.py`. Done when `audit_quotes.py` exits 0, every adversary item is accepted or rejected, and every link claim has a status.
5. **Adjudicate and publish.** Read every non-green claim; rewrite each note so it says what is wrong and ends with `Suggest: '...'` where wording should change (merged verifier and adversary text is raw material, not the final note; the page pre-fills the reviewer's **New wording** box from that phrase). `build_review.py <work_dir>` (add `--page` for a web page: the claims are overlaid on a snapshot of the original site, scripts stripped, so it looks like the page the author knows); open `review.html`. Write `FINDINGS.md`: totals, then every non-green claim in severity order with its suggested wording, then which sources were unreachable or thin, which mode ran, and which model ran the adversary (light mode: say the adversarial pass was skipped and what it would have caught). Done when the page shows zero orphans and the findings cover every non-green claim.
6. **Apply decisions.** The reviewer works through the **Issues** tab in the page: for each issue, edits the **New wording** if needed and clicks **Queue edit**, or **Dismiss**; then clicks **Send edits to agent** and pastes the `FACTCHECK DECISIONS` block. Save it, run `decisions_to_edits.py`, then `apply_gdoc_suggestions.py --dry-run`, show the list, apply on confirmation (`references/google-docs.md`). Done when each edit is reported applied or skipped with a reason.
7. **Re-run after edits.** `extract_document.py`, `check_anchors.py`, `reanchor.py` with a `changes.json`, rebuild. Verify only new claims.

## Rules

- A quote counts only if found by string search in a file under `sources/`, or copied verbatim from a page fetched this session. Compiled notes are never a source.
- The adversary only downgrades or adds. A status rises only by adding a verified quote.
- Headings and link text are claims.
- Say exactly what was and was not verified. Unreachable sources go in the findings.
