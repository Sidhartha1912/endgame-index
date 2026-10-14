# Endgame Index — data folder

| Path | What it holds |
|---|---|
| `events/YYYY-MM-DD.json` | Rated news events for that day: factors, tier, credibility, reason, sources. **This is the only input that changes each night.** |
| `summaries/YYYY-MM-DD.json` | The written Summary of the Day: headline, body, movers note, coming up |
| `summaries/recap-w1.json` … `recap-w6.json` | Monthly recaps for the six-month backfill (14 Apr – 13 Oct 2026) |
| `days/YYYY-MM-DD.json` | Full computed record for each day: scores, changes, World Factors, Horizon Balance, families, badges, and every event with its contribution to each ending. **Generated — do not edit by hand.** |
| `history.json` | Compact time series for the dashboard chart. **Generated.** |

Regenerate everything with:

```
python3 scripts/compute.py
```

The engine recomputes the whole history from `scoring/rules.json` + `events/` + `summaries/`, so the same inputs always give the same numbers.

**Backfill note:** the six-month history (409 events across 143 days) was researched after the fact from news archives. It is sparser than a live nightly run, which targets 8–25 events a day. As a result, about 80 days carry a Quiet Day badge.
