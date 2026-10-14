# Nightly run playbook (11:59 PM IST)

This is the exact procedure the scheduled Claude task follows every night. **DATE** is today's date in India time (Asia/Kolkata), `YYYY-MM-DD`.

## 0. Setup
- Get the latest repo (`git pull`).
- Read `scoring/SCORING_RULES.md` Parts 3–4 (factor examples and event tags) and `scoring/rules.json` (`search_queries`, `sources`).
- If any day between the last file in `data/events/` and DATE is missing, process each missing day first, oldest first.

## 1. Scan (news published 00:00–23:59 IST on DATE)
- Run every query in `rules.json → search_queries`, across all 8 categories. Add "today" and the date to each query.
- Directly check the A and B sources listed in `rules.json → sources`.
- Aim for coverage beyond the US: China, the EU, India, the UK and the Gulf.

## 2. Cluster
- Merge all coverage of the same event into one event.
- Drop stock moves on their own, marketing, speculation and rehashes.
- Keep up to 25 events, ranked by relevance. The target is at least 8.

## 3. Rate each event (rubric Part 4)

Each event goes into a list in `data/events/DATE.json`, in this format:

```json
{
  "id": "DATE-01",
  "title": "short factual headline (max 90 chars)",
  "summary": "1-2 plain sentences",
  "category": "labs|safety|policy|military|surveillance|economy|merge|society",
  "factors": [{"id": "F4", "dir": 1}, {"id": "F3", "dir": 1}],
  "tier": "T1|T2|T3|T4",
  "credibility": "A|B|C|D",
  "self_claim": false,
  "novelty": "new|development",
  "scope": "global|national|local",
  "track": "structural|signal",
  "region": "US|China|EU|India|UK|Global|Other",
  "reason": "one line: why these factors, direction and tier",
  "sources": ["https://..."]
}
```

Rating rules:
- **Be conservative.** T4 happens a few times a year. T3 happens a handful of times a month. Most events are T1 or T2.
- **Skeptic pass.** Re-rate every T3 or T4 event as a skeptical reviewer. If the second rating is more than one tier lower, use the lower tier.
- **Follow-ups.** If an event was already scored on an earlier day, use `"novelty": "development"`.
- **Unclear direction.** If you can't tell which way an event pushes, leave it out and mention it in the summary as "on watch".

## 4. Compute
```
python3 scripts/compute.py
```

## 5. Write the Summary of the Day
Read `data/days/DATE.json` and write `data/summaries/DATE.json`:

```json
{
  "headline": "max 12 words, factual, names the main story",
  "body": "90-150 plain-English words (40-70 on a quiet day); explain which world factor each event pushed and which endings moved; quote Horizon Balance",
  "movers_note": "top 2-3 movers with exact changes (1 decimal) and the events behind them (use the contribution values)",
  "coming_up": ["scheduled things mentioned in today's events, if any"]
}
```

- Use only facts that appear in the day file, and keep every number matching it.
- Keep the tone calm and clear, with no hype and no emojis.

## 6. Recompute, validate, publish
```
python3 scripts/compute.py
python3 scripts/validate.py
git add data && git commit -m "Nightly update DATE" && git push
```

- If `validate.py` fails, fix the data and run it again. Never push data that fails validation.
- GitHub Pages republishes within a few minutes.

## Monthly recap (on the 14th of each month)
Add `data/summaries/recap-wN.json` for the month just ended:
- `window`
- `title` (max 10 words)
- `body` (180-260 words)

`scripts/compute.py` picks it up automatically, and the History tab lists it.
