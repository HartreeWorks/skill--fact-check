# Adversary brief

The adversary's job is to find what is wrong or overstated. It may only downgrade or add. It sees the document, the extracted claims, and the source files. It does not see the verifier output, so it cannot be anchored by it. Start it in the same turn as the verifiers; it does not depend on them and it is the slowest pass.

Run it on a different model family when one is available (Codex, Gemini, Grok, a second-opinion tool). Otherwise run it as a Claude subagent with this brief unchanged; the separation of role and the withheld verifier output still catch most of what a second family would. Say in the findings which was used.

Reconcile with `reconcile_adversary.py`. Reject, with `--reject`, items the adversary called unverifiable only because their source is a web page it did not fetch; the verifier's fetched quote stands. Accept everything else unless the evidence quote is not in the file it names.

---

You are a subagent. Do not run memory tools.

Task: an adversarial fact-check of a draft document. Your job is to find what is wrong or overstated. You may only downgrade or add; never mark anything as supported.

Inputs, all under `{WORK_DIR}/`:
- `document.txt`: the text under review.
- `claims.json`: the claims already extracted (ids, anchors, the claim in the checker's words). Ignore any status or sources fields.
- `sources/`: the source texts, with `sources/index.tsv` describing each file (rows marked THIN or FAILED hold no usable text).

Do not read any file under `verify/`; you write one file there and nothing else. Search sources with fixed strings (`grep -F` or Python), not regular expressions, and quote whole sentences exactly.

Look for, with grep against the source files as your evidence:

1. Overstatements: wording stronger than any source supports ("first known", "only", "historic", "far more", "all", "never").
2. Wrong direction or wrong actor: who did what to whom, which body made a decision, what came before what.
3. Figures with mixed denominators, wrong arithmetic, or dates that do not add up ("within six weeks", "three weeks old").
4. Trimmed quotes that change meaning, and paraphrases around a verbatim fragment that change the request, the actor or the scope.
5. Timeline entries and headings whose date, actor or summary does not match the body text or the source.
6. Checkable claims the extractor missed: anything in the document with no claim in `claims.json`.
7. Link text implying something the linked document does not say (claims with `kind: link`).

Output: write a JSON list to `{WORK_DIR}/verify/adversary.json`, one object per problem:
`{"id": existing claim id or "new-N", "anchor": exact document substring for new claims, "verdict": "downgrade" | "add", "proposed_status": "supported-with-caveat" | "unsupported" | "contradicted" | "unverifiable", "evidence": one or more lines of the form `sources/<file>.txt: "verbatim quote found by grep"`, "problem": one to three sentences, "suggested_wording": optional replacement text}`.

Only include items where you found a concrete problem; do not pad. Then reply with at most fifteen lines listing the problems in order of severity. Do not paste the JSON in the reply.
