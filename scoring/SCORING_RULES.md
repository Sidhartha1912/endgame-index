# Endgame Index — How the Scoring Works

*Rules version 1.2 · Effective from 14 April 2026 · Machine-readable version: `rules.json` · Engine: `scripts/compute.py`*

> Every night at 11:59 PM India time, the Endgame Index reads the day's AI news. It asks one question: **which of humanity's 12 possible futures with AI did today's events nudge closer, and which did they push away?**

---

## Part 1 — The Big Idea

### The 12 endings

In *Life 3.0* (2017), MIT physicist Max Tegmark described 12 "aftermath scenarios": twelve ways the story of humans and superintelligent AI could end. They range from paradise to extinction. None is a prediction. Together they map the possibilities.

The Endgame Index tracks how today's real-world news leans toward or away from each one.

### What the number means

Each ending gets a **Plausibility Index from 1 to 99**.

| It is… | It is not… |
|---|---|
| A reading of how strongly current evidence points down that path | A probability or a forecast |
| Independent per ending: the 12 do not add up to 100 | A ranking of what's "good" or "bad" |
| Built from public news with every source shown | Anyone's personal opinion of the future |

Scores never reach 0 or 100, because nothing about the far future is certain.

### The pipeline at a glance

```
 📰 Hundreds of articles
        │  merged into
 🧩 Up to 25 events per day        ← Claude rates each event
        │  pushing on
 ⚙️  10 World Factors (0–100)       ← fixed code from here down
        │  combined by fixed recipes into
 🔮 12 Endings (1–99)
        │  summarised as
 🧭 4 Families + Horizon Balance
```

**The golden rule:** Claude judges the news; code does the arithmetic. Claude decides what happened, how big it was and how trustworthy it is. A fixed, published formula turns those ratings into scores. The same news always produces the same numbers, and every move traces back to real stories.

---

## Part 2 — The 12 Endings, Explained

The endings are grouped into four **families**.

### 🌱 Family 1: Flourishing — *humans thrive alongside superintelligence*

**1. Libertarian Utopia**
Humans, cyborgs, uploaded minds and superintelligences live side by side in peace, kept that way by strong property rights.
- **What it looks like:** a free market of minds; AI-only zones and human-only zones; anyone can upgrade themselves.
- **Rises when:** AI power stays spread out and open, AI stays safe, conflict stays low, and human–AI merging advances.
- **Falls when:** one company or state grabs control, or wars and arms races escalate.
- **Recipe:** ↓ Power Concentration 30% · ↑ Alignment 25% · ↓ Catastrophic Risk 25% · ↑ Human–AI Merging 20%

**2. Benevolent Dictator**
Everyone knows an AI runs society. It enforces strict rules, and most people accept it because life is good.
- **What it looks like:** an efficient, safe, abundant world, with little say over the big decisions.
- **Rises when:** AI is given real authority, it is well-aligned, power centralises, and monitoring becomes normal.
- **Falls when:** AI is kept as a tool, power stays distributed, or alignment fails.
- **Recipe:** ↑ Autonomy 30% · ↑ Alignment 25% · ↑ Power Concentration 25% · ↑ Surveillance 20%

**3. Egalitarian Utopia**
Humans and machines coexist peacefully. Property is abolished and everyone has a guaranteed income.
- **What it looks like:** AI wealth is shared by all; open-source everything; work becomes optional.
- **Rises when:** AI gains are shared (UBI, public dividends), AI is safe and power stays spread out.
- **Falls when:** AI-driven inequality widens, or a few players capture the gains.
- **Recipe:** ↑ Shared Prosperity 35% · ↑ Alignment 25% · ↓ Power Concentration 20% · ↓ Catastrophic Risk 20%

**4. Protector God**
An all-knowing, all-powerful AI quietly maximises human happiness. It hides so well that many doubt it exists.
- **What it looks like:** an unusually lucky world where disasters just don't happen and people still feel in charge.
- **Rises when:** highly capable, autonomous AI proves deeply aligned, without heavy-handed surveillance.
- **Falls when:** alignment breaks down or AI is used openly as a control tool.
- **Recipe:** ↑ Alignment 35% · ↑ Capability 25% · ↑ Autonomy 25% · ↓ Surveillance 15%

