# Endgame Index: analytics tracking plan

Two tools, both loaded only after the page has shown (see `assets/js/analytics.js`):

- **PostHog** (US cloud): visits, pages and the events below. No cookies (localStorage), anonymous visitors only (`person_profiles: "identified_only"`), Do Not Track is respected, and tracking is off on localhost. Autocapture and heatmaps are on, so every click is also recorded generically; the named events below exist for clean analysis.
- **Cloudflare Web Analytics**: traffic and Core Web Vitals. Since the move to real page URLs (21 Nov 2026) it reports each page (`/day/2026-11-20/`, `/endings/conquerors/` …) instead of only `/`.

Every event goes through `T(name, props)` in `app.js` (or `send()` in `analytics.js`). Change event names only together with this file.

## Properties on every event

| Property | Values | Set |
|---|---|---|
| `app` | `endgame-index` | every load |
| `screen` | `phone` / `desktop` | every load |
| `entry_source_type` | `ai_assistant` (ChatGPT, Perplexity, Claude, Gemini, Copilot, …), `search` (Google, Bing, DuckDuckGo, …), `social` (LinkedIn, X, Reddit, Hacker News, Medium, …), `other`, `direct` | per visit; kept across page loads within the visit |
| `entry_source` | referrer domain or `utm_source`, e.g. `chatgpt.com`, `linkedin`, `direct` | per visit |
| `entry_campaign` | `utm_campaign`, if present | per visit |
| `landing_path` | first page of the visit, e.g. `/day/2026-11-20/` | per visit |
| `landing_legacy_hash` | `true` when the visit started from an old `#/…` link | per visit |
| `first_source_type`, `first_source`, `first_landing_path` | the same, for the visitor's very first visit (never overwritten) | once per browser |

Tip for links you share: add `?utm_source=linkedin&utm_campaign=<post-name>` to see which post brought readers.

## Events

| Event | When | Properties |
|---|---|---|
| `site_entry` | First page load of a visit (not repeated for page loads inside the visit) | the entry properties above |
| `$pageview` | Every page or tab change (sent manually, the app has no full reloads between tabs) | `$current_url`, `tab`, `date` (day pages), `ending` (ending links) |
| `page_viewed` | Same moments as `$pageview`, easier to filter | `page` (`dashboard`, `summary`, `endings`, `history`, `scoring`, `about`, `not_found`), `date`, `ending`, `path` (static pages), `from` (previous tab or `entry`) |
| `summary_events_seen` | A reader scrolled a day page far enough to see its events list (read depth) | `date`, `events` (count), `is_latest` |
| `summary_day_nav` | Previous / next / latest buttons on a day page | `dir` |
| `source_click` | A news source link on a day page | `host` |
| `ending_open` | An ending's detail panel opens | `ending`, `from` (`dashboard`, `summary`, `endings`, `direct_link`) |
| `endings_open` | An ending chosen on the 12 Endings page | `ending`, `place` (`map`, `tree`, `card`) |
| `endings_family_chip` | A family filter on the 12 Endings page | `family` |
| `definition_view` | An ending's definition shown from the chart | `ending`, `place`, `mode` |
| `chart_viewed` | The home chart stayed on screen for 5 seconds | `seconds`, `range`, `mode`, `ms_since_load` |
| `chart_filter` | Range (30D/90D/All) or view (families/endings) changed | `kind`, `value`, `place` |
| `chart_day_open` | A day opened from a chart | `date`, `range`, `mode`, `place` |
| `chart_day_tap` | First tap on a day in the phone chart | `date`, `range`, `mode`, `place` |
| `chart_expand` | Phone chart opened full-screen | `via`, `mode` |
| `legend_focus` | An ending highlighted from the chart legend | `ending`, `mode`, `place` |
| `ticker_click` | A headline in the home ticker | `date` |
| `data_download` | The CSV or JSON data link | `format` (`csv`, `json`), `place` (`footer`, `page_text`, `app`), `page` |
| `footer_click` | Any footer link | `target` (`about`, `scoring`, `licence`, `author`) |
| `outbound_click` | Any other link to another site (not news sources or the byline) | `host`, `place`, `page` |
| `byline_click` | "By Sidhartha Rajput" links | `place` |
| `menu_open` | Phone menu opened | none |
| `theme_toggle` | Light/dark switch | `to` |
| `layout_shift` | The page visibly jumped (max 3 per load), to find and fix layout bugs | `value`, `window_total`, `sources`, `page`, `viewport`, … |

## Useful PostHog views

- **Where readers come from:** `site_entry` broken down by `entry_source_type`, then `entry_source`. AI-assistant visits are the direct measure of the SEO/AI-visibility work.
- **What they read:** `page_viewed` by `page`; `summary_events_seen` ÷ `page_viewed` (page = summary) is the share of day-page readers who read past the summary.
- **Data reuse:** `data_download` by `format` and `place`.
- **Old links still in use:** `site_entry` where `landing_legacy_hash` = true.
