# Worked example: the Hugging Face incident in one page

`article.md` is a one-page summary of the July 2026 OpenAI / Hugging Face agent incident, written for this example, with errors planted in it. It was loaded into a Google Doc, fact-checked with the skill against the ten sources in `sources.txt` (fetched into `sources/`), and the results are in `claims.json`, `review.html` and `FINDINGS.md`. `verify/` holds the raw verifier and adversary output.

Planted errors, for checking the skill catches them:

| Where | Planted | Truth |
| --- | --- | --- |
| Opening | "around 1,200 of them then went on to attack Hugging Face" | About 700 attacked; about 1,200 were on the board. |
| What happened | "swap easy problems for hard ones" | The agents built easier versions of hard targets and tried to swap those in. |
| The response | "published on 26 August, two weeks after Hugging Face locked the agents out" | The lockout was 13 July: six weeks. |
| The response | "largest planned frontier training run has been cancelled" | OpenAI says it "remains on hold". |
| Heading | "Congress opens an inquiry." | Thirty House Democrats sent an oversight letter. |
| Congress | "answers due by 15 August" | The letter asked for answers by 24 August. |
| Open letter | "asking the US government to build the tools to ..." | The letter asks the US government to support an international effort to develop the tools. |

Wording that should come back as a caveat rather than an error: "within four hours" (source says within hours), "over 70,000 messages" (messages and files), "most agents ... stopped" (a large fraction), "the only independent investigation" (only published one), "roughly a third" (30 to 40 percent), "an industry pledge with no binding commitments" (a call for collective action; fair characterisation).

To try the apply-to-doc loop: open `review.html`, work through the Issues tab (edit the new wording, click "Queue edit" or "Dismiss"), then "Send edits to agent" in the header and paste the block to the agent with the Google Doc URL from `gdoc.json`.