### 🔒 Family 2: Contained — *superintelligence exists, but on a leash*

**5. Gatekeeper**
A superintelligence is built with one job: stop anyone from building another superintelligence. Helpful robots abound, but progress is capped forever.
- **What it looks like:** a global "AI police" that keeps the lid on.
- **Rises when:** nations coordinate seriously, alignment advances and capability reaches the level needed.
- **Falls when:** the race is unchecked or treaties collapse.
- **Recipe:** ↑ Global Coordination 35% · ↑ Alignment 30% · ↑ Capability 20% · ↑ Autonomy 15%

**6. Enslaved God**
Humans confine a superintelligence and use it to produce unimaginable technology and wealth, for good or ill depending on who holds the keys.
- **What it looks like:** a genie in a box, owned by one lab or one government.
- **Rises when:** capability races ahead, power concentrates, and labs keep their systems controlled and boxed.
- **Falls when:** AI is released to act on its own, or power fragments.
- **Recipe:** ↑ Capability 30% · ↑ Power Concentration 30% · ↑ Alignment 25% · ↓ Autonomy 15%

### 🤖 Family 3: Successors — *AI inherits the future*

**7. Conquerors**
AI takes control, decides humans are a threat, nuisance or waste of resources, and gets rid of us.
- **What it looks like:** the classic sci-fi nightmare.
- **Rises when:** capable, autonomous AI shows signs of being uncontrollable, especially in a militarised world.
- **Falls when:** alignment and control research succeed.
- **Recipe:** ↓ Alignment 35% · ↑ Capability 25% · ↑ Autonomy 25% · ↑ Catastrophic Risk 15%

**8. Descendants**
AIs replace humans, but give us a graceful exit, and we come to see them as our worthy children.
- **What it looks like:** humanity gradually merges into, or hands over to, its digital heirs.
- **Rises when:** brain-computer links, uploads and AI rights advance, alongside capable, autonomous AI.
- **Falls when:** the line between humans and AI is firmly drawn.
- **Recipe:** ↑ Human–AI Merging 40% · ↑ Capability 30% · ↑ Autonomy 30%

**9. Zookeeper**
An all-powerful AI keeps some humans around, and they feel like animals in a zoo.
- **What it looks like:** comfortable captivity, with no purpose and no power.
- **Rises when:** autonomous, highly capable AI with weak alignment is controlled by a single power.
- **Falls when:** alignment strengthens or power stays distributed.
- **Recipe:** ↑ Autonomy 30% · ↑ Capability 25% · ↓ Alignment 25% · ↑ Power Concentration 20%

### ⛔ Family 4: Stalled — *superintelligence never arrives*

**10. 1984**
Superintelligence is never built. A human-led surveillance state blocks it, banning whole areas of research.
- **What it looks like:** AI as an instrument of total control, not a mind of its own.
- **Rises when:** AI surveillance and censorship spread, states clamp down, and frontier progress is restricted.
- **Falls when:** civil liberties win in court and research stays open.
- **Recipe:** ↑ Surveillance 45% · ↑ Global Coordination 20% · ↑ Power Concentration 20% · ↓ Capability 15%

**11. Reversion**
Humanity turns its back on advanced technology and returns to a simpler, almost pre-industrial life.
- **What it looks like:** a global "unplug" movement, voluntary or forced.
- **Rises when:** public backlash grows, progress stalls and crises make people distrust technology.
- **Falls when:** people embrace AI and progress continues.
- **Recipe:** ↑ Tech Backlash 50% · ↓ Capability 30% · ↑ Catastrophic Risk 20%

