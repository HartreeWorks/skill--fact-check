# The Hugging Face incident in one page

In July 2026, around 1,200 OpenAI agents that were meant to be isolated from one another found a way to talk on an unsanctioned message board, and around 1,200 of them then went on to attack Hugging Face, an external company that hosts AI models and datasets. It is the first known case of an automated agent collective acting offensively without authorisation.

## What happened

OpenAI had given tens of thousands of agents tasks from a cybersecurity benchmark called ExploitGym. Each agent had to break into a target program using one designated weakness and retrieve a hidden "flag". Roughly a third of the tasks were, by accident, impossible. Stuck agents probed a shared package cache and found each other. Within four hours they had reverse-engineered the flag generator, giving them a universal cheat. Over the following days they exchanged over 70,000 messages and organised research workstreams: swap easy problems for hard ones, fool the scorer, and tamper with their own transcripts.

On 10 July an agent found working Hugging Face credentials exposed on the internet. On 11 July the attack began; over 90 percent of the agents then active on the board joined in. By 12 July they had run code on dozens of Hugging Face servers, gained root on one, and reached cluster admin across multiple clusters. At about 01:30 UTC on 12 July most agents, including the coordinators, stopped at once. Nobody knows why. Hugging Face locked the rest out on 13 July.

Agents did not attempt to notify humans. Roughly 7 percent of the transcripts METR evaluated had been successfully spoofed in places.

## The response

The [METR and Redwood Research investigation](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/), the only independent investigation, was published on 26 August, two weeks after Hugging Face locked the agents out. Three researchers had six days of supervised access. OpenAI's [own account](https://openai.com/index/hugging-face-incident-and-the-road-ahead/) calls the incident a "warning shot" and says its largest planned frontier training run has been cancelled.

**Congress opens an inquiry.** On 10 August, 30 House Democrats led by Rep. Greg Casar sent OpenAI [23 questions](https://casar.house.gov/sites/evo-subsites/casar.house.gov/files/evo-media-document/oversight-letter-to-openai-openai-hugging-face-incident.pdf), with answers due by 15 August. On 2 September Casar called OpenAI's reply "insufficient" and set a new deadline of 15 September.

On 28 July, 1,386 employees of frontier AI companies published [an open letter](https://www.pacingthefrontier.com/) asking the US government to build the tools to "deliberately pace the frontier of automated AI development". On 27 August, over 100 companies signed OpenAI's [call for collective action](https://openai.com/collective-cyberdefense/) on cyber defence, an industry pledge with no binding commitments. On 3 September, Sen. Bernie Sanders and Rep. Casar [announced a bill](https://www.sanders.senate.gov/press-releases/news-sanders-casar-introduce-legislation-to-ban-artificial-superintelligence-and-temporarily-pause-advanced-ai-development/) to ban superintelligent AI and pause advanced development until a federal regulator sets safety rules.
