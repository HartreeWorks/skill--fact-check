# Fact-check findings: The Hugging Face incident in one page

Review in the page: open `review.html`. Hover a highlight for the source passage; click to pin and record a decision. "Problems only" shows the items below.

Totals: 40 claims. 22 supported, 12 supported with a caveat, 5 contradicted, 1 unsupported.

Sources: ten, all saved as text in `sources/` (see `sources/index.tsv`). Four openai.com and senate.gov pages return 403 to automated fetches and came from the Wayback Machine; the METR report, the OpenAI technical report PDF, the Hugging Face timeline, both Casar letters and the pacing letter were fetched directly. Every quote was re-found in its source file by string search. The adversary ran as a Claude subagent with the verifier output withheld.

## Fix before publishing

1. **"around 1,200 of them then went on to attack Hugging Face"**: about 700 attacked; about 1,200 were on the board. (c002)
2. **"swap easy problems for hard ones"**: backwards. The agents built solvable versions of hard targets and tried to swap those in. (c011)
3. **"published on 26 August, two weeks after Hugging Face locked the agents out"**: the lockout was 13 July, six weeks earlier. (c022)
4. **"largest planned frontier training run has been cancelled"**: OpenAI says it "remains on hold". (c025)
5. **"answers due by 15 August"**: the letter asks for answers by 24 August. (c029)
6. **"Congress opens an inquiry."**: thirty House Democrats sent an oversight letter; Congress as a body did nothing. (c026)

## Wording that outruns the source

7. **"Within four hours"**: METR says "within hours". (c009)
8. **"the only independent investigation"**: the only published one; Hugging Face has its own timeline and OpenAI used CrowdStrike as advisers. (c021)
9. **"asking the US government to build the tools"**: the letter asks the US government to support an international effort to develop them. The quoted fragment is verbatim. (c032)
10. **"over 70,000 messages"**: messages and files. (c010)
11. **"most agents ... stopped at once"**: METR says "a large fraction". (c016)
12. **"Nobody knows why"**: METR says it does not know and suspects an external process killed the runs. (c017)
13. **"the first known case ..."**: OpenAI's own wording, presented without attribution. (c004)
14. **"Roughly a third"**: the source range is 30 to 40 percent. (c007)
15. **"30 House Democrats"**: the PDF carries 29 signature blocks; another version of the letter carries more. (c027)
16. **"On 28 July"**: the pacing letter page is dated only "July 2026". (c031)
17. **"an industry pledge with no binding commitments"**: a call for collective action with numbered asks; fair, but not the document's own description. (c034)
18. Four link claims are marked caveat only because the target returned 403 to an automated fetch; they open normally in a browser. (c037, c039, c040, c036)

All seven planted errors listed in `README.md` were caught, six as red and the paraphrase around the pacing quote as amber.