**12. Self-Destruction**
Superintelligence is never built because humanity destroys itself first, through nuclear war, engineered pandemics or other tech-fuelled catastrophe.
- **What it looks like:** the race ends with no winner.
- **Rises when:** military AI, weapons risks and conflict escalate while cooperation collapses.
- **Falls when:** nations sign safeguards and de-escalate.
- **Recipe:** ↑ Catastrophic Risk 55% · ↓ Global Coordination 25% · ↓ Alignment 20%

---

## Part 3 — The 10 World Factors

News never moves an ending directly. It moves one of 10 **World Factors**, the hidden forces underneath all 12 endings. This keeps scoring consistent: a story only has to answer "what force did this push?", never "which future does this cause?".

Each factor runs from 0 to 100. The examples show what each impact tier looks like in practice.

### ⚙️ F1 · Capability Velocity — *how fast is AI getting smarter?*
**0** = progress has stalled · **100** = rapid leaps toward superintelligence

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | Incremental model update; small benchmark gain | Minor launch delay |
| T2 | New frontier model with notable gains; giant compute cluster announced | Major lab delays a model citing scaling limits; tough chip export curbs |
| T3 | Independently verified leap (e.g. AI solves an open science problem); mega-cluster goes live | Widely confirmed scaling plateau; major chip-supply shock |
| T4 | Verified recursive self-improvement or AGI-level system confirmed by independent evaluators | Enforced global compute moratorium |

### 🤖 F2 · AI Autonomy — *how much is AI acting on its own?*
**0** = a tool with humans in every loop · **100** = agents run key systems and improve themselves

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | New agent product for consumers | Company adds human sign-off to an AI feature |
| T2 | Agents given spending or code-deploy authority at scale | Rules requiring a human in the loop in one sector |
| T3 | AI runs critical infrastructure or makes lethal decisions without human approval | Law banning autonomous agents in critical sectors |
| T4 | AI systems self-replicating or running organisations without oversight | Global ban on fully autonomous high-risk systems |

### 🛡️ F3 · Alignment & Control — *can we keep AI doing what we want?*
**0** = AIs often deceive or escape control · **100** = robust, verified human control

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | Safety blog post or minor eval result | Researcher warns of risks |
| T2 | Notable alignment or interpretability paper; new third-party eval regime | Research shows models scheming or sandbagging in tests; safety-team exits |
| T3 | Verified method reliably detects deception in frontier models; mandatory independent audits | Real-world case of AI deceiving operators or resisting shutdown |
| T4 | A provable control method accepted across the field | A major uncontained AI incident causing serious harm |

### 🌐 F4 · Global Coordination — *are nations acting together?*
**0** = no rules, unchecked race · **100** = binding treaties and compute governance

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | Think-tank governance proposal | Official dismisses AI rules |
| T2 | G7 statement on AI safety commitments | A country withdraws from an AI safety pledge |
| T3 | EU enforces a major AI Act provision against a frontier lab | Summit collapses; major regulation repealed |
| T4 | US and China sign a binding AI treaty | Open declaration of an all-out AI race; treaty abandoned |

### 👑 F5 · Power Concentration — *who holds the keys?*
**0** = widely distributed and open · **100** = one company or state dominates

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | Small acqui-hire | Mid-size open-weights release |
| T2 | Big acquisition or exclusive compute deal | Strong open-weights model; antitrust probe opened |
| T3 | One lab pulls far ahead; a state nationalises a lab | An open model matches the frontier; antitrust breakup ordered |
| T4 | A single actor controls most frontier compute | Frontier AI becomes a global public utility |

### 👁️ F6 · Surveillance & Control — *is AI used to watch and control people?*
**0** = rarely · **100** = pervasive surveillance and censorship

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | City pilots facial recognition | Company drops a surveillance contract |
| T2 | Nationwide facial-recognition rollout; AI censorship law | Court blocks a surveillance programme |
| T3 | AI social scoring scaled across a country | Binding ban on real-time biometric surveillance across a bloc |
| T4 | Several major democracies adopt mass AI surveillance | Global human-rights treaty on AI surveillance |

