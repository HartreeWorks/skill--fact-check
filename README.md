# fact-check

A Claude Code skill that fact-checks a draft document, web page or Google Doc against its sources and puts the evidence on the text.

What you get:

- **A review page.** Every checkable claim is highlighted by status (supported, caveat, unsupported, contradicted, opinion). Hover for the verbatim source passage and a link that jumps to it; click to pin, then Accept, Dismiss, or Apply to doc with an editable replacement. Decisions stay in the browser and copy out as a block the agent acts on.
- **A findings file** in severity order, with suggested rewording.
- **Suggested edits in the Google Doc**, when the reviewer asks for them (tracked suggestions with an anchored comment each).

How it earns trust: every quote must be re-found by string search in a saved copy of the source; verification runs on fast parallel subagents; a separate adversarial pass, which never sees the verifier output, can only downgrade or add; the lead model adjudicates.

Install:

```
npx skills add HartreeWorks/skill--fact-check
```

Then ask Claude Code to "fact-check <URL or Google Doc link>". See `SKILL.md` for the steps, `references/` for the briefs and the reasoning, and `examples/hugging-face/` for a worked run on a one-page summary of the July 2026 OpenAI / Hugging Face incident with planted errors (its `README.md` is the answer key).

Optional: the `gdoc` CLI (https://github.com/LucaDeLeo/gdoc) for reading Google Docs with formatting and writing suggested edits; the latter also needs Docs API developer-preview access. Without it the skill reads link-shared docs as plain text and writes an `edits.md` for hand application.

Written by Peter Hartree. Index of shared skills: https://github.com/HartreeWorks/skills
