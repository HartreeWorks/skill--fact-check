# Google Docs: reading and writing back

## Reading

`extract_document.py` tries, in order:

1. The `gdoc` CLI (`gdoc cat <id>`), which exports formatted Markdown: headings, lists and links survive, so link claims and the review page render properly. Install: https://github.com/LucaDeLeo/gdoc, then `gdoc auth`. Pass `--account EMAIL` when more than one account is configured.
2. The export URL `https://docs.google.com/document/d/<id>/export?format=txt`. Works only for documents shared as "anyone with the link". Plain text: headings and links are lost, so link claims cannot be extracted. Say so in the findings.

If neither works, ask the user to export the document as Markdown or HTML (File, Download) and pass the file.

## Writing suggested edits

`apply_gdoc_suggestions.py <doc> edits.json --account EMAIL [--dry-run]` turns each edit into a tracked suggestion (insert then delete, in SUGGEST mode) with an anchored comment giving the reason. It reuses the OAuth token the `gdoc` CLI stored under `~/.config/gdoc`, and needs `pip install requests google-auth`.

Requirement that bites: SUGGEST mode is a Google Workspace developer-preview feature. Without it the API returns 200 and applies the edits directly. The script checks after the first edit that a suggestion appeared and aborts if not, so the worst case is one direct edit, which the user can undo. To get access: apply at https://goo.gle/WSDevPreview with a Workspace account and the Cloud project number behind the `gdoc` credentials.

Always run `--dry-run` first and show the user the list. Then apply. Report each line's OK or SKIP; a SKIP means the anchor did not match exactly once, so extend it and rerun that edit.

## Fallbacks when suggestions are not available

1. Anchored comments only: `gdoc comment <doc> --text "<why>" --quote "<anchor>"` per edit. The reviewer applies the wording by hand.
2. No write access at all: `decisions_to_edits.py` already wrote `edits.md`; hand that to the author.

Never use `gdoc edit` or `gdoc write` to apply fact-check changes directly. The author decides; the tool suggests.