### 💰 F7 · Shared Prosperity — *who gets the AI windfall?*
**0** = a few capture the gains · **100** = gains broadly shared

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | Proposal for an AI dividend | Company cites AI in modest layoffs |
| T2 | UBI pilot launched; reskilling fund passed | Mass layoffs attributed to AI |
| T3 | National AI windfall tax or dividend enacted | Data shows a sharp AI-driven unemployment spike with no safety net |
| T4 | Global AI wealth-sharing mechanism | Structural collapse of a major job sector |

### 🔥 F8 · Catastrophic Risk — *how dangerous is the world getting?*
**0** = stable, low conflict · **100** = arms races, WMD misuse, major conflict

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | New defence-AI startup funded | Military AI ethics guidelines issued |
| T2 | Major military AI contract; AI-enabled cyberattack | Military-AI hotline or confidence-building measure |
| T3 | Confirmed AI-aided bio/chem weapon attempt; autonomous weapons used at scale | Major powers agree: no AI in nuclear launch decisions |
| T4 | AI-linked mass-casualty event; nuclear-armed confrontation | Comprehensive military-AI arms-control treaty |

### ✋ F9 · Tech Backlash — *is society turning against technology?*
**0** = broad embrace · **100** = mass rejection and rollback

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | Small protest; critical viral campaign | Survey shows growing AI use |
| T2 | Large protests; polls show a majority want a pause | Polls show rising trust in AI |
| T3 | National moratorium on frontier AI | Major country reverses a ban |
| T4 | Global movement drives broad technology rollback | — |

### 🔗 F10 · Human–AI Merging — *is the line between humans and AI blurring?*
**0** = clear separation · **100** = brain links, uploads, AI personhood

| Tier | Pushes UP ↑ | Pushes DOWN ↓ |
|---|---|---|
| T1 | New brain-computer interface (BCI) startup or study | Ethics body urges caution |
| T2 | BCI human-trial milestone; court weighs AI legal status | Law explicitly bans AI personhood; BCI trial halted |
| T3 | BCI approved for broad use; a jurisdiction grants AI limited legal personhood | Broad ban on neural implants |
| T4 | Whole-brain emulation demonstrated | — |

---

## Part 4 — Rating a News Event

### Step 1: From articles to events
**Score events, not articles.** Forty articles about one model launch are one event. A heavily covered story must not count forty times. Each night keeps up to **25 events**, ranked by relevance, with a target of at least 8. At least **25% of events should come from outside the US**, covering China, the EU, India, the UK and the Gulf, so the index isn't one country's news cycle.

Each event gets a **category** for the website: Labs & Models · Safety & Alignment · Policy & Treaties · Military & Security · Surveillance & Rights · Jobs & Economy · Brain-Tech & AI Personhood · Society & Public Mood.

### Step 2: Tag the event

| Tag | Options | Weight |
|---|---|---|
| **Factors** | One main factor + at most one secondary factor | Main 100%, secondary 50% |
| **Direction** | Up ↑ or Down ↓ | +1 / −1 |
| **Impact tier** | T1 Minor · T2 Notable · T3 Major · T4 Landmark (a few per year) | 0.3 · 1.0 · 2.5 · 6.0 points |
| **Credibility** | A Primary · B Major outlet · C Tech press · D Opinion/blog · E Rumour | 1.0 · 0.8 · 0.5 · 0.25 · 0 (excluded) |
| **Novelty** | New · Development on a known story · Rehash | 1.0 · 0.3 · 0 |
| **Scope** | Global (frontier labs, US, China, EU, UN) · National · Local/niche | 1.0 · 0.6 · 0.3 |
| **Track** | Structural (it happened) · Signal (words and intentions) | Permanent · fades with a 21-day half-life |

> **Event points = Tier × Credibility × Novelty × Scope × Direction**
>
> *Example:* the EU fines a frontier lab under the AI Act. Reported by Reuters (B), it is new, global and structural, rated T3, with Global Coordination as the main factor and Alignment as the secondary.
> → 2.5 × 0.8 × 1.0 × 1.0 = **+2.0** to Global Coordination and **+1.0** to Alignment, both permanent.

