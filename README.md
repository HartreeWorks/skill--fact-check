# Fact check

A skill for checking that a draft says only what its sources support, and reviewing the result on the text itself rather than in a separate report.

![The review page: the document on the left with claims highlighted red, amber and green; on the right a card for the selected claim showing the finding, the current wording struck through, an editable new wording with Queue edit and Dismiss buttons, and the source passage with Source viewer and Website links.](./assets/review-page.png)

A fact check of a one-page summary of the July 2026 OpenAI / Hugging Face incident. The selected claim has the direction of an event backwards; the card quotes the METR report that shows it, and the reviewer can queue the corrected wording for the agent to apply.

What you get:

- **A review page.** Every checkable claim is highlighted by status: supported, supported with a caveat, unsupported, contradicted, or opinion presented as fact. A sidebar lists the issues in document order. Each opens a card with the finding, the current and proposed wording, the verbatim source passages with a viewer and a link to the live page, and Queue edit or Dismiss. "Send edits to agent" copies your decisions as a block the agent acts on.
- **A findings file** in severity order, with suggested rewording.
- **Suggested edits in the Google Doc**, when you ask for them: tracked suggestions with an anchored comment explaining each.

How it earns trust: every quote must be re-found by string search in a saved copy of the source; verification runs on fast parallel subagents; a separate adversarial pass, which never sees the verifier output, can only downgrade or add; the lead model adjudicates. A page of about 2,000 words takes roughly one to two hours of heavy agent use; the skill states the cost and offers a lighter mode before it starts.

## Requirements

Works with Claude Code out of the box for web pages and link-shared Google Docs. Optional: the [gdoc CLI](https://github.com/LucaDeLeo/gdoc) reads Google Docs with their formatting and writes suggested edits back; writing suggestions also needs Google Docs API developer-preview access on your account. Without it the skill produces an `edits.md` for applying by hand. `pdftotext` (poppler) or `pypdf` for PDF sources.

## Installation

```bash
npx skills add HartreeWorks/skill--fact-check
```

## Try it

Ask your agent:

```text
Fact-check https://docs.google.com/document/d/<your-doc-id>/edit against its sources. The primary sources are the two reports it links to plus the company's own statement; treat news coverage as secondary. I want suggested edits in the doc at the end.
```

The agent extracts the document, confirms the source list and the run mode with you, fetches the sources, extracts and verifies the claims, runs the adversarial pass, and opens `review.html`. You work through the issues, click "Send edits to agent", paste the block back, and the agent applies the queued edits as suggestions in the doc.

A worked example with planted errors is in [`examples/hugging-face/`](./examples/hugging-face/); its README is the answer key.

## Documentation

See [SKILL.md](./SKILL.md) for complete documentation and usage instructions, and [`references/`](./references/) for the verifier and adversary briefs, the status definitions, the Google Docs notes, and the reasoning behind the process.

## About

Created by [Peter Hartree](https://x.com/peterhartree) of [AI Wow](https://wow.pjh.is).

Find more skills at [HartreeWorks/skills](https://github.com/HartreeWorks/skills).
