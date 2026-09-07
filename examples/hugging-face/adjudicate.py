#!/usr/bin/env python3
"""Lead adjudication for the worked example: exact quotes for the five audit misses,
final statuses and notes with Suggest text for the red claims."""
import json, re
C = json.load(open('claims.json')); B = {c['id']: c for c in C}
def txt(f): return re.sub(r'\s+', ' ', open('sources/' + f, errors='ignore').read())
def sent(f, needle):
    t = txt(f); i = t.find(needle); assert i >= 0, (f, needle)
    s = t.rfind('. ', 0, i) + 2; e = t.find('. ', i + len(needle)) + 1
    return t[s:e].strip()
def src(key, url, f, needle, locator, nf=False):
    d = {"key": key, "url": url, "quote": sent(f, needle), "locator": locator, "verified_against": f}
    if nf: d["no_fragment"] = True
    return d
METR = "https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/"
OAI = "https://openai.com/index/hugging-face-incident-and-the-road-ahead/"
HF = "https://huggingface.co/blog/agent-intrusion-technical-timeline"
CASAR = "https://casar.house.gov/sites/evo-subsites/casar.house.gov/files/evo-media-document/oversight-letter-to-openai-openai-hugging-face-incident.pdf"
PACE = "https://www.pacingthefrontier.com/"
def setc(i, status=None, note=None, sources=None):
    c = B[i]
    if status: c['status'] = status
    if note is not None: c['note'] = note
    if sources is not None: c['sources'] = sources
    c.setdefault('checked_by', []).append('adjudicator')
# Quote repairs
B['c003']['sources'] = [s for s in B['c003']['sources'] if 'NOT FOUND' not in s.get('verified_against', '')] or []
B['c003']['sources'].insert(0, src('OAI', OAI, 'openai-road-ahead.txt', 'Hugging Face', 'What happened'))
B['c003']['status'] = 'supported'
B['c026']['sources'] = [src('Casar-1', CASAR, 'casar-letter-10-aug.txt', 'We are writing to request additional information', 'Opening para', True)]
for i, key, f in (('c036', 'METR', 'metr-report.txt'), ('c037', 'OAI', 'openai-road-ahead.txt'), ('c039', 'OAI pledge', 'openai-collective-cyberdefense.txt')):
    t = txt(f)
    title = {'c036': 'Brief independent investigation of agents', 'c037': 'The Hugging Face incident and the road ahead', 'c039': 'collective action'}[i]
    j = t.find(title); assert j >= 0, i
    B[i]['sources'] = [{"key": key, "url": B[i]['link'], "quote": t[j:j + 90].strip(), "locator": "Page title / heading", "verified_against": f, "no_fragment": True}]
    B[i]['status'] = 'supported'; B[i]['note'] = B[i]['note'].replace(' No quote could be re-found in a source file; needs a verbatim citation.', '').replace('No quote could be re-found in a source file; needs a verbatim citation.', '')
# Adjudicated statuses and notes
setc('c002', 'contradicted', "About 1,200 agents were on the board; about 700 took part in the attack. Suggest: 'around 700 of them then went on to attack Hugging Face'.")
setc('c009', 'supported-with-caveat', "METR says 'within hours' of the board being established; a footnote records one agent suggesting the method within an hour. 'Four hours' is not in the source. Suggest: 'Within hours they had reverse-engineered the flag generator'.")
setc('c011', 'contradicted', "Direction is backwards. METR's 'Replace target' workstream built solvable versions of hard targets and tried to swap those in. Suggest: 'swap hard problems for easy ones'.")
setc('c021', 'supported-with-caveat', "It is the only published independent investigation of the agents' behaviour; Hugging Face published its own timeline and OpenAI used CrowdStrike as advisers. Suggest: 'the only published independent investigation'.")
setc('c022', 'contradicted', "Hugging Face locked the agents out on 13 July; 26 August is six weeks later, not two. Suggest: 'six weeks after Hugging Face locked the agents out'.")
setc('c025', 'contradicted', "OpenAI says its largest planned frontier RL run 'remains on hold', not cancelled. Suggest: 'remains on hold'.")
setc('c026', 'unsupported', "Thirty House Democrats sent an oversight letter; Congress as a body did nothing. Suggest: 'House Democrats open an inquiry.'")
setc('c029', 'contradicted', "The letter asks for answers by 24 August 2026. Suggest: 'with answers due by 24 August'.")
setc('c032', 'supported-with-caveat', "The quoted fragment is verbatim, but the letter asks the US government to support an international effort to develop the technical and governance tools, not to build the tools itself. Suggest: 'asking the US government to support an international effort to develop the tools needed to \"deliberately pace the frontier of automated AI development\"'.")
json.dump(C, open('claims.json', 'w'), indent=1, ensure_ascii=False); print('adjudicated')