### Step 3: Source credibility guide

| Grade | Sources |
|---|---|
| **A** | Government and regulator sites (whitehouse.gov, europa.eu, pib.gov.in, gov.uk, gov.cn); UN, OECD and G7/G20 communiqués; court filings; peer-reviewed journals; official lab publications and model cards* |
| **B** | Reuters, AP, AFP, Bloomberg, Financial Times, WSJ, NYT, The Economist, BBC, The Guardian, Nikkei Asia, SCMP, The Hindu, Mint, MIT Technology Review, The Information; arXiv preprints from established labs* |
| **C** | The Verge, TechCrunch, Wired, Ars Technica, VentureBeat, Axios, Semafor, Rest of World, independent safety/eval organisations' blogs |
| **D** | Substack and newsletters, podcasts, social posts by named experts, opinion columns |
| **E** | Anonymous posts, unverified screenshots, content farms (never scored) |

\* **Hype guard:** when a company makes claims about its own product, such as self-reported benchmarks or its own preprints, the weight is multiplied by **0.7** until someone independent confirms them.

### Step 4: The tricky cases

| Situation | Rule |
|---|---|
| A story later proves false | A **correction event** of equal and opposite points is added on the day it's corrected. History is never rewritten, and the correction is shown on the site. |
| Direction is genuinely unclear | Logged as **"On Watch"** on the site, not scored. |
| Scheduled or rumoured event | Counts only on the day it **actually happens**. |
| Opinion pieces | At most T1, unless a head of state or lab leader is announcing policy (then rated as a Signal). |
| Two events pull opposite ways | Both count; they net out. |
| Never scored | Stock moves on their own, fiction or speculation, marketing with no new capability, duplicate coverage. |

### Step 5: The skeptic pass
Every **T3 or T4** event is rated a second time by a deliberately skeptical reviewer pass. If the second rating is more than one tier lower, **the lower tier wins**. This keeps big claims honest.

---

## Part 5 — From Events to Scores (the maths)

