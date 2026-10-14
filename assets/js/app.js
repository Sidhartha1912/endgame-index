/* Endgame Index — app (no framework, no build step) */
(function () {
  const { lines, spark, balance, swatchSVG, fmtDate, fmtSigned, esc } = window.EGChart;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $("#view");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const FAMILY_ORDER = ["flourishing", "contained", "successors", "stalled"];
  const DASHES = ["", "7 4", "2 3.5", "11 4 2 4"];
  const BADGES = {
    landmark_day: ["◆", "Landmark day"], speed_limit: ["⏱", "Speed limit"], breakout: ["↗", "Breakout"],
    new_leader: ["♛", "New leader"], crossover: ["⤨", "Crossover"], quiet_day: ["○", "Quiet day"],
  };
  const CATS = { labs: "Labs & Models", safety: "Safety & Alignment", policy: "Policy & Treaties", military: "Military & Security",
    surveillance: "Surveillance & Rights", economy: "Jobs & Economy", merge: "Brain-Tech & AI Personhood", society: "Society & Public Mood" };

  const S = { H: null, R: null, C: null, recaps: null, days: new Map(), charts: [], series: [], famSeries: [] };

  /* ---------------- data ---------------- */
  const getJSON = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  async function boot() {
    const [H, R, C] = await Promise.all([getJSON("data/history.json"), getJSON("scoring/rules.json"), getJSON("data/content.json")]);
    S.H = H; S.R = R; S.C = C;
    // series definitions, grouped by family, dashed within family
    FAMILY_ORDER.forEach((fam) => {
      Object.keys(H.scenarios).filter((k) => H.scenarios[k].family === fam).forEach((k, j) => {
        S.series.push({ key: k, name: H.scenarios[k].name, family: fam, cls: "c-" + fam, dash: DASHES[j % 4], values: H.scores[k] });
      });
      S.famSeries.push({ key: fam, name: H.families_meta[fam].name, family: fam, cls: "c-" + fam, dash: "", values: H.families[fam] });
    });
    $$("[data-rules-version]").forEach((n) => (n.textContent = R.version));
    $("#updated-label").textContent = "updated " + fmtDate(H.end).replace(/ \d{4}$/, "") + " · nightly 11:59 PM IST";
    window.addEventListener("hashchange", route);
    route();
  }
  async function getDay(d) {
    if (!S.days.has(d)) S.days.set(d, getJSON(`data/days/${d}.json`));
    return S.days.get(d);
  }
  async function getRecaps() {
    if (!S.recaps) S.recaps = Promise.all((S.H.recaps || []).map((u) => getJSON(u).catch(() => null))).then((a) => a.filter(Boolean));
    return S.recaps;
  }

  /* ---------------- helpers ---------------- */
  const last = (a) => a[a.length - 1];
  const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");
  const N = () => S.H.dates.length;
  const scoreAt = (k, i) => S.H.scores[k][Math.max(0, Math.min(N() - 1, i))];
  const change = (k, days) => scoreAt(k, N() - 1) - scoreAt(k, N() - 1 - days);
  const dcls = (v) => (v > 0.049 ? "delta-up" : v < -0.049 ? "delta-down" : "delta-flat");
  const dtxt = (v, dp = 1) => (Math.abs(v) < 0.05 && dp === 1 ? "0.0" : fmtSigned(v, dp));
  const weekday = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
  const famName = (f) => S.H.families_meta[f].name;
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
  const badgeHTML = (b) => (BADGES[b] ? `<span class="badge" title="${esc(S.R.badges[b] || "")}"><span aria-hidden="true">${BADGES[b][0]}</span>${BADGES[b][1]}</span>` : "");
  const destroyCharts = () => { S.charts.forEach((c) => c.destroy && c.destroy()); S.charts = []; const t = $("#tooltip"); if (t) t.hidden = true; };

  function countUp(node, to, dp = 1, signed = false) {
    const fmt = (v) => (signed ? fmtSigned(v, dp) : v.toFixed(dp));
    if (reduceMotion.matches) { node.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 1100;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- router ---------------- */
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const tab = ["dashboard", "summary", "history", "scoring", "ending"].includes(parts[0]) ? parts[0] : "dashboard";
    const go = () => {
      destroyCharts();
      $$(".tabs a").forEach((a) => a.toggleAttribute("aria-current", false));
      const active = tab === "ending" ? "dashboard" : tab;
      $(`.tabs a[data-tab="${active}"]`)?.setAttribute("aria-current", "page");
      if (tab === "dashboard" || tab === "ending") renderDashboard();
      else if (tab === "summary") renderSummary(parts[1]);
      else if (tab === "history") renderHistory();
      else if (tab === "scoring") renderScoring();
      document.title = { dashboard: "Endgame Index", ending: "Endgame Index", summary: "Summary of the Day · Endgame Index", history: "History · Endgame Index", scoring: "Scoring Mechanism · Endgame Index" }[tab];
      if (tab === "ending" && parts[1] && S.H.scenarios[parts[1]]) openEnding(parts[1]);
    };
    const prevTab = route.prev; route.prev = tab;
    const changedTab = prevTab && prevTab !== tab && !(prevTab === "dashboard" && tab === "ending") && !(prevTab === "ending" && tab === "dashboard");
    if (changedTab && document.startViewTransition && !reduceMotion.matches) {
      document.startViewTransition(go).finished.finally(() => { window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); });
    } else {
      go();
      if (changedTab) { window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); }
    }
  }

  /* ================= DASHBOARD ================= */
  function renderDashboard() {
    const H = S.H, n = N(), li = n - 1;
    const bal = last(H.balance), bal7 = bal - H.balance[Math.max(0, li - 7)];
    const sorted = S.series.slice().sort((a, b) => last(b.values) - last(a.values));
    const lead = sorted[0];
    const moves7 = S.series.map((s) => ({ s, d: change(s.key, 7) })).sort((a, b) => b.d - a.d);
    const riser = moves7[0], faller = moves7[moves7.length - 1];
    const tickerItems = H.dates.map((d, i) => ({ d, h: H.headlines[i] })).slice(-14).reverse().filter((x) => x.h);

    view.innerHTML = `
    <div class="wrap">
      <section class="hero reveal">
        <div>
          <div class="eyebrow"><span class="num">01</span> the index · as of ${fmtDate(H.end)}</div>
          <h1 style="margin-top:14px">Where is AI<br><em>taking us?</em></h1>
          <p class="lede">Every night at 11:59 PM IST, the Endgame Index reads the day's AI news and scores how strongly it points toward each of <b>12 possible endings</b> for humanity and AI, from utopia to extinction. These are not predictions. They show which way the evidence is leaning.</p>
          <div class="hero-meta">
            <span class="pill">${n} days tracked</span>
            <span class="pill">${H.totals.events} events rated</span>
            <a class="pill" href="#/scoring">rules v${esc(S.R.version)} →</a>
          </div>
        </div>
        <div class="card gauge-card">
          <div class="gauge-top">
            <div><div class="eyebrow">horizon balance</div><div class="gauge-value mono" id="bal-val">0.0</div></div>
            <div class="small muted" style="text-align:right"><span class="${dcls(bal7)} mono">${dtxt(bal7, 2)}</span><br>past 7 days</div>
          </div>
          <div class="gauge-scale" aria-hidden="true"><div class="gauge-needle" id="needle" style="left:50%"></div></div>
          <div class="gauge-ends"><span>darker −100</span><span>0</span><span>+100 brighter</span></div>
          <p class="small muted" style="margin-top:12px">The average of the four hopeful endings minus the average of the four bleak ones. Below zero means the news is pointing more toward the darker futures.</p>
        </div>
      </section>

      <section class="stats reveal" aria-label="Headline numbers">
        <div class="card stat"><div class="label">Leading ending</div><div class="value"><span class="swatch ${lead.cls}"></span>${esc(lead.name)}</div><div class="sub mono">${last(lead.values).toFixed(1)} / 99</div></div>
        <div class="card stat"><div class="label">Biggest 7-day riser</div><div class="value"><span class="swatch ${riser.s.cls}"></span>${esc(riser.s.name)}</div><div class="sub mono ${dcls(riser.d)}">${dtxt(riser.d)}</div></div>
        <div class="card stat"><div class="label">Biggest 7-day faller</div><div class="value"><span class="swatch ${faller.s.cls}"></span>${esc(faller.s.name)}</div><div class="sub mono ${dcls(faller.d)}">${dtxt(faller.d)}</div></div>
        <div class="card stat"><div class="label">Latest update</div><div class="value mono" style="font-size:22px">${fmtDate(H.end)}</div><div class="sub">${H.event_counts[li]} events · evidence ${H.evidence[li]}</div></div>
      </section>
    </div>

    <div class="ticker reveal" id="ticker">
      <span class="ticker-label">latest</span>
      <div class="ticker-viewport"><div class="ticker-track">${[0, 1].map((dup) => tickerItems.map((t) => `<a class="ticker-item" href="#/summary/${t.d}" ${dup ? 'aria-hidden="true" tabindex="-1"' : ""}><span class="d">${fmtDate(t.d).replace(/ \d{4}$/, "")}</span><span>${esc(t.h)}</span></a>`).join("")).join("")}</div></div>
      <button class="ticker-btn" type="button" id="ticker-btn" aria-pressed="false">pause</button>
    </div>

    <div class="wrap">
      <section class="section">
        <div class="section-head">
          <div><div class="eyebrow"><span class="num">02</span> trend lines</div><h2 class="h2" style="margin-top:8px">The twelve endings over time</h2></div>
          <div class="controls">
            <div class="seg" role="group" aria-label="Time range" id="range">
              <button type="button" data-r="30" aria-pressed="false">30D</button><button type="button" data-r="90" aria-pressed="false">90D</button><button type="button" data-r="all" aria-pressed="true">All</button>
            </div>
            <div class="seg" role="group" aria-label="Chart view" id="mode">
              <button type="button" data-m="endings" aria-pressed="true">12 endings</button><button type="button" data-m="families" aria-pressed="false">4 families</button>
            </div>
          </div>
        </div>
        <div class="card chart-card">
          <p class="small muted">Plausibility Index (1–99) per day. Hover or use the arrow keys to read any day. Click a day to open its summary. Click a name below to highlight it. ◆ marks a major event.</p>
          <div class="chart-wrap" id="main-chart"></div>
          <div class="legend" id="legend"></div>
          <details class="disclose"><summary>View as table</summary><div class="table-wrap" id="score-table"></div></details>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">03</span> the twelve endings</div><h2 class="h2" style="margin-top:8px">Today's reading, ending by ending</h2></div><p class="small muted">From Max Tegmark's <cite>Life 3.0</cite>. Select a card for the full story.</p></div>
        <div id="fam-blocks"></div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">04</span> world factors</div><h2 class="h2" style="margin-top:8px">The ten forces underneath</h2></div><p class="small muted">News moves these forces; the forces move the endings. <span style="color:var(--accent)">|</span> marks the level on ${fmtDate(H.start)}.</p></div>
        <div class="card pad"><div class="factors" id="factors"></div></div>
      </section>
    </div>`;

    // gauge
    countUp($("#bal-val"), bal, 1, true);
    requestAnimationFrame(() => ($("#needle").style.left = `${50 + bal / 2}%`));

    // ticker pause
    const tk = $("#ticker"), tb = $("#ticker-btn");
    tb.addEventListener("click", () => { const p = tk.classList.toggle("paused"); tb.setAttribute("aria-pressed", p); tb.textContent = p ? "play" : "pause"; });

    // main chart
    const st = { range: "all", mode: "endings", focus: null, hidden: new Set() };
    const markers = H.key_events.map((k) => ({ i: k.i, label: `${fmtDate(k.date)} — ${k.title}` }));
    let chart;
    const draw = () => {
      if (chart) chart.destroy();
      const start = st.range === "all" ? 0 : Math.max(0, n - Number(st.range));
      const src = st.mode === "endings" ? S.series : S.famSeries;
      const series = src.map((s) => ({ ...s, values: s.values.slice(start) }));
      chart = lines($("#main-chart"), {
        dates: H.dates.slice(start), series, focus: st.focus, hidden: [...st.hidden],
        headlines: H.headlines.slice(start), markers: markers.map((m) => ({ ...m, i: m.i - start })),
        label: "Line chart of the Plausibility Index for each ending over time",
        onClick: (i) => (location.hash = `#/summary/${H.dates[start + i]}`),
      });
      S.charts = S.charts.filter((c) => c !== chart); S.charts.push(chart);
      drawLegend(src);
    };
    const drawLegend = (src) => {
      const lg = $("#legend");
      lg.innerHTML = FAMILY_ORDER.map((f) => {
        const items = src.filter((s) => s.family === f);
        return `<div class="legend-group"><span class="gname">${esc(famName(f))}</span>${items.map((s) => `<button type="button" class="chip ${st.hidden.has(s.key) ? "off" : ""}" data-k="${s.key}" aria-pressed="${st.focus === s.key}">${swatchSVG(s.cls, s.dash)}${esc(s.name)}</button>`).join("")}</div>`;
      }).join("") + `<button type="button" class="chip" id="reset-focus" ${st.focus || st.hidden.size ? "" : "hidden"}>Reset</button>`;
      $$(".chip[data-k]", lg).forEach((b) => {
        b.addEventListener("click", () => { st.focus = st.focus === b.dataset.k ? null : b.dataset.k; st.hidden.delete(b.dataset.k); draw(); });
        b.addEventListener("dblclick", () => { st.hidden.has(b.dataset.k) ? st.hidden.delete(b.dataset.k) : st.hidden.add(b.dataset.k); st.focus = null; draw(); });
      });
      $("#reset-focus", lg)?.addEventListener("click", () => { st.focus = null; st.hidden.clear(); draw(); });
    };
    $$("#range button").forEach((b) => b.addEventListener("click", () => { st.range = b.dataset.r; $$("#range button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    $$("#mode button").forEach((b) => b.addEventListener("click", () => { st.mode = b.dataset.m; st.focus = null; st.hidden.clear(); $$("#mode button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    draw();

    // table view
    $("#score-table").innerHTML = `<table><thead><tr><th>Ending</th><th>Family</th><th class="n">Today</th><th class="n">1 day</th><th class="n">7 days</th><th class="n">30 days</th><th class="n">Since ${fmtDate(H.start).replace(/ \d{4}$/, "")}</th></tr></thead><tbody>${sorted.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(famName(s.family))}</td><td class="n">${last(s.values).toFixed(1)}</td><td class="n">${dtxt(change(s.key, 1))}</td><td class="n">${dtxt(change(s.key, 7))}</td><td class="n">${dtxt(change(s.key, 30))}</td><td class="n">${dtxt(change(s.key, n - 1))}</td></tr>`).join("")}</tbody></table>`;

    // ending cards
    $("#fam-blocks").innerHTML = FAMILY_ORDER.map((f) => `
      <div class="fam-block">
        <div class="fam-title"><h3><span class="swatch c-${f}" style="width:12px;height:12px"></span>${esc(famName(f))}</h3><span class="muted small">${esc(S.H.families_meta[f].tagline)}</span><span class="fam-score">family index ${last(H.families[f]).toFixed(1)}</span></div>
        <div class="cards">${S.series.filter((s) => s.family === f).map((s) => {
          const c = S.C.endings[s.key];
          return `<button type="button" class="card ending ${s.cls}" data-k="${s.key}">
            <div class="row"><span class="name">${esc(s.name)}</span><span class="num">#${String(c.num).padStart(2, "0")}</span></div>
            <div class="row"><span class="score">${last(s.values).toFixed(1)}</span><span class="deltas"><span class="${dcls(change(s.key, 1))}" title="Change today">${dtxt(change(s.key, 1))}</span><span title="Change over 7 days">7d ${dtxt(change(s.key, 7))}</span></span></div>
            <div class="spark-holder"></div>
            <p class="line1">${esc(c.desc)}</p>
          </button>`;
        }).join("")}</div>
      </div>`).join("");
    $$(".ending[data-k]").forEach((b) => {
      const s = S.series.find((x) => x.key === b.dataset.k);
      spark($(".spark-holder", b), s.values.slice(-60), s.cls);
      b.addEventListener("click", () => (location.hash = `#/ending/${b.dataset.k}`));
    });

    // factors
    const base = S.R.factor_baselines;
    $("#factors").innerHTML = Object.keys(S.R.factors).map((f) => {
      const v = last(H.factors[f]), b = base[f], d = v - H.factors[f][0];
      return `<div class="factor"><span class="fname">${esc(S.R.factors[f].name)}</span><span class="fval">${v.toFixed(1)} <span class="small ${dcls(d)} muted">${dtxt(d)}</span></span>
        <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v.toFixed(1)}" aria-label="${esc(S.R.factors[f].name)}"><div class="fill" data-w="${v}"></div><div class="base" style="left:calc(${b}% - 1px)"></div></div>
        <div class="fnote"><span>0 · ${esc(S.R.factors[f].low)}</span><span style="text-align:right">${esc(S.R.factors[f].high)} · 100</span></div></div>`;
    }).join("");
    requestAnimationFrame(() => $$(".meter .fill").forEach((m) => (m.style.width = m.dataset.w + "%")));
  }

  /* ---------------- ending dialog ---------------- */
  async function openEnding(key) {
    const dlg = $("#ending-dialog"), body = $("#dlg-body");
    const s = S.series.find((x) => x.key === key), c = S.C.endings[key], sc = S.R.scenarios[key];
    const n = N();
    body.innerHTML = `
      <div class="dlg-head">
        <div><div class="eyebrow"><span class="swatch ${s.cls}"></span> ${esc(famName(s.family))} · ending #${String(c.num).padStart(2, "0")}</div><h2 id="dlg-title" style="margin-top:8px">${esc(s.name)}</h2></div>
        <button class="dlg-close" type="button" aria-label="Close" id="dlg-close">×</button>
      </div>
      <p class="lead">${esc(c.desc)}</p>
      <div class="stats" style="grid-template-columns:repeat(4,1fr);margin:0">
        <div class="card stat"><div class="label">Today</div><div class="value mono">${last(s.values).toFixed(1)}</div></div>
        <div class="card stat"><div class="label">7 days</div><div class="value mono ${dcls(change(key, 7))}">${dtxt(change(key, 7))}</div></div>
        <div class="card stat"><div class="label">30 days</div><div class="value mono ${dcls(change(key, 30))}">${dtxt(change(key, 30))}</div></div>
        <div class="card stat"><div class="label">Since start</div><div class="value mono ${dcls(change(key, n - 1))}">${dtxt(change(key, n - 1))}</div></div>
      </div>
      <div class="chart-wrap" id="dlg-chart"></div>
      <div class="facts"><div><b>What it looks like</b>${esc(cap(c.looks))}</div><div><b>Rises when</b>${esc(cap(c.rises))}</div><div><b>Falls when</b>${esc(cap(c.falls))}</div></div>
      <div><div class="eyebrow" style="margin-bottom:8px">recipe · the world factors that drive it</div>${recipeHTML(sc.weights, s.cls)}</div>
      <div><div class="eyebrow" style="margin-bottom:8px">biggest pushes · last 30 days</div><div id="dlg-pushes" class="small muted">Loading…</div></div>`;
    if (!dlg.open) dlg.showModal();
    $("#dlg-close").addEventListener("click", () => dlg.close());
    const ch = lines($("#dlg-chart"), { dates: S.H.dates, series: [s], endLabels: false, height: 200, headlines: S.H.headlines, label: `${s.name} over time`,
      onClick: (i) => { dlg.close(); location.hash = `#/summary/${S.H.dates[i]}`; } });
    dlg.addEventListener("close", () => { ch.destroy(); $("#tooltip").hidden = true; if (location.hash.startsWith("#/ending")) history.replaceState(null, "", "#/dashboard"); }, { once: true });
    // pushes
    const ds = S.H.dates.slice(-30);
    const days = await Promise.all(ds.map((d) => getDay(d).catch(() => null)));
    const ev = [];
    days.forEach((d) => d && d.events.forEach((e) => { const v = e.contribution?.[key]; if (v) ev.push({ d: d.date, e, v }); }));
    ev.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const top = ev.slice(0, 6);
    $("#dlg-pushes").innerHTML = top.length ? `<div class="bars">${top.map((x) => `<a class="bar-row" style="text-decoration:none" href="#/summary/${x.d}"><span class="mono dim">${fmtDate(x.d).replace(/ \d{4}$/, "")}</span><span style="color:var(--ink)">${esc(x.e.title)}</span><span class="v ${dcls(x.v)}">${dtxt(x.v, 2)}</span></a>`).join("")}</div>` : "No events moved this ending in the last 30 days.";
    $$("#dlg-pushes a").forEach((a) => a.addEventListener("click", () => dlg.close()));
  }
  function recipeHTML(weights, cls) {
    return `<div class="recipe">${Object.entries(weights).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([f, w]) => `
      <div class="recipe-row ${cls}"><span>${w > 0 ? "↑" : "↓"} ${esc(S.R.factors[f].name)}</span><div><div class="rb" style="width:${Math.abs(w) * 100 / 0.55}%;opacity:${w > 0 ? 1 : 0.45}"></div></div><span class="rv">${w > 0 ? "+" : "−"}${Math.round(Math.abs(w) * 100)}%</span></div>`).join("")}</div>`;
  }

  /* ================= SUMMARY ================= */
  async function renderSummary(date) {
    const H = S.H;
    if (!date || !H.dates.includes(date)) date = H.end;
    const i = H.dates.indexOf(date);
    view.innerHTML = `<div class="wrap"><div class="loading"><span class="spinner"></span> Loading ${fmtDate(date)}…</div></div>`;
    let d;
    try { d = await getDay(date); } catch { view.innerHTML = `<div class="wrap"><p class="loading">Could not load this day.</p></div>`; return; }
    if (location.hash.replace(/^#\/?/, "").split("/")[0] !== "summary") return;
    const sm = d.summary || {};
    const prev = i > 0 ? H.dates[i - 1] : null, next = i < N() - 1 ? H.dates[i + 1] : null;
    const balD = i > 0 ? H.balance[i] - H.balance[i - 1] : 0;
    const deltas = S.series.map((s) => ({ s, v: d.deltas[s.key] })).sort((a, b) => b.v - a.v);
    const maxAbs = Math.max(0.3, ...deltas.map((x) => Math.abs(x.v)));
    const fadeTotal = Object.values(d.fading_contribution || {}).reduce((a, b) => a + Math.abs(b), 0);

    view.innerHTML = `
    <div class="wrap">
      <div class="day-head reveal">
        <div class="section-head">
          <div class="date-big">Summary of the day · ${weekday(date)}, ${fmtDate(date)}</div>
          <div class="day-nav">
            <a class="btn" ${prev ? `href="#/summary/${prev}"` : 'aria-disabled="true"'} aria-label="Previous day">← prev</a>
            <input class="btn mono" type="date" id="day-pick" value="${date}" min="${H.start}" max="${H.end}" aria-label="Pick a date">
            <a class="btn" ${next ? `href="#/summary/${next}"` : 'aria-disabled="true"'} aria-label="Next day">next →</a>
            ${date !== H.end ? `<a class="btn" href="#/summary/${H.end}">latest</a>` : ""}
          </div>
        </div>
        <h1>${esc(sm.headline || "No summary written for this day")}</h1>
        <div class="badges" style="margin-top:16px">${(d.badges || []).map(badgeHTML).join("")}</div>
      </div>

      <div class="day-grid section">
        <div class="grid">
          <article class="card pad prose reveal">
            ${(sm.body || "").split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}
            ${sm.movers_note ? `<div class="movers"><b>Movers.</b> ${esc(sm.movers_note)}</div>` : ""}
          </article>
          <div>
            <div class="section-head" style="margin:10px 0 12px"><div><div class="eyebrow"><span class="num">${String(d.events.length).padStart(2, "0")}</span> events rated today</div></div></div>
            <div class="events">${d.events.length ? d.events.slice().sort((a, b) => b.points - a.points).map(eventHTML).join("") : `<div class="card pad muted">No qualifying events were found for this day. Scores only drifted as earlier announcements faded.</div>`}</div>
          </div>
        </div>
        <aside class="grid">
          <div class="card pad">
            <div class="eyebrow">horizon balance</div>
            <div style="display:flex;align-items:baseline;gap:12px;margin-top:6px"><span class="gauge-value mono" style="font-size:44px">${fmtSigned(H.balance[i], 1)}</span><span class="mono ${dcls(balD)}">${dtxt(balD, 2)}</span></div>
            <dl class="kv" style="margin-top:14px">
              <dt>Evidence strength</dt><dd>${esc(d.composites.evidence)}</dd>
              <dt>News heat</dt><dd>${d.composites.news_heat.toFixed(2)}</dd>
              <dt>Events rated</dt><dd>${d.events.length}</dd>
              <dt>Leading ending</dt><dd>${esc(S.H.scenarios[Object.entries(d.scores).sort((a, b) => b[1] - a[1])[0][0]].name)}</dd>
            </dl>
          </div>
          <div class="card pad">
            <div class="eyebrow" style="margin-bottom:12px">how each ending moved</div>
            <div class="bars">${deltas.map(({ s, v }) => {
              const w = (Math.abs(v) / maxAbs) * 50;
              return `<div class="bar-row ${s.cls}"><span>${esc(s.name)}</span><div class="bar-track"><div class="bar" style="${v >= 0 ? `left:50%` : `right:50%`};width:${w}%"></div></div><span class="v ${dcls(v)}">${dtxt(v)}</span></div>`;
            }).join("")}</div>
            ${fadeTotal > 0.02 ? `<p class="small dim" style="margin-top:12px">Includes gentle drift as earlier announcements fade (21-day half-life).</p>` : ""}
          </div>
          ${(sm.coming_up || []).length ? `<div class="card pad"><div class="eyebrow" style="margin-bottom:10px">coming up</div><ul style="margin:0;padding-left:18px">${sm.coming_up.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
          <div class="card pad small muted">Scores are an evidence-weighted reading of public news, not a forecast. <a href="#/scoring">How scoring works →</a></div>
        </aside>
      </div>
    </div>`;
    $("#day-pick").addEventListener("change", (e) => { if (H.dates.includes(e.target.value)) location.hash = `#/summary/${e.target.value}`; });
  }

  function eventHTML(e) {
    const fx = e.factors.map((f) => `${f.dir > 0 ? "↑" : "↓"} ${esc(S.R.factors[f.id].name)}`).join(" · ");
    const contrib = Object.entries(e.contribution || {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
    return `<article class="card event">
      <div class="event-top"><span class="tag tier" title="Impact tier">${e.tier}</span><span class="tag">${esc(CATS[e.category] || e.category)}</span><span class="tag" title="Source credibility">cred ${e.credibility}${e.self_claim ? "*" : ""}</span><span class="tag">${esc(e.track)}</span>${e.novelty === "development" ? `<span class="tag">follow-up</span>` : ""}${e.offset_by_opposing ? `<span class="tag" title="Cancelled out by an opposing event on the same factor">offset</span>` : ""}</div>
      <h3>${esc(e.title)}</h3>
      <p class="muted">${esc(e.summary)}</p>
      <div class="factor-arrows">${fx} · <span class="mono">${e.points.toFixed(2)} pts</span></div>
      ${contrib.length ? `<div class="contrib">${contrib.map(([k, v]) => `<span><span class="swatch c-${S.H.scenarios[k].family}" style="width:8px;height:8px"></span>${esc(S.H.scenarios[k].name)} ${dtxt(v, 2)}</span>`).join("")}</div>` : ""}
      <p class="why">Why: ${esc(e.reason)}</p>
      <div class="sources">${(e.sources || []).filter((u) => /^https?:/.test(u)).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(host(u))} ↗</a>`).join("")}</div>
    </article>`;
  }

  /* ================= HISTORY ================= */
  async function renderHistory() {
    const H = S.H, n = N();
    view.innerHTML = `
    <div class="wrap">
      <div class="day-head reveal">
        <div class="eyebrow"><span class="num">03</span> history</div>
        <h1>${n} days of the story so far</h1>
        <p class="lede muted" style="margin-top:14px;max-width:62ch">Every night adds a new point. Read the monthly recaps for the big picture, or scroll the timeline to see what moved each day.</p>
      </div>
      <section class="section">
        <div class="section-head"><h2 class="h2">Horizon Balance, day by day</h2><span class="small muted">above zero = hopeful endings ahead · click a day to open it</span></div>
        <div class="card chart-card"><div class="chart-wrap" id="bal-chart"></div></div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">Monthly recaps</h2></div>
        <div class="recaps" id="recaps"><div class="muted small">Loading…</div></div>
      </section>
      <section class="section">
        <div class="section-head"><h2 class="h2">Timeline</h2>
          <div class="controls">
            <select class="btn" id="f-ending" aria-label="Filter by ending"><option value="">All endings</option>${S.series.map((s) => `<option value="${s.key}">${esc(s.name)} moved ≥ 0.3</option>`).join("")}</select>
            <select class="btn" id="f-badge" aria-label="Filter by badge"><option value="">All days</option>${Object.keys(BADGES).map((b) => `<option value="${b}">${BADGES[b][1]}</option>`).join("")}</select>
            <input class="btn" type="search" id="f-q" placeholder="Search headlines" aria-label="Search headlines">
          </div>
        </div>
        <div class="timeline" id="timeline"></div>
      </section>
    </div>`;
    S.charts.push(balance($("#bal-chart"), { dates: H.dates, values: H.balance, headlines: H.headlines, height: 220, onClick: (i) => (location.hash = `#/summary/${H.dates[i]}`) }));

    const draw = () => {
      const fe = $("#f-ending").value, fb = $("#f-badge").value, q = $("#f-q").value.trim().toLowerCase();
      let html = "", month = "";
      for (let i = n - 1; i >= 0; i--) {
        const d = H.dates[i], head = H.headlines[i] || "";
        const mv = S.series.map((s) => ({ s, v: i > 0 ? s.values[i] - s.values[i - 1] : 0 })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
        if (fe && !(i > 0 && Math.abs(S.H.scores[fe][i] - S.H.scores[fe][i - 1]) >= 0.3)) continue;
        if (fb && !H.badges[i].includes(fb)) continue;
        if (q && !head.toLowerCase().includes(q)) continue;
        const m = d.slice(0, 7);
        if (m !== month) { month = m; html += `<div class="month-label">${new Date(d + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>`; }
        const top = fe ? { s: S.series.find((s) => s.key === fe), v: S.H.scores[fe][i] - S.H.scores[fe][i - 1] } : mv[0];
        html += `<a class="tl-item" href="#/summary/${d}"><span class="tl-date">${fmtDate(d).replace(/ \d{4}$/, "")} · ${weekday(d).slice(0, 3)}</span>
          <span><span class="tl-head">${esc(head)}</span><span class="tl-meta"><span><span class="swatch ${top.s.cls}" style="display:inline-block;width:8px;height:8px"></span> ${esc(top.s.name)} <span class="mono ${dcls(top.v)}">${dtxt(top.v)}</span></span><span>${H.event_counts[i]} events</span>${H.badges[i].map((b) => `<span>${BADGES[b] ? BADGES[b][0] + " " + BADGES[b][1] : ""}</span>`).join("")}</span></span>
          <span class="tl-bal" title="Horizon Balance">${fmtSigned(H.balance[i], 1)}</span></a>`;
      }
      $("#timeline").innerHTML = html || `<p class="muted pad">No days match these filters.</p>`;
    };
    ["#f-ending", "#f-badge"].forEach((s) => $(s).addEventListener("change", draw));
    $("#f-q").addEventListener("input", draw);
    draw();

    const recaps = await getRecaps();
    if (!$("#recaps")) return;
    $("#recaps").innerHTML = recaps.map((r, k) => `
      <article class="card recap"><span class="rnum">${String(k + 1).padStart(2, "0")} · ${esc(r.window)}</span><h3>${esc(r.title)}</h3><p class="clamp">${esc(r.body)}</p><button type="button" class="btn" style="align-self:flex-start">Read more</button></article>`).join("");
    $$("#recaps .recap").forEach((a) => $("button", a).addEventListener("click", (ev) => { const o = a.classList.toggle("open"); ev.target.textContent = o ? "Show less" : "Read more"; }));
  }

  /* ================= SCORING ================= */
  function renderScoring() {
    const R = S.R, C = S.C, H = S.H;
    const ER = R.event_rating, D = R.dynamics;
    const tierTxt = { T1: "Minor, a small step", T2: "Notable, a clear step", T3: "Major, changes the landscape", T4: "Landmark, historic (a few per year)" };
    const credTxt = { A: "Primary: governments, courts, peer review, official lab documents", B: "Major outlets with original reporting", C: "Tech and trade press, aggregators", D: "Blogs, newsletters, opinion", E: "Rumours and unverified posts (never scored)" };
    view.innerHTML = `
    <div class="wrap">
      <div class="day-head reveal">
        <div class="eyebrow"><span class="num">04</span> scoring mechanism</div>
        <h1>How the score is made</h1>
        <p class="lede muted" style="margin-top:14px;max-width:66ch">Every ending gets a <b>Plausibility Index from 1 to 99</b>: how strongly the world's AI news is pointing down that path. The scores are independent, so they don't add up to 100. They are not probabilities. Every number traces back to real, linked stories.</p>
      </div>

      <section class="section">
        <div class="pipeline">
          ${[["01", "Read", "Hundreds of articles from a fixed list of searches across 8 categories, every night at 11:59 PM IST."],
             ["02", "Cluster", "Coverage of the same event is merged. Up to 25 events a day; at least a quarter from outside the US."],
             ["03", "Rate", "Each event is tagged: which world factor it pushes, which way, how big, how credible, how new."],
             ["04", "Compute", `A fixed script turns ratings into factor moves, then into the 12 endings. Max ±${D.scenario_daily_cap} points per ending per day.`],
             ["05", "Explain", "A plain-English summary, written from the computed results, with every source linked."]].map(([n, h, p]) => `<div class="card step"><span class="snum">${n}</span><h4>${h}</h4><p>${p}</p></div>`).join("")}
        </div>
        <div class="golden">The golden rule: <b>Claude judges the news; code does the arithmetic.</b> The same news always produces the same numbers.</div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">A</span> the twelve endings and their recipes</div><h2 class="h2" style="margin-top:8px">What drives each ending</h2></div><p class="small muted">Each ending is a fixed mix of 3–4 world factors. ↑ pushes it up, ↓ pushes it down.</p></div>
        ${FAMILY_ORDER.map((f) => `<div class="fam-block"><div class="fam-title"><h3><span class="swatch c-${f}" style="width:12px;height:12px"></span>${esc(famName(f))}</h3><span class="muted small">${esc(H.families_meta[f].tagline)}</span></div>
          <div class="ending-recipes">${S.series.filter((s) => s.family === f).map((s) => `<div class="card pad ${s.cls}" style="border-left:3px solid var(--c)"><div class="row" style="display:flex;justify-content:space-between;gap:8px"><h4 style="font-size:17px">${esc(s.name)}</h4><span class="mono dim small">start ${R.scenarios[s.key].anchor} · now ${last(s.values).toFixed(1)}</span></div><p class="small muted" style="margin:6px 0 12px">${esc(C.endings[s.key].desc)}</p>${recipeHTML(R.scenarios[s.key].weights, s.cls)}</div>`).join("")}</div></div>`).join("")}
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">B</span> the ten world factors</div><h2 class="h2" style="margin-top:8px">The forces underneath</h2></div><p class="small muted">News never moves an ending directly. It moves one of these forces.</p></div>
        <div class="card pad table-wrap"><table><thead><tr><th>Factor</th><th>Question</th><th>0 means…</th><th>100 means…</th><th class="n">Start</th><th class="n">Now</th></tr></thead><tbody>
          ${Object.keys(R.factors).map((f) => `<tr><td><b>${esc(R.factors[f].name)}</b></td><td class="muted">${esc(C.factor_questions[f] || "")}</td><td>${esc(R.factors[f].low)}</td><td>${esc(R.factors[f].high)}</td><td class="n">${R.factor_baselines[f]}</td><td class="n">${last(H.factors[f]).toFixed(1)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">C</span> rating a news event</div><h2 class="h2" style="margin-top:8px">Score events, not articles</h2></div></div>
        <div class="two-col">
          <div class="card pad"><h4 style="margin-bottom:10px">Impact tier</h4><table><tbody>${Object.entries(ER.impact_points).map(([t, p]) => `<tr><td><span class="tag tier">${t}</span></td><td>${tierTxt[t]}</td><td class="n">${p} pts</td></tr>`).join("")}</tbody></table></div>
          <div class="card pad"><h4 style="margin-bottom:10px">Source credibility</h4><table><tbody>${Object.entries(ER.credibility).map(([g, w]) => `<tr><td><span class="tag">${g}</span></td><td>${credTxt[g]}</td><td class="n">×${w}</td></tr>`).join("")}</tbody></table><p class="small dim" style="margin-top:8px">Hype guard: a company's claims about its own product count ×${ER.self_claim_multiplier} until someone independent confirms them.</p></div>
          <div class="card pad"><h4 style="margin-bottom:10px">Novelty and scope</h4><table><tbody>
            <tr><td>New event</td><td class="n">×${ER.novelty.new}</td></tr><tr><td>Follow-up on a known story</td><td class="n">×${ER.novelty.development}</td></tr><tr><td>Rehash</td><td class="n">×${ER.novelty.rehash}</td></tr>
            <tr><td>Global (frontier labs, US, China, EU, UN)</td><td class="n">×${ER.scope.global}</td></tr><tr><td>National</td><td class="n">×${ER.scope.national}</td></tr><tr><td>Local / niche</td><td class="n">×${ER.scope.local}</td></tr></tbody></table></div>
          <div class="card pad"><h4 style="margin-bottom:10px">Two tracks</h4><p class="muted"><b style="color:var(--ink)">Structural</b> things actually happened: a law enacted, a model released, an incident confirmed. Their effect is permanent until reversed.</p><p class="muted" style="margin-top:10px"><b style="color:var(--ink)">Signal</b> words and intentions: announcements, proposals, speeches. Their effect fades, halving every ${D.signal_half_life_days} days.</p><p class="small dim" style="margin-top:10px">One main factor, plus an optional second factor that counts half. A deliberately skeptical second pass re-checks every T3 and T4 rating.</p></div>
        </div>
        <div class="golden" style="margin-top:16px;font-family:var(--mono);font-size:15px">event points = tier × credibility × novelty × scope × direction</div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">D</span> from events to scores</div><h2 class="h2" style="margin-top:8px">The maths, in six steps</h2></div></div>
        <div class="card pad table-wrap"><table><thead><tr><th>Step</th><th>What happens</th><th>Why</th></tr></thead><tbody>
          <tr><td>1. Daily pressure</td><td>Each factor's event points are summed; a smoothing curve caps the day near ±${D.daily_saturation_S}.</td><td>Ten minor stories can't add up to a landmark.</td></tr>
          <tr><td>2. Edge softening</td><td>Within ${D.edge_softening_zone} points of 0 or 100, moves toward the edge shrink.</td><td>Factors approach extremes without slamming into them.</td></tr>
          <tr><td>3. Memory</td><td>Structural effects stay; signal effects halve every ${D.signal_half_life_days} days.</td><td>Actions outweigh words.</td></tr>
          <tr><td>4. Ending target</td><td>Starting level + ${D.amplifier_k} × change in the ending's factor recipe since ${fmtDate(R.effective_from)}.</td><td>Each ending follows its forces.</td></tr>
          <tr><td>5. Speed limit</td><td>The shown score moves at most ±${D.scenario_daily_cap} a day toward its target.</td><td>Shocks play out over days; nothing is lost.</td></tr>
          <tr><td>6. Bounds</td><td>Scores stay within ${D.scenario_bounds[0]}–${D.scenario_bounds[1]}; moves under ${D.no_change_threshold} show as no change.</td><td>No false certainty, no noise.</td></tr>
        </tbody></table></div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">E</span> headline indicators</div><h2 class="h2" style="margin-top:8px">Reading the dashboard</h2></div></div>
        <div class="two-col">
          <div class="card pad"><dl class="kv" style="grid-template-columns:auto 1fr;gap:12px 16px">
            <dt><b style="color:var(--ink)">Horizon Balance</b></dt><dd style="font-family:var(--font);text-align:left">Average of the four bright endings minus the four dark ones, from −100 to +100.</dd>
            <dt><b style="color:var(--ink)">Family index</b></dt><dd style="font-family:var(--font);text-align:left">Average score of each family's endings.</dd>
            <dt><b style="color:var(--ink)">7-day momentum</b></dt><dd style="font-family:var(--font);text-align:left">Today's score minus the score a week ago.</dd>
            <dt><b style="color:var(--ink)">News heat</b></dt><dd style="font-family:var(--font);text-align:left">Total event points that day: how eventful it was.</dd>
            <dt><b style="color:var(--ink)">Evidence strength</b></dt><dd style="font-family:var(--font);text-align:left">High: at least 3 events rated T2+ from A/B sources. Medium: at least 1. Low: none.</dd></dl></div>
          <div class="card pad"><div class="badges" style="flex-direction:column;align-items:flex-start;gap:10px">${Object.keys(BADGES).map((b) => `<div style="display:flex;gap:10px;align-items:center">${badgeHTML(b)}<span class="small muted">${esc(R.badges[b] || "")}</span></div>`).join("")}</div></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><div><div class="eyebrow"><span class="num">F</span> keeping it honest</div><h2 class="h2" style="margin-top:8px">Questions people ask</h2></div></div>
        <div class="card pad faq">${C.faq.map((q) => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join("")}</div>
        <div class="disclaimer">Versioned rules (currently v${esc(R.version)}): every change gets a new version number and a changelog entry, and past scores are never quietly rewritten. Read the <a href="scoring/SCORING_RULES.md">full rules</a> or the machine-readable <a href="scoring/rules.json">rules.json</a>.</div>
      </section>
    </div>`;
  }

  /* ---------------- theme toggle ---------------- */
  (function theme() {
    const meta = document.querySelector('meta[name="color-scheme"]');
    const sys = matchMedia("(prefers-color-scheme: dark)");
    const rendered = () => (meta.content === "light dark" ? (sys.matches ? "dark" : "light") : meta.content);
    const apply = (v) => { meta.content = v ?? "light dark"; };
    $("#theme-toggle").addEventListener("click", () => {
      const target = rendered() === "dark" ? "light" : "dark";
      const systemNow = sys.matches ? "dark" : "light";
      try { target === systemNow ? localStorage.removeItem("color-scheme") : localStorage.setItem("color-scheme", target); } catch {}
      apply(target === systemNow ? null : target);
    });
    window.addEventListener("storage", (e) => { if (e.key === "color-scheme") apply(e.newValue); });
  })();

  boot().catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="wrap"><div class="loading">Couldn't load the data. If you opened this file directly, serve the folder over HTTP (for example <code>python3 -m http.server</code>) or open the published site.</div></div>`;
  });
})();
