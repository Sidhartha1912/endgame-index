#!/usr/bin/env python3
"""Endgame Index: build the pre-rendered pages and crawl files.

Run nightly after compute.py. Writes plain HTML that reads fully without JavaScript
(search engines and AI crawlers read this; the app then loads on top and shows the
same content interactively):

  index.html                  home: today's reading, all 12 scores, recent days
  day/index.html              latest summary
  day/YYYY-MM-DD/index.html   one page per day
  endings/index.html          the 12 endings
  endings/<slug>/index.html   one page per ending
  history/index.html          monthly recaps + every day
  scoring/index.html          the method
  about/index.html            what this is, who makes it, data and licence
  404.html
  data/endgame-index-daily.csv   open data (CC BY 4.0)
  og/YYYY-MM-DD.png           1200x630 share image per day (needs Pillow; skipped if missing)
  sitemap.xml, robots.txt, llms.txt

Usage: python3 scripts/build_pages.py [--redraw-images]
Text comes only from the data files; nothing here invents facts.
"""
import csv, datetime as dt, glob, html, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
SITE = "https://endgameindex.com"
AUTHOR = {"@type": "Person", "@id": SITE + "/#author", "name": "Sidhartha Rajput",
          "url": "https://www.linkedin.com/in/sidhartha-rajput/", "sameAs": ["https://www.linkedin.com/in/sidhartha-rajput/"]}
LICENSE = "https://creativecommons.org/licenses/by/4.0/"
BOOK = {"@type": "Book", "name": "Life 3.0: Being Human in the Age of Artificial Intelligence",
        "author": {"@type": "Person", "name": "Max Tegmark"}, "datePublished": "2017"}
FAMILY_ORDER = ["flourishing", "contained", "successors", "stalled"]
CATS = {"labs": "Labs & Models", "safety": "Safety & Alignment", "policy": "Policy & Treaties", "military": "Military & Security",
        "surveillance": "Surveillance & Rights", "economy": "Jobs & Economy", "merge": "Brain-Tech & AI Personhood", "society": "Society & Public Mood"}
TIER = {"T1": "small step", "T2": "clear step", "T3": "major shift", "T4": "landmark"}
CRED = {"A": "primary source", "B": "major outlet", "C": "trade press", "D": "blog or opinion", "E": "unverified"}
BADGES = {"landmark_day": "Landmark day", "speed_limit": "Speed limit", "breakout": "Breakout", "new_leader": "New leader",
          "crossover": "Crossover", "quiet_day": "Quiet day"}

e = lambda s: html.escape(str(s), quote=True)
load = lambda *a: json.load(open(P(*a), encoding="utf-8"))
slug = lambda k: k.replace("_", "-")


def fmt_date(d, weekday=False):
    x = dt.date.fromisoformat(d)
    return (x.strftime("%A, ") if weekday else "") + f"{x.day} {x.strftime('%B %Y')}"


def short_date(d):
    x = dt.date.fromisoformat(d)
    return f"{x.day} {x.strftime('%b')}"


def signed(v, dp=1):
    if abs(v) < 0.5 * 10 ** -dp:
        return f"{0:.{dp}f}"
    return f"{v:+.{dp}f}".replace("-", "−")


def clip(text, n=155):
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= n:
        return text
    cut = text[:n - 1]
    cut = cut[: cut.rfind(" ")] if " " in cut else cut
    return cut.rstrip(",;:") + "…"


def host(u):
    m = re.match(r"https?://(?:www\.)?([^/]+)", u or "")
    return m.group(1) if m else "source"