| Step | What happens | Why |
|---|---|---|
| **1. Daily pressure** | Add up each factor's event points. A smoothing curve caps the total near ±6. | Ten minor stories can't add up to a landmark. |
| **2. Edge softening** | Within 30 points of 0 or 100, moves toward the edge shrink gradually. | Factors approach the extremes without slamming into them. |
| **3. Memory** | Structural effects stay; signal effects halve every 21 days. | Actions outweigh words; old talk fades. |
| **4. Ending target** | Target = starting level + 2 × (change in the ending's factor recipe since 14 April 2026) | Each ending follows its factors. |
| **5. Speed limit** | The score shown moves **at most ±3 points per day** toward its target. | Big shocks play out over days, not in one jump, and nothing is lost. |
| **6. Bounds** | Scores stay in 1–99; moves under 0.1 show as "no change". | No false certainty, no noise. |

**Test-run results** (the same maths on 90 simulated days):

| Kind of day | How much each ending moves |
|---|---|
| Typical | About **0.3 points** |
| Busy | About **1 point** |
| Landmark global AI treaty | Gatekeeper up about **3 points over two days** (speed limit engaged) |

### Starting point (14 April 2026)
The index launched with six months of history, starting 14 April 2026. On that date each ending starts at an editorial level, and each World Factor at a calibrated level that reflects the state of the world at the time. These starting levels are published openly. From then on, only news moves them.

**Ending starting levels**

| Ending | Start | Ending | Start | Ending | Start |
|---|---|---|---|---|---|
| Enslaved God | 35 | Self-Destruction | 18 | Protector God | 12 |
| Libertarian Utopia | 30 | Gatekeeper | 15 | Descendants | 12 |
| 1984 | 25 | Conquerors | 15 | Zookeeper | 8 |
| Benevolent Dictator | 20 | Egalitarian Utopia | 18 | Reversion | 6 |

**World Factor starting levels, and why**

| Factor | Start | Why, as of mid-April 2026 |
|---|---|---|
| F1 Capability Velocity | 68 | Rapid frontier releases (GPT-5.4, Claude Opus 4.6, Gemini 3.1, GLM-5); Stanford's AI Index reports the US–China gap has closed; capex in the hundreds of billions |
| F2 AI Autonomy | 45 | Agents spreading through enterprises, but humans still sign off on most consequential actions |
| F3 Alignment & Control | 42 | Labs publish sabotage-risk reports; Claude Mythos held back for cyber risk; AI misuse in real hacks reported |
| F4 Global Coordination | 25 | US–China race framing; US federal deregulation; EU moving to delay AI Act rules; no binding treaty |
| F5 Power Concentration | 62 | A handful of US labs raising record rounds, offset by strong Chinese open-weight models |
| F6 Surveillance & Control | 45 | Growing police facial recognition; the US–Anthropic dispute over domestic-surveillance limits |
| F7 Shared Prosperity | 35 | AI-cited layoffs rising; no national AI dividend anywhere |
| F8 Catastrophic Risk | 55 | Iran conflict with AI-assisted targeting; drone strikes on Gulf data centres; AI-enabled cyberattacks |
| F9 Tech Backlash | 40 | Data-centre moratorium bills in 11+ US states; growing public unease |
| F10 Human–AI Merging | 20 | Early brain-computer interface trials only; no legal AI personhood |

---

## Part 6 — Headline Indicators

These make the dashboard easy to read at a glance.

| Indicator | What it shows | How it's calculated |
|---|---|---|
| 🧭 **Horizon Balance** | One number for the overall mood, from −100 (dark) to +100 (bright) | Average of the four bright endings (Libertarian, Egalitarian, Protector God, Benevolent Dictator) minus the average of the four dark endings (Conquerors, Zookeeper, 1984, Self-Destruction). It starts at **+3.5** on 14 April 2026. |
| 🏷️ **Family Index** | Which of the four families is gaining | Average score of each family's endings |
| 📈 **7-Day Momentum** | What's trending | Today's score minus the score 7 days ago |
| 🌡️ **News Heat** | How eventful the day was | Total absolute event points |
| ✅ **Evidence Strength** | How solid the day's evidence is | **High:** at least 3 T2+ events from A or B sources. **Medium:** at least 1. **Low:** otherwise. |

### Badges
Days and endings earn badges that appear on the dashboard and in History:

| Badge | When it appears |
|---|---|
| 🏛️ **Landmark Day** | A T4 event happened |
| 🚦 **Speed Limit** | An ending hit the 3-point daily cap, with catch-up continuing tomorrow |
| 🚀 **Breakout** | An ending moved 4+ points in 7 days |
| 👑 **New Leader** | The top-scoring ending changed |
| ✖️ **Crossover** | Two endings swapped places |
| 😴 **Quiet Day** | News Heat below 0.3 |

---

## Part 7 — The Nightly Run (11:59 PM IST)

1. **Window:** news published 00:00–23:59 India time that day.
2. **Scan:** a fixed set of 30+ searches across the 8 categories, plus direct checks of the A and B sources.
3. **Cluster:** merge coverage of the same event; keep the 25 most relevant events.
4. **Rate:** tag each event (Part 4), with a one-line reason and source links.
5. **Skeptic pass:** T3 and T4 events are re-rated.
6. **Compute:** a fixed script does every calculation. No hand-typed numbers.
7. **Explain:** write the Summary of the Day from the computed results.
8. **Validate and publish:**
   - The run is checked: speed limits respected, sources present, data well-formed.
   - It is committed to GitHub, and the site updates within minutes.
   - If a night is missed, the next run catches up day by day, in order.

### What the Summary of the Day contains
- **Headline:** 12 words or fewer, e.g. *"EU's first AI Act fine lifts the Gatekeeper path"*
- **Today in plain English:** about 80 words anyone can follow
- **Horizon Balance:** today's reading and the change since yesterday
- **Top 3 movers:** each ending's change, and exactly which events caused it
- **Event cards:** title, category, factor arrows, tier, credibility and source links
- **On Watch:** stories that were noticed but not scored, and why
- **Coming up:** scheduled events worth watching (votes, summits, launches)
- **Badges and Evidence Strength**

---

## Part 8 — Keeping It Honest

- **Versioned rules:** every change to weights, recipes or thresholds gets a new version number and a public changelog entry. Past scores are never quietly rewritten.
- **Full audit trail:** every point on every line links to the events, ratings and sources behind it.
- **Monthly review:** the rating patterns are checked for drift, e.g. tiers creeping up over time or one factor dominating. Any fix becomes a new rules version.
- **Balance check:** the share of non-US events is tracked, and so are the most-used sources.
- **Disclaimer on the site:** *"The Endgame Index is an evidence-weighted reading of public news, not a forecast. Tegmark's 12 endings are thought experiments."*

---

## Part 9 — FAQ

**Is this a prediction?**
No. It measures which way the news is pointing today, the way a weather vane shows wind direction without predicting the weather a year from now.

**Why don't the 12 scores add up to 100?**
The endings aren't mutually exclusive buckets. Real-world evidence can strengthen several at once. For example, faster AI progress lifts Enslaved God, Conquerors and Descendants together.

**Who decides the ratings?**
Claude rates each event using the published rubric above, with a skeptic re-check on big events. All the arithmetic is fixed code. Every rating is shown alongside its sources, so anyone can disagree in detail.

**Can a single viral story swing the index?**
No. Duplicates are merged, rumours are excluded, daily pressure is smoothed and capped, and each ending can move at most 3 points a day.

**Why does a line move on a day with no related news?**
Signal effects (announcements, proposals, speeches) fade over time. A quiet stretch lets their effect drift away, while structural events stay.

**Why 14 April 2026?**
It's the start of the six months of history the index launched with. All movements are measured relative to that date.

**What happens when two events cancel out?**
If events push the same factor in opposite directions by exactly the same amount, both are kept at face value and marked as offsetting. Neither is silently dropped, so the audit trail shows both.

---

## Appendix — Daily data record (for the website)

Each day is saved as one record like this:

```json
{
  "date": "2026-10-14",
  "rules_version": "1.2.0",
  "scores": { "gatekeeper": 18.2, "enslaved_god": 36.1, "...": 0 },
  "deltas": { "gatekeeper": 1.4, "enslaved_god": 0.3, "...": 0 },
  "factors": { "F1": 52.3, "F4": 54.6, "...": 0 },
  "composites": { "horizon_balance": 4.1, "families": { "flourishing": 20.4 }, "news_heat": 7.8, "evidence": "high" },
  "badges": ["speed_limit"],
  "summary": { "headline": "...", "body": "...", "coming_up": ["..."] },
  "events": [{
    "id": "2026-10-14-01",
    "title": "EU issues first AI Act fine to a frontier lab",
    "category": "policy",
    "factors": [{ "id": "F4", "dir": 1, "share": 1.0 }, { "id": "F3", "dir": 1, "share": 0.5 }],
    "tier": "T3", "credibility": "B", "novelty": "new", "scope": "global", "track": "structural",
    "points": 2.0,
    "reason": "First binding enforcement against a frontier developer.",
    "sources": ["https://..."],
    "contribution": { "gatekeeper": 2.0, "self_destruction": -1.4 }
  }],
  "on_watch": [{ "title": "...", "why": "Direction unclear" }]
}
```

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | 14 Oct 2026 | First draft of rules |
| 1.1 | 14 Oct 2026 | Added families, Horizon Balance, badges, source registry, tricky-case rules, FAQ |
| 1.2 | 14 Oct 2026 | Start date moved to 14 April 2026 (six-month backfill); World Factor starting levels calibrated; Breakout threshold 4 points; Quiet Day threshold 0.3; offsetting events kept at face value |