def write(rel, text):
    path = P(rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
    if old != text:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>"


class Site:
    def __init__(self):
        self.R = load("scoring", "rules.json")
        self.H = load("data", "history.json")
        self.C = load("data", "content.json")
        self.SC = self.R["scenarios"]
        self.F = self.R["factors"]
        self.dates = self.H["dates"]
        self.end = self.H["end"]
        self.n = len(self.dates)
        self.shell = open(P("templates", "shell.html"), encoding="utf-8").read()
        self.boot = open(P("templates", "home-boot.html"), encoding="utf-8").read()
        self.days = {}
        self.pages = []  # (path, lastmod, priority)

    # ---------- data helpers ----------
    def day(self, d):
        if d not in self.days:
            self.days[d] = load("data", "days", d + ".json")
        return self.days[d]

    def score(self, k, i):
        return self.H["scores"][k][max(0, min(self.n - 1, i))]

    def fam_name(self, f):
        return self.H["families_meta"][f]["name"]

    def ending_link(self, k):
        return f'<a href="/endings/{slug(k)}/">{e(self.SC[k]["name"])}</a>'

    def leader_family(self, i):
        return max(FAMILY_ORDER, key=lambda f: self.H["families"][f][i])

    # ---------- page assembly ----------
    def page(self, path, title, desc, view, ld=None, og_image=None, og_type="website", lastmod=None, priority="0.5",
             updated=None, index=True, canonical=None):
        canon = SITE + (canonical or path)
        img = og_image or f"{SITE}/og/{self.end}.png"
        head = [f"<title>{e(title)}</title>",
                '<meta name="theme-color" content="#fdfdf9">',
                f'<meta name="description" content="{e(desc)}">',
                f'<link rel="canonical" href="{e(canon)}">' if index else '<meta name="robots" content="noindex">',
                '<meta name="author" content="Sidhartha Rajput">',
                f'<meta property="og:site_name" content="Endgame Index">',
                f'<meta property="og:title" content="{e(title)}">',
                f'<meta property="og:description" content="{e(desc)}">',
                f'<meta property="og:type" content="{og_type}">',
                f'<meta property="og:url" content="{e(canon)}">',
                f'<meta property="og:image" content="{e(img)}">',
                '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
                f'<meta property="og:image:alt" content="{e(title)}">',
                '<meta name="twitter:card" content="summary_large_image">',
                f'<meta name="twitter:title" content="{e(title)}">',
                f'<meta name="twitter:description" content="{e(desc)}">',
                f'<meta name="twitter:image" content="{e(img)}">',
                '<link rel="alternate" type="text/csv" title="Endgame Index daily data (CSV)" href="/data/endgame-index-daily.csv">']
        for obj in (ld or []):
            head.append(jsonld(obj))
        out = self.shell.replace("<!--HEAD-->", "\n".join(head)).replace("<!--VIEW-->", view)
        out = out.replace("<!--UPDATED-->", e(short_date(updated or self.end)))
        rel = "404.html" if path == "/404.html" else (path.strip("/") + "/index.html" if path != "/" else "index.html")
        write(rel, out)
        if index and not canonical:
            self.pages.append((path, lastmod or self.end, priority))

    def crumbs(self, items):
        """items: [(name, path or None)] -> visible breadcrumb + BreadcrumbList"""
        vis = '<nav class="crumbs" aria-label="Breadcrumb">' + " <span aria-hidden=\"true\">›</span> ".join(
            f'<a href="{p}">{e(n)}</a>' if p else f'<span aria-current="page">{e(n)}</span>' for n, p in items) + "</nav>"
        ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, **({"item": SITE + p} if p else {})} for i, (n, p) in enumerate(items)]}
        return vis, ld

    def score_table(self, i, caption=None, with30=True):
        rows = sorted(self.SC, key=lambda k: -self.score(k, i))
        head = '<table><thead><tr><th>Ending</th><th>Family</th><th class="n">Score</th><th class="n">Day</th>' + \
               ('<th class="n">30 days</th>' if with30 else "") + "</tr></thead><tbody>"
        body = "".join(
            f'<tr><td>{self.ending_link(k)}</td><td>{e(self.fam_name(self.SC[k]["family"]))}</td>'
            f'<td class="n">{self.score(k, i):.1f}</td><td class="n">{signed(self.score(k, i) - self.score(k, i - 1)) if i else "0.0"}</td>'
            + (f'<td class="n">{signed(self.score(k, i) - self.score(k, i - 30))}</td>' if with30 else "") + "</tr>" for k in rows)
        cap = f"<caption class=\"meta\" style=\"text-align:left;caption-side:bottom;padding-top:8px\">{e(caption)}</caption>" if caption else ""
        return head + body + "</tbody>" + cap + "</table>"

    # ---------- pages ----------
    def build_home(self):
        i = self.n - 1
        d = self.day(self.end)
        sm = d.get("summary") or {}
        bal, balp = self.H["balance"][i], self.H["balance"][i - 1]
        lf = self.leader_family(i)
        top = max(self.SC, key=lambda k: self.score(k, i))
        recent = [x for x in range(i, max(-1, i - 8), -1) if self.H["headlines"][x]]
        view = self.boot + f'''
    <section class="wrap static-page home-static" aria-labelledby="today-h">
      <p class="kicker">Today’s reading · updated {e(fmt_date(self.end, True))}</p>
      <h2 id="today-h" style="margin-top:0"><a href="/day/{self.end}/">{e(sm.get("headline", "Summary of the day"))}</a></h2>
      <div class="prose"><p>{e(sm.get("body", ""))}</p></div>
      <p class="meta" style="margin-top:14px">Horizon Balance {signed(bal, 2)} (yesterday {signed(balp, 2)}) · leading family: {e(self.fam_name(lf))} · highest ending: {e(self.SC[top]["name"])} · <a href="/day/{self.end}/">Read the full day ›</a></p>
      <h2>All 12 endings on {e(fmt_date(self.end))}</h2>
      {self.score_table(i, "Plausibility index from 1 to 99 per ending; it is not a probability, and the 12 scores do not add up to 100.")}
      <h2>What is the Endgame Index?</h2>
      <div class="prose"><p>The Endgame Index reads each day’s AI news and scores how strongly it points toward each of the 12 long-term futures for humanity and AI described by MIT physicist Max Tegmark in his 2017 book <i>Life 3.0</i>, from <a href="/endings/libertarian-utopia/">Libertarian Utopia</a> to <a href="/endings/self-destruction/">Self-Destruction</a>. Every event is rated with a published rubric and linked to its sources, and the scores are recomputed every night at 11:59 PM IST. <a href="/scoring/">How it’s scored</a> · <a href="/about/">About</a> · <a href="/data/endgame-index-daily.csv" download>Download the data</a>.</p></div>
      <h2>Recent days</h2>
      <ul class="plain">{"".join(f'<li><a href="/day/{self.dates[x]}/">{e(fmt_date(self.dates[x]))}: {e(self.H["headlines"][x])}</a></li>' for x in recent)}</ul>
    </section>'''
        site_ld = {"@context": "https://schema.org", "@graph": [
            {"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": "Endgame Index", "inLanguage": "en",
             "description": "A nightly, evidence-weighted reading of AI news against Max Tegmark's 12 possible endings for humanity and AI.",
             "publisher": {"@id": SITE + "/#author"}},
            AUTHOR,
            self.dataset_ld()]}
        self.page("/", "Endgame Index: daily tracker of AI's 12 possible futures",
                  clip(f"Which of AI's 12 possible endings did today's news move closer? Today ({fmt_date(self.end)}): {sm.get('headline', '')}. "
                       "Scores for all 12 of Max Tegmark's scenarios, updated nightly."),
                  view, ld=[site_ld], priority="1.0")

    def dataset_ld(self):
        return {"@type": "Dataset", "@id": SITE + "/#dataset", "name": "Endgame Index daily scores",
                "description": "Daily plausibility scores (1-99) for each of the 12 AI aftermath scenarios in Max Tegmark's book Life 3.0, "
                               "the 10 world factors behind them, family averages and the Horizon Balance, computed every night from rated AI news events "
                               "with a published, versioned rulebook.",
                "url": SITE + "/", "sameAs": SITE + "/about/", "creator": {"@id": SITE + "/#author"}, "license": LICENSE,
                "isAccessibleForFree": True, "inLanguage": "en", "isBasedOn": BOOK,
                "temporalCoverage": f"{self.H['start']}/{self.end}", "dateModified": self.end,
                "keywords": ["artificial intelligence", "AI risk", "AI futures", "Max Tegmark", "Life 3.0", "superintelligence", "AI governance"],
                "variableMeasured": [v["name"] for v in self.SC.values()] + [v["name"] for v in self.F.values()] + ["Horizon Balance"],
                "measurementTechnique": f"Rated news events scored with Endgame Index rules v{self.R['version']}",
                "distribution": [
                    {"@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": SITE + "/data/endgame-index-daily.csv"},
                    {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": SITE + "/data/history.json"}]}

    def build_day(self, i, alias=False):
        dte = self.dates[i]
        d = self.day(dte)
        sm = d.get("summary") or {}
        headline = sm.get("headline") or f"Summary of {fmt_date(dte)}"
        prev = self.dates[i - 1] if i > 0 else None
        nxt = self.dates[i + 1] if i < self.n - 1 else None
        bal, balp = self.H["balance"][i], (self.H["balance"][i - 1] if i else self.H["balance"][i])
        lf = self.leader_family(i)
        path = "/day/" if alias else f"/day/{dte}/"
        vis, bc = self.crumbs([("Home", "/"), ("Summary of the day", "/day/"), (fmt_date(dte), None)])
        evs = []
        for ev in d.get("events", []):
            facs = ", ".join(f'{e(self.F[f["id"]]["name"])} {"↑" if f["dir"] > 0 else "↓"}' for f in ev.get("factors", []) if f["id"] in self.F)
            srcs = "".join(f'<a href="{e(u)}" rel="noopener nofollow" target="_blank">{e(host(u))} ↗</a>' for u in ev.get("sources", []) if str(u).startswith("http"))
            evs.append(f'''<li><h3>{e(ev["title"])}</h3><p>{e(ev.get("summary", ""))}</p>
          <p class="meta">{e(CATS.get(ev.get("category"), ev.get("category", "")))} · {e(ev["tier"])} {e(TIER.get(ev["tier"], ""))} · source grade {e(ev["credibility"])} ({e(CRED.get(ev["credibility"], ""))}){" · self-reported" if ev.get("self_claim") else ""} · {e(ev.get("track", ""))} · moves {facs}</p>
          <p class="meta">{srcs}</p></li>''')
        badges = ", ".join(BADGES.get(b, b) for b in d.get("badges", []))
        coming = sm.get("coming_up") or []
        pager = '<nav class="pager" aria-label="Days">' + (f'<a href="/day/{prev}/" rel="prev">‹ {e(fmt_date(prev))}</a>' if prev else "") + \
                (f'<a href="/day/{nxt}/" rel="next">{e(fmt_date(nxt))} ›</a>' if nxt else "") + \
                (f'<a href="/day/{self.end}/">Latest day</a>' if dte != self.end else "") + '<a href="/history/">All days</a></nav>'
        view = f'''
    <article class="wrap static-page">
      {vis}
      <p class="kicker">Summary of the day · {e(fmt_date(dte, True))}</p>
      <h1>{e(headline)}</h1>
      <div class="prose"><p>{e(sm.get("body", ""))}</p>
        {f'<p class="movers"><b>Biggest movers.</b> {e(sm["movers_note"])}</p>' if sm.get("movers_note") else ""}</div>
      <p class="meta" style="margin-top:16px">Horizon Balance {signed(bal, 2)} (previous day {signed(balp, 2)}) · leading family: {e(self.fam_name(lf))} · {len(d.get("events", []))} events scored{(" · " + e(badges)) if badges else ""} · rules v{e(d.get("rules_version", self.R["version"]))}</p>
      <h2>Scores on {e(fmt_date(dte))}</h2>
      {self.score_table(i, with30=False)}
      <h2>{"Events scored" if evs else "No events scored"}</h2>
      {('<ol class="evs">' + "".join(evs) + "</ol>") if evs else '<p class="prose">No news met the bar for scoring on this day; scores moved only as earlier stories faded.</p>'}
      {('<h2>Coming up</h2><ul class="plain">' + "".join(f"<li>{e(c)}</li>" for c in coming) + "</ul>") if coming else ""}
      <p class="meta" style="margin-top:30px">Scores are a 1–99 plausibility index, not probabilities. <a href="/scoring/">How the index is scored</a>.</p>
      {pager}
    </article>'''
        img = f"{SITE}/og/{dte}.png"
        art = {"@context": "https://schema.org", "@type": "Article", "headline": headline[:110],
               "description": clip(sm.get("body", ""), 300), "datePublished": f"{dte}T23:59:00+05:30",
               "dateModified": f"{dte}T23:59:00+05:30", "author": AUTHOR, "publisher": AUTHOR, "image": img,
               "mainEntityOfPage": SITE + f"/day/{dte}/", "inLanguage": "en", "isPartOf": {"@id": SITE + "/#website"},
               "about": [{"@type": "Thing", "name": "AI aftermath scenarios"}, BOOK],
               "citation": [u for ev in d.get("events", []) for u in ev.get("sources", []) if str(u).startswith("http")][:20]}
        title = f"{headline} · Endgame Index" if not alias else "Summary of the day · Endgame Index"
        self.page(path, title, clip(sm.get("body", "")), view, ld=[art, bc], og_image=img, og_type="article",
                  lastmod=dte if not alias else self.end, priority="0.8" if dte == self.end else "0.6", updated=self.end,
                  canonical=f"/day/{dte}/" if alias else None)

    def recent_pushes(self, k, days=30, top=8):
        out = []
        for d in self.dates[-days:]:
            for ev in self.day(d).get("events", []):
                v = (ev.get("contribution") or {}).get(k)
                if v:
                    out.append((abs(v), d, ev["title"], v))
        out.sort(reverse=True)
        return out[:top]

    def build_endings(self):
        i = self.n - 1
        CE = self.C["endings"]
        order = sorted(self.SC, key=lambda k: CE[k]["num"])
        rank = {k: r + 1 for r, k in enumerate(sorted(self.SC, key=lambda k: -self.score(k, i)))}
        start = self.H["start"]
        for k in order:
            s, c = self.SC[k], CE[k]
            fam = s["family"]
            vis, bc = self.crumbs([("Home", "/"), ("The 12 endings", "/endings/"), (s["name"], None)])
            recipe = "".join(
                f'<li><b>{e(self.F[f]["name"])}</b> {"higher" if w > 0 else "lower"} (weight {abs(w):.2f}): '
                f'{e(self.F[f]["high"] if w > 0 else self.F[f]["low"])}</li>' for f, w in sorted(s["weights"].items(), key=lambda x: -abs(x[1])))
            pushes = "".join(f'<li><a href="/day/{d}/">{e(fmt_date(d))}</a>: {e(t)} ({signed(v, 2)})</li>' for _, d, t, v in self.recent_pushes(k))
            idx = order.index(k)
            prev_k, next_k = order[idx - 1], order[(idx + 1) % 12]
            view = f'''
    <article class="wrap static-page">
      {vis}
      <p class="kicker">Ending {c["num"]} of 12 · {e(self.fam_name(fam))}: {e(self.C["families"][fam]["tagline"])}</p>
      <h1>{e(s["name"])}</h1>
      <div class="prose"><p><b>{e(c["short"])}</b> {e(c["desc"])}</p>
        <p>What it looks like: {e(c["looks"])}</p></div>
      <h2>Where it stands on {e(fmt_date(self.end))}</h2>
      <dl>
        <dt>Score</dt><dd class="mono">{self.score(k, i):.1f} of 99 (rank {rank[k]} of 12)</dd>
        <dt>Last 7 days</dt><dd class="mono">{signed(self.score(k, i) - self.score(k, i - 7))}</dd>
        <dt>Last 30 days</dt><dd class="mono">{signed(self.score(k, i) - self.score(k, i - 30))}</dd>
        <dt>Since {e(fmt_date(start))}</dt><dd class="mono">{signed(self.score(k, i) - self.score(k, 0))} (started at {self.score(k, 0):.1f})</dd>
      </dl>
      <h2>What moves it</h2>
      <div class="prose"><p>It rises when {e(c["rises"])} It falls when {e(c["falls"])}</p></div>
      <p class="meta" style="margin-top:14px">Its score follows these world factors:</p>
      <ul class="plain">{recipe}</ul>
      <h2>Biggest pushes in the last 30 days</h2>
      {('<ul class="plain">' + pushes + "</ul>") if pushes else '<p class="prose">No single event moved it noticeably in the last 30 days.</p>'}
      <p class="meta" style="margin-top:30px">The 12 scenarios come from Max Tegmark’s <i>Life 3.0</i> (2017); the descriptions here are our own short summaries. Scores are a 1–99 plausibility index, not probabilities. <a href="/scoring/">How it’s scored</a>.</p>
      <nav class="pager" aria-label="Endings"><a href="/endings/{slug(prev_k)}/">‹ {e(self.SC[prev_k]["name"])}</a><a href="/endings/{slug(next_k)}/">{e(self.SC[next_k]["name"])} ›</a><a href="/endings/">All 12 endings</a></nav>
    </article>'''
            ld = {"@context": "https://schema.org", "@type": "WebPage", "name": f"{s['name']}: {c['short']}",
                  "url": SITE + f"/endings/{slug(k)}/", "isPartOf": {"@id": SITE + "/#website"}, "dateModified": self.end,
                  "about": {"@type": "Thing", "name": f"{s['name']} (AI aftermath scenario)", "description": c["desc"]}, "isBasedOn": BOOK}
            self.page(f"/endings/{slug(k)}/", f"{s['name']}: {c['short'].rstrip('.')} · Endgame Index"[:95],
                      clip(f"{s['name']}, one of Max Tegmark's 12 AI futures: {c['desc']} Today's score: {self.score(k, i):.1f}."),
                      view, ld=[ld, bc], priority="0.7")
        # index
        vis, bc = self.crumbs([("Home", "/"), ("The 12 endings", None)])
        blocks = []
        for fam in FAMILY_ORDER:
            ks = [k for k in order if self.SC[k]["family"] == fam]
            items = "".join(f'<li>{self.ending_link(k)}: {e(CE[k]["short"])} <span class="mono">({self.score(k, i):.1f})</span></li>' for k in ks)
            blocks.append(f'<h2>{e(self.fam_name(fam))}: {e(self.C["families"][fam]["tagline"])}</h2><ul class="plain">{items}</ul>')
        view = f'''
    <article class="wrap static-page">
      {vis}
      <h1>The 12 endings</h1>
      <div class="prose"><p>In <i>Life 3.0</i> (2017), MIT physicist Max Tegmark described 12 ways the story of humans and superintelligent AI could end, from paradise to extinction. The Endgame Index groups them into four families and scores each one daily from the news. Scores shown are for {e(fmt_date(self.end))}.</p></div>
      {"".join(blocks)}
    </article>'''
        ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "The 12 endings", "url": SITE + "/endings/",
              "isPartOf": {"@id": SITE + "/#website"}, "isBasedOn": BOOK,
              "hasPart": [{"@type": "WebPage", "name": self.SC[k]["name"], "url": SITE + f"/endings/{slug(k)}/"} for k in order]}
        self.page("/endings/", "Max Tegmark's 12 AI endings, scored daily · Endgame Index",
                  "All 12 of Max Tegmark's Life 3.0 scenarios for humanity and AI, from Libertarian Utopia to Self-Destruction, with today's score for each.",
                  view, ld=[ld, bc], priority="0.8")

    def build_history(self):
        vis, bc = self.crumbs([("Home", "/"), ("History", None)])
        recs = []
        for path in reversed(self.H.get("recaps", [])):
            try:
                r = load(*path.split("/"))
            except Exception:
                continue
            a, b = r["window"].split(" to ")
            recs.append(f'<h3 style="margin-top:26px">{e(r["title"])}</h3><p class="meta">{e(fmt_date(a))} to {e(fmt_date(b))}</p>'
                        f'<div class="prose" style="margin-top:8px"><p>{e(r["body"])}</p></div>')
        rows = "".join(f'<tr><td class="mono"><a href="/day/{d}/">{e(d)}</a></td><td>{e(self.H["headlines"][x])}</td><td class="n">{signed(self.H["balance"][x], 2)}</td></tr>'
                       for x, d in reversed(list(enumerate(self.dates))))
        view = f'''
    <article class="wrap static-page">
      {vis}
      <h1>History</h1>
      <div class="prose"><p>Every day since {e(fmt_date(self.H["start"]))}, with monthly recaps. The Horizon Balance runs from −100 (dark endings far ahead) to +100 (bright endings far ahead).</p></div>
      <h2>Monthly recaps</h2>
      {"".join(recs)}
      <h2>Every day</h2>
      <table><thead><tr><th>Date</th><th>Headline</th><th class="n">Horizon Balance</th></tr></thead><tbody>{rows}</tbody></table>
    </article>'''
        self.page("/history/", "History of the Endgame Index · every day since April 2026",
                  "Every daily reading of the Endgame Index since 14 April 2026, with monthly recaps of how AI news moved Max Tegmark's 12 endings.",
                  view, ld=[bc], priority="0.6")

    def build_scoring(self):
        R = self.R
        vis, bc = self.crumbs([("Home", "/"), ("Scoring mechanism", None)])
        factors = "".join(f'<dt>{e(f["name"])}</dt><dd>{e(self.C["factor_questions"].get(k, "")).capitalize()} 0 = {e(f["low"])}; 100 = {e(f["high"])}.</dd>' for k, f in self.F.items())
        recipes = "".join(
            f'<tr><td>{self.ending_link(k)}</td><td>{", ".join(f"{e(self.F[f]["name"])} {"+" if w > 0 else "−"}{abs(w):.2f}" for f, w in sorted(s["weights"].items(), key=lambda x: -abs(x[1])))}</td></tr>'
            for k, s in sorted(self.SC.items(), key=lambda x: self.C["endings"][x[0]]["num"]))
        ER, D = R["event_rating"], R["dynamics"]
        faq = "".join(f'<h3 style="margin-top:22px">{e(q["q"])}</h3><div class="prose" style="margin-top:6px"><p>{e(q["a"])}</p></div>' for q in self.C["faq"])
        view = f'''
    <article class="wrap static-page">
      {vis}
      <h1>How the Endgame Index is scored</h1>
      <div class="prose"><p>Each night the day’s AI news is gathered, merged into distinct events and rated with a published rubric. Each event moves one or two of ten world factors. Each of the 12 endings is a fixed recipe of those factors, so when the factors move, the endings follow. All the arithmetic is fixed code (rules v{e(R["version"])}); the full rulebook is in <a href="/scoring/SCORING_RULES.md">SCORING_RULES.md</a> and <a href="/scoring/rules.json">rules.json</a>.</p></div>
      <h2>The ten world factors</h2>
      <dl>{factors}</dl>
      <h2>How an event is rated</h2>
      <div class="prose"><p>Points = tier × source credibility × novelty × scope. Tiers: T1 small step ({ER["impact_points"]["T1"]}), T2 clear step ({ER["impact_points"]["T2"]}), T3 major shift ({ER["impact_points"]["T3"]}), T4 landmark ({ER["impact_points"]["T4"]}). Credibility: A primary source ×{ER["credibility"]["A"]}, B major outlet ×{ER["credibility"]["B"]}, C trade press ×{ER["credibility"]["C"]}, D blogs ×{ER["credibility"]["D"]}; rumours score zero. A company praising its own results counts ×{ER["self_claim_multiplier"]}. Follow-ups count ×{ER["novelty"]["development"]}. National news ×{ER["scope"]["national"]}, local ×{ER["scope"]["local"]}. A second factor gets {int(ER["secondary_factor_share"] * 100)}% of the points.</p>
        <p>On a day with more than {D.get("volume_reference_events", "several")} events, every event’s points are scaled so the day counts as {D.get("volume_reference_events", "that many")} events, and a smoothing curve caps each factor’s daily move near ±{D["daily_saturation_S"]:g}. Announcements fade with a {D["signal_half_life_days"]}-day half-life; things that actually happened fade with a {D.get("structural_half_life_days") or "very long"}-day half-life; Capability Velocity measures pace, so its effects halve every {D.get("rate_factor_half_life_days", "few")} days.</p>
        <p>Each ending’s target = its starting level + {D["amplifier_k"]:g} × the change in its factor recipe since {e(fmt_date(R["effective_from"]))}. The score shown moves at most {D["scenario_daily_cap"]:g} points a day toward its target and stays between {D["scenario_bounds"][0]} and {D["scenario_bounds"][1]}.</p></div>
      <h2>Each ending’s recipe</h2>
      <table><thead><tr><th>Ending</th><th>Factors and weights</th></tr></thead><tbody>{recipes}</tbody></table>
      <h2>Questions</h2>
      {faq}
    </article>'''
        self.page("/scoring/", "How the Endgame Index is scored · method and rules",
                  "The published method behind the Endgame Index: ten world factors, an event-rating rubric, each ending's recipe, and how scores fade and move.",
                  view, ld=[{"@context": "https://schema.org", "@type": "WebPage", "name": "How the Endgame Index is scored",
                             "url": SITE + "/scoring/", "isPartOf": {"@id": SITE + "/#website"}, "dateModified": self.end}, bc], priority="0.7")

    def build_about(self):
        vis, bc = self.crumbs([("Home", "/"), ("About", None)])
        view = f'''
    <article class="wrap static-page">
      {vis}
      <h1>About the Endgame Index</h1>
      <div class="prose">
        <p>The Endgame Index is a daily reading of where AI news is pointing. It takes the 12 long-term futures for humanity and superintelligent AI that MIT physicist Max Tegmark set out in his 2017 book <i>Life 3.0</i> (see the <a href="https://futureoflife.org/2017/08/28/ai-aftermath-scenarios/" rel="noopener" target="_blank">Future of Life Institute summary</a>) and scores each of them from 1 to 99, every night.</p>
        <p>The scores are a plausibility index, not probabilities or predictions: they show which way the evidence moved, and how strongly. The 12 scores do not add up to 100.</p>
      </div>
      <h2>How it is made</h2>
      <div class="prose"><p>Every night at 11:59 PM India time, the day’s AI news is gathered from primary sources, major outlets and trade press across the US, China, the EU, the UK, India and the Gulf. Claude, Anthropic’s AI model, merges the coverage into distinct events and rates each one with the published rubric, including a sceptical second pass on big events. The arithmetic that turns ratings into scores is fixed code. Every event is shown with its sources on its <a href="/history/">daily page</a>, so anyone can check or disagree with a rating. The method is on the <a href="/scoring/">scoring page</a> (currently rules v{e(self.R["version"])}).</p></div>
      <h2>Who makes it</h2>
      <div class="prose"><p>The Endgame Index is built and run by <a href="https://www.linkedin.com/in/sidhartha-rajput/" rel="author noopener" target="_blank">Sidhartha Rajput</a>. It is an independent project and is not affiliated with MIT, Max Tegmark or the Future of Life Institute.</p></div>
      <h2>Data and licence</h2>
      <div class="prose"><p>All daily scores are free to download as <a href="/data/endgame-index-daily.csv" download>CSV</a> or <a href="/data/history.json">JSON</a>, under the <a href="{LICENSE}" rel="license noopener" target="_blank">Creative Commons Attribution 4.0</a> licence. Please credit “Endgame Index by Sidhartha Rajput” with a link to endgameindex.com. History starts on {e(fmt_date(self.H["start"]))}; the latest reading is {e(fmt_date(self.end))}.</p></div>
      <h2>Limits</h2>
      <ul class="plain"><li>News coverage is uneven: some regions and topics get more reporting than others.</li><li>Ratings are judgements made with a fixed rubric; they can be wrong, and corrections are added as new events rather than rewriting history.</li><li>Tegmark’s scenarios describe possible end states, not timelines; the index tracks direction, not dates.</li></ul>
    </article>'''
        self.page("/about/", "About the Endgame Index · method, author, data",
                  "What the Endgame Index is, how it is made each night, who runs it, and how to use its open daily data (CC BY 4.0).",
                  view, ld=[{"@context": "https://schema.org", "@type": "AboutPage", "name": "About the Endgame Index", "url": SITE + "/about/",
                             "isPartOf": {"@id": SITE + "/#website"}, "author": AUTHOR, "dateModified": self.end}, bc], priority="0.5")

    def build_404(self):
        view = '''
    <article class="wrap static-page">
      <h1>Page not found</h1>
      <div class="prose"><p>This page doesn’t exist. Try <a href="/">today’s reading</a>, <a href="/day/">the latest summary</a> or <a href="/history/">every day so far</a>.</p></div>
    </article>'''
        self.page("/404.html", "Page not found · Endgame Index", "This page does not exist.", view, index=False)

    # ---------- data + crawl files ----------
    def build_csv(self):
        H = self.H
        cols = ["date", "horizon_balance"] + [f"ending_{k}" for k in self.SC] + [f"factor_{k}_{slug(v['name'].lower().replace(' & ', '_').replace(' ', '_'))}" for k, v in self.F.items()] + \
               [f"family_{f}" for f in FAMILY_ORDER] + ["events", "headline"]
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(cols)
        for i, d in enumerate(self.dates):
            w.writerow([d, H["balance"][i]] + [H["scores"][k][i] for k in self.SC] + [H["factors"][k][i] for k in self.F] +
                       [H["families"][f][i] for f in FAMILY_ORDER] + [H["event_counts"][i], H["headlines"][i]])
        write("data/endgame-index-daily.csv", buf.getvalue())

    def build_crawl_files(self):
        urls = "".join(f"  <url><loc>{SITE}{p}</loc><lastmod>{m}</lastmod><priority>{pr}</priority></url>\n" for p, m, pr in self.pages)
        write("sitemap.xml", f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
        write("robots.txt", f"# Endgame Index: everything is public. Search engines and AI crawlers are welcome.\nUser-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n")
        i = self.n - 1
        top3 = sorted(self.SC, key=lambda k: -self.score(k, i))[:3]
        endings = "\n".join(f"- [{self.SC[k]['name']}]({SITE}/endings/{slug(k)}/): {self.C['endings'][k]['short']}"
                            for k in sorted(self.SC, key=lambda k: self.C["endings"][k]["num"]))
        write("llms.txt", f"""# Endgame Index

> A daily, evidence-weighted reading of AI news against the 12 long-term futures for humanity and AI described by MIT physicist Max Tegmark in his 2017 book Life 3.0. Each scenario gets a plausibility score from 1 to 99 (not a probability), recomputed every night at 11:59 PM India time from rated, sourced news events. Built and run by Sidhartha Rajput; independent and not affiliated with MIT, Max Tegmark or the Future of Life Institute.

Latest reading: {fmt_date(self.end)}. Highest endings: {", ".join(f"{self.SC[k]['name']} ({self.score(k, i):.1f})" for k in top3)}. Horizon Balance: {self.H['balance'][i]:+.2f} (from -100, dark endings ahead, to +100, bright endings ahead).

## Key pages
- [Today's reading]({SITE}/): all 12 scores and today's summary
- [Latest summary of the day]({SITE}/day/{self.end}/): what happened in AI news and what moved
- [Every day since {fmt_date(self.H['start'])}]({SITE}/history/): daily pages and monthly recaps
- [How it is scored]({SITE}/scoring/): factors, rubric, recipes and rules (v{self.R['version']})
- [About]({SITE}/about/): method, author, limits

## The 12 endings
{endings}

## Data
- [Daily scores, CSV]({SITE}/data/endgame-index-daily.csv): CC BY 4.0, credit "Endgame Index by Sidhartha Rajput"
- [Daily scores, JSON]({SITE}/data/history.json)
- Per-day records with every rated event and its sources: {SITE}/data/days/YYYY-MM-DD.json
""")

    # ---------- share images ----------
    def build_images(self, redraw=False):
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            print("build_pages: Pillow not installed, share images skipped")
            return 0
        fdir = P("scripts", "fonts")
        serif = lambda s: ImageFont.truetype(os.path.join(fdir, "instrument-serif.ttf"), s)
        serif_i = lambda s: ImageFont.truetype(os.path.join(fdir, "instrument-serif-italic.ttf"), s)
        sans = lambda s: ImageFont.truetype(os.path.join(fdir, "geist.ttf"), s)
        mono = lambda s: ImageFont.truetype(os.path.join(fdir, "geist-mono.ttf"), s)
        BG, INK, INK2, INK3, LINE = "#fdfdf9", "#1d1d1f", "#45433f", "#6b6b68", "#dfe2dc"
        FAM = {"flourishing": "#2a9d78", "contained": "#3b70b8", "successors": "#c2423f", "stalled": "#cf960f"}
        os.makedirs(P("og"), exist_ok=True)
        made = 0
        for i, d in enumerate(self.dates):
            out = P("og", f"{d}.png")
            if os.path.exists(out) and not redraw and d != self.end:
                continue
            sm = (self.day(d).get("summary") or {})
            im = Image.new("RGB", (1200, 630), BG)
            dr = ImageDraw.Draw(im)
            # header
            dr.text((64, 52), "Endgame", font=sans(30), fill=INK)
            dr.text((64 + dr.textlength("Endgame ", font=sans(30)), 52), "Index", font=ImageFont.truetype(os.path.join(fdir, "geist.ttf"), 30), fill=INK, stroke_width=1, stroke_fill=INK)
            dl = fmt_date(d, True)
            dr.text((1136 - dr.textlength(dl, font=sans(24)), 58), dl, font=sans(24), fill=INK3)
            # headline (wrap to 2 lines)
            words, lines, cur = (sm.get("headline") or "Summary of the day").split(), [], ""
            f_h = serif(58)
            for w_ in words:
                t = (cur + " " + w_).strip()
                if dr.textlength(t, font=f_h) <= 1072:
                    cur = t
                else:
                    lines.append(cur); cur = w_
            lines.append(cur)
            if len(lines) > 2:
                lines = lines[:2]
                while dr.textlength(lines[1] + "…", font=f_h) > 1072:
                    lines[1] = lines[1].rsplit(" ", 1)[0]
                lines[1] += "…"
            y = 118
            for ln in lines:
                dr.text((64, y), ln, font=f_h, fill=INK); y += 66
            # top movers
            y = max(y + 26, 270)
            dr.line((64, y, 1136, y), fill=LINE, width=2)
            dr.text((64, y + 18), "Biggest moves today", font=sans(22), fill=INK3)
            movers = sorted(self.SC, key=lambda k: -abs(self.score(k, i) - self.score(k, i - 1)) if i else 0)[:3]
            yy = y + 60
            for k in movers:
                v = self.score(k, i) - (self.score(k, i - 1) if i else self.score(k, i))
                dr.rounded_rectangle((64, yy + 10, 80, yy + 26), radius=4, fill=FAM[self.SC[k]["family"]])
                dr.text((98, yy), self.SC[k]["name"], font=sans(32), fill=INK)
                sc = f"{self.score(k, i):.1f}"
                dr.text((800 - dr.textlength(sc, font=mono(30)), yy + 2), sc, font=mono(30), fill=INK2)
                ch = signed(v)
                dr.text((960 - dr.textlength(ch, font=mono(30)), yy + 2), ch, font=mono(30), fill=INK2)
                yy += 52
            # footer
            fy = 556
            dr.line((64, fy - 18, 1136, fy - 18), fill=LINE, width=2)
            bal = self.H["balance"][i]
            dr.text((64, fy), f"Horizon Balance {signed(bal, 1)}", font=sans(24), fill=INK2)
            lf = self.fam_name(self.leader_family(i))
            mid = f"Leading family: {lf}"
            dr.text((440, fy), mid, font=sans(24), fill=INK2)
            url = "endgameindex.com"
            dr.text((1136 - dr.textlength(url, font=serif_i(30)), fy - 4), url, font=serif_i(30), fill=INK)
            im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, "PNG", optimize=True)
            made += 1
        return made

    def run(self, redraw=False):
        self.build_home()
        self.build_day(self.n - 1, alias=True)
        for i in range(self.n):
            self.build_day(i)
        self.build_endings()
        self.build_history()
        self.build_scoring()
        self.build_about()
        self.build_404()
        self.build_csv()
        self.build_crawl_files()
        imgs = self.build_images(redraw)
        print(f"built {len(self.pages)} pages, {imgs} share images, latest {self.end}")


if __name__ == "__main__":
    Site().run(redraw="--redraw-images" in sys.argv)
