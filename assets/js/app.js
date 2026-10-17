/* Endgame Index — app (no framework, no build step) */
(function () {
  const { lines, spark, balance, swatchSVG, fmtDate, fmtSigned, esc } = window.EGChart;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $("#view");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const FAMILY_ORDER = ["flourishing", "contained", "successors", "stalled"];
  const DASHES = ["", "", "", ""];
  const BADGES = {
    landmark_day: ["◆", "Landmark day"], speed_limit: ["⏱", "Speed limit"], breakout: ["↗", "Breakout"],
    new_leader: ["♛", "New leader"], crossover: ["⤨", "Crossover"], quiet_day: ["○", "Quiet day"],
  };
  const CATS = { labs: "Labs & Models", safety: "Safety & Alignment", policy: "Policy & Treaties", military: "Military & Security",
    surveillance: "Surveillance & Rights", economy: "Jobs & Economy", merge: "Brain-Tech & AI Personhood", society: "Society & Public Mood" };

  const T = (name, props) => window.EGTrack && window.EGTrack.event(name, props);
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
    $("#updated-chip-text").textContent = "Updated " + fmtDate(H.end).replace(/ \d{4}$/, "");
    const tb = $(".topbar"), mb = $("#menu-btn");
    mb.addEventListener("click", () => { const o = tb.classList.toggle("open"); mb.setAttribute("aria-expanded", o); if (o) T("menu_open"); });
    document.addEventListener("click", (e) => { const a = e.target.closest(".byline, .hero-byline"); if (a) T("byline_click", { place: a.classList.contains("hero-byline") ? "home_chart" : a.classList.contains("menu-byline") ? "menu" : a.closest(".updated-chip") ? "top_right" : "subtitle" }); });
    document.addEventListener("click", (e) => { if (!tb.contains(e.target)) { tb.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); } });
    view.addEventListener("click", (e) => {
      const r = e.target.closest(".sum-date .round, .sum-latest");
      if (r) T("summary_day_nav", { dir: r.classList.contains("sum-latest") ? "latest" : r.getAttribute("aria-label") === "Next day" ? "next" : "prev" });
      const ev = e.target.closest(".evlist .src a");
      if (ev) T("source_click", { host: ev.hostname });
      const a = e.target.closest('a[href^="#/ending/"]');
      if (a && route.prev === "summary") { e.preventDefault(); openEnding(a.getAttribute("href").split("/")[2]); }
    });
    window.addEventListener("hashchange", route);
    matchMedia(PHONE_Q).addEventListener("change", () => { const t = location.hash.replace(/^#\/?/, "").split("/")[0]; if (!t || t === "dashboard") { destroyCharts(); renderDashboard(); } else if (t === "endings") renderEndings(); });
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
    const tab = ["dashboard", "summary", "endings", "history", "scoring", "ending"].includes(parts[0]) ? parts[0] : "dashboard";
    const go = () => {
      destroyCharts();
      if (typeof LS !== "undefined" && LS.el && tab !== "dashboard") closeLandscape(true);
      document.body.classList.toggle("is-home", tab === "dashboard" || tab === "ending");
      $(".topbar").classList.remove("open"); $("#menu-btn").setAttribute("aria-expanded", "false");
      $$(".tabs a").forEach((a) => a.toggleAttribute("aria-current", false));
      const active = tab === "ending" ? "dashboard" : tab;
      $(`.tabs a[data-tab="${active}"]`)?.setAttribute("aria-current", "page");
      if (tab === "dashboard" || tab === "ending") renderDashboard();
      else if (tab === "summary") renderSummary(parts[1]);
      else if (tab === "endings") renderEndings();
      else if (tab === "history") renderHistory();
      else if (tab === "scoring") renderScoring();
      document.title = { dashboard: "Endgame Index", ending: "Endgame Index", summary: "Summary of the Day · Endgame Index", endings: "The 12 Endings · Endgame Index", history: "History · Endgame Index", scoring: "Scoring Mechanism · Endgame Index" }[tab];
      if (tab === "ending" && parts[1] && S.H.scenarios[parts[1]]) openEnding(parts[1]);
    };
    const prevTab = route.prev; route.prev = tab;
    T("page_viewed", { page: tab === "ending" ? "dashboard" : tab, ending: tab === "ending" ? parts[1] : undefined, date: tab === "summary" ? (parts[1] || "default") : undefined, from: prevTab || "entry" });
    if (window.EGTrack) window.EGTrack.page(tab, { date: tab === "summary" ? (parts[1] || "default") : undefined, ending: tab === "ending" ? parts[1] : undefined });
    const changedTab = prevTab && prevTab !== tab && !(prevTab === "dashboard" && tab === "ending") && !(prevTab === "ending" && tab === "dashboard");
    if (changedTab && document.startViewTransition && !reduceMotion.matches) {
      document.startViewTransition(go).finished.finally(() => { window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); });
    } else {
      go();
      if (changedTab) { window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); }
    }
  }

  /* ================= DASHBOARD (full-screen chart) ================= */
  const isNight = () => {
    const m = document.querySelector('meta[name="color-scheme"]').content;
    return m === "dark" || (m !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  };
  const PHONE_Q = "(max-width: 760px), (pointer: coarse) and (max-height: 500px)";
  const isPhone = () => matchMedia(PHONE_Q).matches;
  function renderDashboard() {
    if (isPhone()) return renderPhoneHome();
    const H = S.H, n = N(), li = n - 1;
    const bal = last(H.balance), bal1 = li > 0 ? bal - H.balance[li - 1] : 0, bal7 = bal - H.balance[Math.max(0, li - 7)];
    const word = (v, up, down) => (v > 0.049 ? `${up} ${Math.abs(v).toFixed(1)}` : v < -0.049 ? `${down} ${Math.abs(v).toFixed(1)}` : "unchanged");
    const sorted = S.series.slice().sort((a, b) => last(b.values) - last(a.values));
    const dShort = new Date(H.end + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
    const tick = [];
    for (let i = li; i >= Math.max(0, li - 13); i--) if (H.headlines[i]) tick.push(`<a href="#/summary/${H.dates[i]}"><time>${fmtDate(H.dates[i]).replace(/ \d{4}$/, "")}</time>${esc(H.headlines[i])}</a>`);
    const tickHTML = tick.join("");

    view.innerHTML = `
    <section class="hero" aria-label="The twelve endings over time">
      <div class="hero-chart" id="hero-chart"></div>
      <div class="hero-title">
        <h1>Where Humanity is <i>heading with AI?</i></h1>
        <p><span class="d-only">12 possible endings for humanity with AI, as per MIT research, tracked daily against news, research papers, articles and developments in AI.</span><span class="m-only">12 possible endings for humanity with AI, tracked daily · updated ${fmtDate(H.end).replace(/ \d{4}$/, "")} · <a class="byline" href="https://www.linkedin.com/in/sidhartha-rajput/" target="_blank" rel="noopener noreferrer">By Sidhartha Rajput</a></span></p>
      <div class="hero-filters" role="toolbar" aria-label="Chart options">
        <div class="seg" role="group" aria-label="Time range" id="range"><button type="button" data-r="30" aria-pressed="false">30D</button><button type="button" data-r="90" aria-pressed="false">90D</button><button type="button" data-r="all" aria-pressed="true">All</button></div>
        <span class="sep" aria-hidden="true"></span>
        <div class="seg" role="group" aria-label="Chart view" id="mode"><button type="button" data-m="families" aria-pressed="false"><span class="d-only">4 families</span><span class="m-only">Families</span></button><button type="button" data-m="endings" aria-pressed="true"><span class="d-only">12 endings</span><span class="m-only">Endings</span></button></div>
      </div>
      <div class="hero-top3 m-only" id="top3">${sorted.slice(0, 3).map((s) => `<span class="${s.cls}" data-k="${s.key}" role="button" tabindex="0"><i class="swatch"></i><b>${last(s.values).toFixed(1)}</b>${esc(s.name)}</span>`).join("")}</div>
      </div>
      <section class="hero-card" aria-label="Horizon Balance today">
        <span class="kicker"><span class="d-only">Horizon Balance · ${weekday(H.end)}, ${fmtDate(H.end)}</span><span class="m-only">Horizon Balance · ${dShort}</span></span>
        <div class="bal"><b id="bal-val">0.0</b><span>${word(bal1, "up", "down")} today<br>${word(bal7, "up", "down")} this week</span></div>
        <div><div class="gauge-scale" aria-hidden="true"><div class="gauge-needle" id="needle" style="left:50%"></div></div><div class="gauge-ends"><span><span class="d-only">Darker futures</span><span class="m-only">Darker</span></span><span><span class="d-only">Brighter futures</span><span class="m-only">Brighter</span></span></div></div>
        <h2 class="m-only">${esc(H.headlines[li] || "")}</h2>
        <div class="links m-only"><a href="#/summary/${H.end}">Today’s story ›</a><a href="#/scoring">How it’s scored ›</a></div>
      </section>
      <a class="hero-byline d-only-block" href="https://www.linkedin.com/in/sidhartha-rajput/" target="_blank" rel="noopener noreferrer">By Sidhartha Rajput</a>
      <div class="ticker" id="ticker">
        <span class="ticker-label">Latest</span>
        <div class="ticker-viewport"><div class="ticker-track" style="--dur:${Math.max(40, tick.length * 7)}s">${tickHTML}<span class="ticker-dup" aria-hidden="true">${tickHTML.replace(/<a /g, '<a tabindex="-1" ')}</span></div></div>
        <button type="button" class="ticker-pause" id="ticker-pause" aria-pressed="false">Pause</button>
      </div>
    </section>`;

    countUp($("#bal-val"), bal, 1, true);
    requestAnimationFrame(() => ($("#needle").style.left = `${50 + bal / 2}%`));
    $$("#ticker .ticker-track a").forEach((a) => a.addEventListener("click", () => T("ticker_click", { date: a.getAttribute("href").split("/")[2] })));
    $("#ticker-pause").addEventListener("click", (e) => {
      const p = $("#ticker").classList.toggle("paused");
      e.currentTarget.textContent = p ? "Play" : "Pause"; e.currentTarget.setAttribute("aria-pressed", p);
    });

    const st = { range: "all", mode: "endings" };
    const markers = H.key_events.map((k) => ({ i: k.i, label: `${fmtDate(k.date)} — ${k.title}` }));
    const layout = (W, Hh) => {
      if (isPhone()) {
        const hb = $(".hero").getBoundingClientRect(), f = $(".hero-filters"), c = $(".hero-card");
        const yt = f ? f.getBoundingClientRect().bottom - hb.top + 28 : 200;
        const yb = c ? c.getBoundingClientRect().top - hb.top - 34 : Hh - 330;
        return { x0: 0, xr: W - 10, yt, yb: Math.max(yt + 90, yb), todayTop: yt, labels: false };
      }
      const hb = $(".hero").getBoundingClientRect(), fb = $(".hero-filters").getBoundingClientRect(), pb = $(".hero-title p").getBoundingClientRect();
      return { x0: 0, xr: W - 268, yt: fb.bottom - hb.top + 10, yb: Hh - 105, todayTop: (!pb.height || pb.right > W - 268 - 12) ? fb.top - hb.top : pb.bottom - hb.top - 10, labels: true };
    };
    const describe = (s) => {
      if (S.C.endings[s.key]) return S.C.endings[s.key].short || S.C.endings[s.key].desc;
      const m = H.families_meta[s.key];
      return m ? `${m.tagline}. Average of ${S.series.filter((x) => x.family === s.key).map((x) => x.name).join(", ")}.` : "";
    };
    $$("#top3 span").forEach((sp) => sp.addEventListener("click", (ev) => {
      const s = S.series.find((x) => x.key === sp.dataset.k); const b = sp.getBoundingClientRect();
      ev.stopPropagation(); window.EGChart.note(s, describe(s), b.left, b.bottom + 40); T("definition_view", { ending: s.key, place: "phone_label" });
    }));
    let chart;
    const draw = () => {
      if (chart) { chart.destroy(); S.charts = S.charts.filter((c) => c !== chart); }
      const start = st.range === "all" ? 0 : Math.max(0, n - Number(st.range));
      const src = st.mode === "endings" ? S.series : S.famSeries;
      chart = window.EGChart.hero($("#hero-chart"), {
        dates: H.dates.slice(start), series: src.map((s) => ({ ...s, values: s.values.slice(start) })),
        headlines: H.headlines.slice(start), markers: markers.map((m) => ({ ...m, i: m.i - start })),
        label: "Line chart of the Plausibility Index for each ending over time. Use the arrow keys to read any day.",
        layout, describe, onNote: (s) => T("definition_view", { ending: s.key, place: "chart_label", mode: st.mode }),
        onClick: (i) => { T("chart_day_open", { date: H.dates[start + i], range: st.range, mode: st.mode }); location.hash = `#/summary/${H.dates[start + i]}`; },
      });
      S.charts.push(chart);
    };
    $$("#range button").forEach((b) => b.addEventListener("click", () => { st.range = b.dataset.r; T("chart_filter", { kind: "range", value: st.range }); $$("#range button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    $$("#mode button").forEach((b) => b.addEventListener("click", () => { st.mode = b.dataset.m; T("chart_filter", { kind: "view", value: st.mode }); $$("#mode button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    draw();
    watchChartView(st);
  }

    /* ================= PHONE HOME (≤ 760 px) — desktop never runs this ================= */
  function renderPhoneHome() {
    const H = S.H, n = N(), li = n - 1;
    const bal = last(H.balance), bal1 = li > 0 ? bal - H.balance[li - 1] : 0, bal7 = bal - H.balance[Math.max(0, li - 7)];
    const word = (v, up, down) => (v > 0.049 ? `${up} ${Math.abs(v).toFixed(1)}` : v < -0.049 ? `${down} ${Math.abs(v).toFixed(1)}` : "unchanged");
    const dShort = new Date(H.end + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
    const tick = [];
    for (let i = li; i >= Math.max(0, li - 13); i--) if (H.headlines[i]) tick.push(`<a href="#/summary/${H.dates[i]}"><time>${fmtDate(H.dates[i]).replace(/ \d{4}$/, "")}</time>${esc(H.headlines[i])}</a>`);
    const tickHTML = tick.join("");
    const st = { range: "all", mode: "endings", focus: null, day: null };
    S.phoneSt = st;
    const describe = (s) => {
      if (S.C.endings[s.key]) return S.C.endings[s.key].short || S.C.endings[s.key].desc;
      const m = H.families_meta[s.key];
      return m ? `${m.tagline}. Average of ${S.series.filter((x) => x.family === s.key).map((x) => x.name).join(", ")}.` : "";
    };

    view.innerHTML = `
    <div class="ph">
      <section class="ph-top" aria-label="Where humanity is heading with AI">
        <h1>Where Humanity is<br><i>heading with AI?</i></h1>
        <p>12 possible endings for humanity with AI, tracked daily</p>
        <div class="ph-filters" role="toolbar" aria-label="Chart options">
          <div class="seg" role="group" aria-label="Time range" id="range"><button type="button" data-r="30" aria-pressed="false">30D</button><button type="button" data-r="90" aria-pressed="false">90D</button><button type="button" data-r="all" aria-pressed="true">All</button></div>
          <span class="sep" aria-hidden="true"></span>
          <div class="seg" role="group" aria-label="Chart view" id="mode"><button type="button" data-m="families" aria-pressed="false">Families</button><button type="button" data-m="endings" aria-pressed="true">Endings</button></div>
        </div>
      </section>
      <div class="ph-chart" id="ph-chart"></div>
      <div class="ph-chips" id="ph-chips" role="group" aria-label="Lines on the chart. Tap one to focus it"></div>
      <p class="ph-def" id="ph-def" hidden></p>
      <section class="ph-day" id="ph-day" aria-live="polite" hidden></section>
      <section class="ph-card" aria-label="Horizon Balance today">
        <span class="kicker">Horizon Balance · ${dShort}</span>
        <div class="bal"><b id="bal-val">0.0</b><span>${word(bal1, "up", "down")} today<br>${word(bal7, "up", "down")} this week</span></div>
        <div class="gauge-scale" aria-hidden="true"><div class="gauge-needle" id="needle" style="left:50%"></div></div>
        <div class="gauge-ends"><span>Darker futures</span><span>Brighter futures</span></div>
      </section>
      <section class="ph-story" aria-label="Today's story">
        <span class="kicker">TODAY’S STORY · ${fmtDate(H.end).replace(/ \d{4}$/, "").toUpperCase()}</span>
        <h2>${esc(H.headlines[li] || "")}</h2>
        <a href="#/summary/${H.end}">Read the day ›</a>
      </section>
      <footer class="ph-foot"><span>Updated ${fmtDate(H.end).replace(/ \d{4}$/, "")}</span><a class="byline" href="https://www.linkedin.com/in/sidhartha-rajput/" target="_blank" rel="noopener noreferrer">By Sidhartha Rajput</a></footer>
      <div class="ticker ph-ticker" id="ticker">
        <span class="ticker-label">Latest</span>
        <div class="ticker-viewport"><div class="ticker-track" style="--dur:${Math.max(40, tick.length * 7)}s">${tickHTML}<span class="ticker-dup" aria-hidden="true">${tickHTML.replace(/<a /g, '<a tabindex="-1" ')}</span></div></div>
      </div>
    </div>`;

    countUp($("#bal-val"), bal, 1, true);
    requestAnimationFrame(() => ($("#needle").style.left = `${50 + bal / 2}%`));
    $$("#ticker .ticker-track a").forEach((a) => a.addEventListener("click", () => T("ticker_click", { date: a.getAttribute("href").split("/")[2] })));

    let chart, start = 0, src = S.series;
    const drawChips = () => {
      const items = src.slice().sort((a, b) => last(b.values) - last(a.values));
      $("#ph-chips").innerHTML = `<button type="button" class="chip ph-expand" id="ph-expand" aria-label="Open the chart full screen"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>Expand</button>` + items.map((s) => `<button type="button" class="chip ${s.cls}${st.focus && st.focus !== s.key ? " faded" : ""}" data-k="${s.key}" aria-pressed="${st.focus === s.key}"><i class="swatch"></i><b>${last(s.values).toFixed(1)}</b>${esc(s.name)}</button>`).join("");
      $("#ph-expand").addEventListener("click", () => openLandscape("button"));
      $$("#ph-chips .chip[data-k]").forEach((b) => b.addEventListener("click", () => {
        st.focus = st.focus === b.dataset.k ? null : b.dataset.k;
        if (st.focus) T("legend_focus", { ending: st.focus, mode: st.mode });
        draw(); if (st.focus) b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }));
      const def = $("#ph-def");
      if (st.focus) {
        const s = src.find((x) => x.key === st.focus);
        def.innerHTML = `<i class="${s.cls}"></i><span><b>${esc(s.name)}:</b> ${esc(describe(s))} <button type="button" id="ph-clear">Show all</button></span>`;
        def.hidden = false;
        $("#ph-clear").addEventListener("click", () => { st.focus = null; draw(); });
      } else def.hidden = true;
    };
    const drawDay = () => {
      const box = $("#ph-day"), i = st.day;
      if (i == null) { box.hidden = true; box.innerHTML = ""; return; }
      const gi = start + i, date = H.dates[gi];
      let rows = src.map((s) => ({ s, v: s.values[i], d: i > 0 ? s.values[i] - s.values[i - 1] : (gi > 0 ? (S.H.scores[s.key] || H.families[s.key])[gi] - (S.H.scores[s.key] || H.families[s.key])[gi - 1] : 0) }));
      rows.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      if (st.focus) { const f = rows.find((r) => r.s.key === st.focus); rows = [f, ...rows.filter((r) => r !== f)]; }
      rows = rows.slice(0, 3);
      box.innerHTML = `
        <div class="ph-day-top"><span>${new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "").toUpperCase()}</span><button type="button" class="ph-x" aria-label="Close the day">×</button></div>
        <h3>${esc(H.headlines[gi] || "No headline for this day")}</h3>
        <div class="ph-moves">${rows.map((r) => `<div class="${r.s.cls}"><i class="swatch"></i><span>${esc(r.s.name)}</span><b>${r.v.toFixed(1)}</b><em>${dtxt(r.d)}</em></div>`).join("")}</div>
        <a class="ph-open" href="#/summary/${date}">Open this day ›</a>`;
      box.hidden = false;
      $(".ph-x", box).addEventListener("click", () => { st.day = null; chart.mark(null); drawDay(); });
      $(".ph-open", box).addEventListener("click", () => T("chart_day_open", { date, range: st.range, mode: st.mode, place: "phone_panel" }));
    };
    const draw = () => {
      if (chart) { chart.destroy(); S.charts = S.charts.filter((c) => c !== chart); }
      start = st.range === "all" ? 0 : Math.max(0, n - Number(st.range));
      src = (st.mode === "endings" ? S.series : S.famSeries).map((s) => ({ ...s, values: s.values.slice(start) }));
      if (st.focus && !src.some((s) => s.key === st.focus)) st.focus = null;
      if (st.day != null && st.day >= src[0].values.length) st.day = null;
      const ph = Math.round(Math.max(210, Math.min(340, window.innerHeight - 460)));
      $("#ph-chart").style.height = ph + 30 + "px";
      chart = window.EGChart.phone($("#ph-chart"), {
        dates: H.dates.slice(start), series: src, focus: st.focus, height: ph,
        label: "Line chart of the Plausibility Index for each ending over time. Tap or use the arrow keys to read a day.",
        onDay: (i) => { const first = st.day == null && i != null; st.day = i; drawDay(); if (first) T("chart_day_tap", { date: H.dates[start + i], range: st.range, mode: st.mode }); },
      });
      if (st.day != null) chart.mark(st.day);
      S.charts.push(chart);
      drawChips(); drawDay();
    };
    $$("#range button").forEach((b) => b.addEventListener("click", () => { st.range = b.dataset.r; st.day = null; T("chart_filter", { kind: "range", value: st.range }); $$("#range button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    $$("#mode button").forEach((b) => b.addEventListener("click", () => { st.mode = b.dataset.m; st.focus = null; T("chart_filter", { kind: "view", value: st.mode }); $$("#mode button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    draw();
    watchChartView(st, $("#ph-chart"));
    if (phoneLandscapeNow()) openLandscape("rotate");
  }
  /* ================= PHONE: full-screen landscape chart (desktop never opens it) ================= */
  const LS = { el: null, chart: null, st: null, via: null, pushed: false, native: false, hintOff: false, closing: false };
  const isPortrait = () => window.innerHeight > window.innerWidth;
  const phoneLandscapeNow = () => matchMedia("(pointer: coarse)").matches && !isPortrait() && window.innerHeight <= 500;
  function openLandscape(via) {
    if (LS.el || !S.H) return;
    const from = S.phoneSt || {};
    LS.via = via; LS.native = false; LS.hintOff = false;
    LS.st = { range: from.range || "all", mode: from.mode || "endings", focus: from.focus || null, day: null };
    const el = document.createElement("div");
    el.className = "lsc"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Full-screen chart");
    const b = (k, v, t) => `<button type="button" data-${k}="${v}" aria-pressed="${LS.st[k === "r" ? "range" : "mode"] === v}">${t}</button>`;
    el.innerHTML = `
      <div class="lsc-stage" id="lsc-stage">
        <div class="lsc-bar">
          <div class="lsc-title">Where Humanity is <i>heading with AI?</i></div>
          <div class="lsc-filters" role="toolbar" aria-label="Chart options">
            <div class="seg" id="lsc-range">${b("r", "30", "30D")}${b("r", "90", "90D")}${b("r", "all", "All")}</div><span class="sep" aria-hidden="true"></span>
            <div class="seg" id="lsc-mode">${b("m", "families", "Families")}${b("m", "endings", "Endings")}</div>
          </div>
          <button type="button" class="lsc-x" aria-label="Close full-screen chart">×</button>
        </div>
        <div class="lsc-chart" id="lsc-chart"></div>
        <div class="lsc-foot" id="lsc-foot" aria-live="polite"></div>
      </div>
      <button type="button" class="lsc-hint" id="lsc-hint" hidden><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 9a9 9 0 0 1 4-5M21 15a9 9 0 0 1-4 5"/></svg>Turn your phone sideways<span>The chart is ready in landscape · tap to hide</span></button>`;
    document.body.appendChild(el);
    LS.el = el;
    document.documentElement.classList.add("lsc-open");
    $(".lsc-x", el).addEventListener("click", () => closeLandscape());
    $("#lsc-hint", el).addEventListener("click", () => { LS.hintOff = true; $("#lsc-hint", el).hidden = true; });
    $$("#lsc-range button", el).forEach((x) => x.addEventListener("click", () => { LS.st.range = x.dataset.r; LS.st.day = null; T("chart_filter", { kind: "range", value: LS.st.range, place: "landscape" }); $$("#lsc-range button", el).forEach((y) => y.setAttribute("aria-pressed", y === x)); drawLandscape(); }));
    $$("#lsc-mode button", el).forEach((x) => x.addEventListener("click", () => { LS.st.mode = x.dataset.m; LS.st.focus = null; T("chart_filter", { kind: "view", value: LS.st.mode, place: "landscape" }); $$("#lsc-mode button", el).forEach((y) => y.setAttribute("aria-pressed", y === x)); drawLandscape(); }));
    el.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeLandscape(); });
    try { history.pushState({ lsc: 1 }, ""); LS.pushed = true; } catch (e) { LS.pushed = false; }
    // Android Chrome: real full screen + landscape lock. iPhone: falls back to the turned layout.
    if (via === "button" && isPortrait() && el.requestFullscreen && screen.orientation && screen.orientation.lock) {
      el.requestFullscreen({ navigationUI: "hide" })
        .then(() => screen.orientation.lock("landscape"))
        .then(() => { LS.native = true; })
        .catch(() => {})
        .finally(() => { layoutLandscape(); T("chart_expand", { via, mode: LS.native ? "native" : isPortrait() ? "turned" : "landscape" }); });
    } else T("chart_expand", { via, mode: isPortrait() ? "turned" : "landscape" });
    layoutLandscape();
    $(".lsc-x", el).focus({ preventScroll: true });
  }
  function closeLandscape(fromPop) {
    if (!LS.el || LS.closing) return;
    LS.closing = true;
    if (LS.chart) LS.chart.destroy();
    LS.chart = null;
    LS.el.remove(); LS.el = null;
    document.documentElement.classList.remove("lsc-open");
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (LS.pushed && !fromPop) { LS.pushed = false; history.back(); }
    LS.pushed = false;
    setTimeout(() => (LS.closing = false), 50);
  }
  function layoutLandscape() {
    if (!LS.el) return;
    const stage = $("#lsc-stage", LS.el), hint = $("#lsc-hint", LS.el);
    const turned = isPortrait();
    LS.el.classList.toggle("turned", turned);
    if (turned) {
      stage.style.width = window.innerHeight + "px"; stage.style.height = window.innerWidth + "px";
      stage.style.transform = `translateX(${window.innerWidth}px) rotate(90deg)`;
    } else { stage.style.width = ""; stage.style.height = ""; stage.style.transform = ""; }
    hint.hidden = !turned || LS.hintOff;
    drawLandscape();
  }
  function drawLandscape() {
    if (!LS.el) return;
    const H = S.H, n = N(), st = LS.st;
    if (LS.chart) LS.chart.destroy();
    const start = st.range === "all" ? 0 : Math.max(0, n - Number(st.range));
    const src = (st.mode === "endings" ? S.series : S.famSeries).map((s) => ({ ...s, values: s.values.slice(start) }));
    if (st.focus && !src.some((s) => s.key === st.focus)) st.focus = null;
    if (st.day != null && st.day >= src[0].values.length) st.day = null;
    const describe = (s) => (S.C.endings[s.key] ? S.C.endings[s.key].short || S.C.endings[s.key].desc : H.families_meta[s.key] ? H.families_meta[s.key].tagline + "." : "");
    const foot = () => {
      const f = $("#lsc-foot", LS.el); if (!f) return;
      if (st.day == null) {
        if (st.focus) { const s = src.find((x) => x.key === st.focus); f.innerHTML = `<p class="lsc-def"><i class="${s.cls}"></i><span><b>${esc(s.name)}:</b> ${esc(describe(s))} <button type="button" id="lsc-all">Show all</button></span></p>`; $("#lsc-all", f).addEventListener("click", () => { st.focus = null; drawLandscape(); }); }
        else f.innerHTML = `<p class="lsc-tip">Tap or drag on the chart to read a day · tap a name to focus it</p>`;
        return;
      }
      const gi = start + st.day, date = H.dates[gi], i = st.day;
      const rows = src.map((s) => ({ s, v: s.values[i], d: i > 0 ? s.values[i] - s.values[i - 1] : 0 })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      const r = st.focus ? rows.find((x) => x.s.key === st.focus) : rows[0];
      f.innerHTML = `<div class="lsc-day"><span class="d">${new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "").toUpperCase()}</span><span class="h">${esc(H.headlines[gi] || "No headline for this day")}</span><span class="m ${r.s.cls}"><i class="swatch"></i>${esc(r.s.name)} <b>${r.v.toFixed(1)}</b> <em>${dtxt(r.d)}</em></span><a class="o" href="#/summary/${date}">Open ›</a></div>`;
      $(".o", f).addEventListener("click", (ev) => { ev.preventDefault(); T("chart_day_open", { date, range: st.range, mode: st.mode, place: "landscape" }); closeLandscape(true); LS.pushed = false; location.hash = `#/summary/${date}`; });
    };
    LS.chart = window.EGChart.wide($("#lsc-chart", LS.el), {
      dates: H.dates.slice(start), series: src, focus: st.focus, rotated: LS.el.classList.contains("turned"),
      label: "Full-screen line chart of the Plausibility Index. Tap or drag to read a day; tap a name to focus its line.",
      onDay: (i) => { const first = st.day == null; st.day = i; foot(); if (first) T("chart_day_tap", { date: H.dates[start + i], place: "landscape" }); },
      onLabel: (s) => { st.focus = st.focus === s.key ? null : s.key; if (st.focus) T("legend_focus", { ending: st.focus, mode: st.mode, place: "landscape" }); drawLandscape(); },
    });
    if (st.day != null) LS.chart.mark(st.day);
    foot();
  }
  window.addEventListener("popstate", () => { if (LS.el) closeLandscape(true); });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && LS.el && LS.native) closeLandscape(); });
  let lsRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(lsRaf);
    lsRaf = requestAnimationFrame(() => {
      const t = location.hash.replace(/^#\/?/, "").split("/")[0];
      const home = !t || t === "dashboard";
      if (LS.el) {
        if (LS.via === "rotate" && isPortrait()) closeLandscape();
        else layoutLandscape();
      } else if (home && phoneLandscapeNow() && S.phoneSt) openLandscape("rotate");
    });
  });



  // one "chart_viewed" event per visit once the chart has been on screen for 5 s
  function watchChartView(st, el = $("#hero-chart")) {
    if (!el || !window.IntersectionObserver) return;
    const t0 = performance.now();
    let shown = false, timer = null, sent = false;
    const arm = () => {
      clearTimeout(timer);
      if (!sent && shown && document.visibilityState === "visible") timer = setTimeout(() => {
        if (!document.body.contains(el)) return;
        sent = true; io.disconnect(); document.removeEventListener("visibilitychange", arm);
        T("chart_viewed", { seconds: 5, range: st.range, mode: st.mode, ms_since_load: Math.round(performance.now() - t0) });
      }, 5000);
    };
    const io = new IntersectionObserver((es) => { shown = es[0].intersectionRatio >= 0.5; arm(); }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    document.addEventListener("visibilitychange", arm);
    S.charts.push({ destroy() { clearTimeout(timer); io.disconnect(); document.removeEventListener("visibilitychange", arm); } });
  }

  /* ---------------- ending dialog ---------------- */
  async function openEnding(key) {
    T("ending_open", { ending: key, from: route.prev });
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
      <div><div class="eyebrow" style="margin-bottom:10px">Recipe: the world factors that drive it</div>${recipeHTML(sc.weights, s.cls)}</div>
      <div><div class="eyebrow" style="margin-bottom:10px">Biggest pushes in the last 30 days</div><div id="dlg-pushes" class="small muted">Loading…</div></div>`;
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

  /* ================= 12 ENDINGS (explainer) ================= */
  const GLYPH = {"libertarian_utopia": "<path d=\"M14 66H106\"/><path d=\"M45 26V66M75 26V66\" stroke-dasharray=\"3 4\" opacity=\".6\"/><g opacity=\"1\"><circle cx=\"29\" cy=\"41.6\" r=\"4.68\"/><path d=\"M20.55 59.8Q29 45.5 37.45 59.8\"/></g><circle cx=\"60\" cy=\"41.6\" r=\"4.7\"/><path d=\"M51.5 59.8Q60 45.5 68.5 59.8\"/><rect x=\"60\" y=\"36.5\" width=\"5.5\" height=\"10\" rx=\"1.5\" fill=\"currentColor\" fill-opacity=\".35\"/><circle cx=\"91\" cy=\"50\" r=\"9\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"91\" cy=\"50\" r=\"3.06\" fill=\"currentColor\" stroke=\"none\"/>", "benevolent_dictator": "<circle cx=\"60\" cy=\"24\" r=\"11\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"60\" cy=\"24\" r=\"3.74\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M52 10l3 4 5-5 5 5 3-4v6H52z\" fill=\"currentColor\" fill-opacity=\".35\"/><path d=\"M44 40l-10 12M60 40v12M76 40l10 12\" opacity=\".45\" stroke-dasharray=\"2 3\"/><g opacity=\"1\"><circle cx=\"24\" cy=\"58.0\" r=\"3.6\"/><path d=\"M17.5 72.0Q24 61.0 30.5 72.0\"/></g><g opacity=\"1\"><circle cx=\"42\" cy=\"58.0\" r=\"3.6\"/><path d=\"M35.5 72.0Q42 61.0 48.5 72.0\"/></g><g opacity=\"1\"><circle cx=\"60\" cy=\"58.0\" r=\"3.6\"/><path d=\"M53.5 72.0Q60 61.0 66.5 72.0\"/></g><g opacity=\"1\"><circle cx=\"78\" cy=\"58.0\" r=\"3.6\"/><path d=\"M71.5 72.0Q78 61.0 84.5 72.0\"/></g><g opacity=\"1\"><circle cx=\"96\" cy=\"58.0\" r=\"3.6\"/><path d=\"M89.5 72.0Q96 61.0 102.5 72.0\"/></g>", "egalitarian_utopia": "<path d=\"M12 70H108\"/><rect x=\"16\" y=\"54\" width=\"16\" height=\"16\" rx=\"2\" fill=\"currentColor\" fill-opacity=\".14\"/><g opacity=\"1\"><circle cx=\"24\" cy=\"31.2\" r=\"3.96\"/><path d=\"M16.85 46.6Q24 34.5 31.15 46.6\"/></g><rect x=\"40\" y=\"54\" width=\"16\" height=\"16\" rx=\"2\" fill=\"currentColor\" fill-opacity=\".14\"/><circle cx=\"48\" cy=\"38\" r=\"7\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"48\" cy=\"38\" r=\"2.38\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"64\" y=\"54\" width=\"16\" height=\"16\" rx=\"2\" fill=\"currentColor\" fill-opacity=\".14\"/><g opacity=\"1\"><circle cx=\"72\" cy=\"31.2\" r=\"3.96\"/><path d=\"M64.85 46.6Q72 34.5 79.15 46.6\"/></g><rect x=\"88\" y=\"54\" width=\"16\" height=\"16\" rx=\"2\" fill=\"currentColor\" fill-opacity=\".14\"/><circle cx=\"96\" cy=\"38\" r=\"7\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"96\" cy=\"38\" r=\"2.38\" fill=\"currentColor\" stroke=\"none\"/>", "protector_god": "<circle cx=\"60\" cy=\"42\" r=\"32\" stroke-dasharray=\"2 5\" opacity=\".55\"/><circle cx=\"60\" cy=\"42\" r=\"22\" stroke-dasharray=\"1 6\" opacity=\".35\"/><g opacity=\"1\"><circle cx=\"46\" cy=\"43.2\" r=\"3.96\"/><path d=\"M38.85 58.6Q46 46.5 53.15 58.6\"/></g><g opacity=\"1\"><circle cx=\"60\" cy=\"39.2\" r=\"3.96\"/><path d=\"M52.85 54.6Q60 42.5 67.15 54.6\"/></g><g opacity=\"1\"><circle cx=\"74\" cy=\"43.2\" r=\"3.96\"/><path d=\"M66.85 58.6Q74 46.5 81.15 58.6\"/></g><path d=\"M88 14l2 4 4 1-4 1-2 4-2-4-4-1 4-1z\" fill=\"currentColor\" stroke=\"none\" opacity=\".7\"/>", "gatekeeper": "<path d=\"M60 10V72\"/><path d=\"M60 18h6M54 28h6M60 38h6M54 48h6M60 58h6\" opacity=\".5\"/><path d=\"M32 22l12 4v12c0 9-6 14-12 17-6-3-12-8-12-17V26z\" fill=\"currentColor\" fill-opacity=\".14\"/><circle cx=\"32\" cy=\"38\" r=\"5\" fill=\"currentColor\" fill-opacity=\"0\"/><circle cx=\"32\" cy=\"38\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"94\" cy=\"40\" r=\"7\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"94\" cy=\"40\" r=\"2.38\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M84 40H70\" stroke-dasharray=\"3 3\"/><path d=\"M73 33l-7 14M66 33l7 14\" stroke-width=\"2.2\"/>", "enslaved_god": "<rect x=\"38\" y=\"16\" width=\"44\" height=\"50\" rx=\"4\" fill=\"currentColor\" fill-opacity=\".06\"/><path d=\"M49 16V66M60 16V66M71 16V66\" opacity=\".7\"/><circle cx=\"60\" cy=\"41\" r=\"11\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"60\" cy=\"41\" r=\"3.74\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"98\" cy=\"58\" r=\"5\"/><path d=\"M98 63v10M98 69h4\"/><path d=\"M20 30l8 4M18 44h9M20 58l8-4\" opacity=\".55\"/>", "conquerors": "<circle cx=\"86\" cy=\"28\" r=\"17\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"86\" cy=\"28\" r=\"5.78\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M66 40L30 66\" opacity=\".35\" stroke-dasharray=\"3 4\"/><g opacity=\"0.8\"><circle cx=\"22\" cy=\"58.0\" r=\"3.6\"/><path d=\"M15.5 72.0Q22 61.0 28.5 72.0\"/></g><g opacity=\"0.45\"><circle cx=\"38\" cy=\"62.0\" r=\"3.6\"/><path d=\"M31.5 76.0Q38 65.0 44.5 76.0\"/></g><g opacity=\"0.18\"><circle cx=\"54\" cy=\"64.0\" r=\"3.6\"/><path d=\"M47.5 78.0Q54 67.0 60.5 78.0\"/></g>", "descendants": "<g opacity=\"1\"><circle cx=\"18\" cy=\"42.4\" r=\"4.32\"/><path d=\"M10.2 59.2Q18 46.0 25.8 59.2\"/></g><path d=\"M28 46C46 46 50 26 70 22M28 46C50 46 56 44 76 44M28 46C46 46 50 64 70 68\" /><circle cx=\"78\" cy=\"22\" r=\"6\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"78\" cy=\"22\" r=\"2.04\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"86\" cy=\"44\" r=\"8\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"86\" cy=\"44\" r=\"2.72\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"78\" cy=\"68\" r=\"6\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"78\" cy=\"68\" r=\"2.04\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M100 44h8M104 40v8\" opacity=\".5\"/>", "zookeeper": "<circle cx=\"60\" cy=\"18\" r=\"10\" fill=\"currentColor\" fill-opacity=\"0.16\"/><circle cx=\"60\" cy=\"18\" r=\"3.4\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"24\" y=\"40\" width=\"72\" height=\"32\" rx=\"3\" fill=\"currentColor\" fill-opacity=\".06\"/><path d=\"M36 40V72\" opacity=\".55\"/><path d=\"M48 40V72\" opacity=\".55\"/><path d=\"M60 40V72\" opacity=\".55\"/><path d=\"M72 40V72\" opacity=\".55\"/><path d=\"M84 40V72\" opacity=\".55\"/><g opacity=\"1\"><circle cx=\"42\" cy=\"56.0\" r=\"3.6\"/><path d=\"M35.5 70.0Q42 59.0 48.5 70.0\"/></g><g opacity=\"1\"><circle cx=\"78\" cy=\"56.0\" r=\"3.6\"/><path d=\"M71.5 70.0Q78 59.0 84.5 70.0\"/></g><path d=\"M52 26l-14 12M68 26l14 12\" opacity=\".35\" stroke-dasharray=\"2 3\"/>", "orwell_1984": "<path d=\"M40 22Q60 6 80 22Q60 38 40 22z\" fill=\"currentColor\" fill-opacity=\".12\"/><circle cx=\"60\" cy=\"22\" r=\"5\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M50 32L30 52M60 34v16M70 32l20 20\" opacity=\".4\" stroke-dasharray=\"2 3\"/><g opacity=\"1\"><circle cx=\"24\" cy=\"60.8\" r=\"3.24\"/><path d=\"M18.15 73.4Q24 63.5 29.85 73.4\"/></g><g opacity=\"1\"><circle cx=\"42\" cy=\"60.8\" r=\"3.24\"/><path d=\"M36.15 73.4Q42 63.5 47.85 73.4\"/></g><g opacity=\"1\"><circle cx=\"60\" cy=\"60.8\" r=\"3.24\"/><path d=\"M54.15 73.4Q60 63.5 65.85 73.4\"/></g><g opacity=\"1\"><circle cx=\"78\" cy=\"60.8\" r=\"3.24\"/><path d=\"M72.15 73.4Q78 63.5 83.85 73.4\"/></g><g opacity=\"1\"><circle cx=\"96\" cy=\"60.8\" r=\"3.24\"/><path d=\"M90.15 73.4Q96 63.5 101.85 73.4\"/></g><circle cx=\"104\" cy=\"20\" r=\"7\" opacity=\".6\"/><path d=\"M99 15l10 10\" opacity=\".6\"/>", "reversion": "<path d=\"M10 44H34\"/><rect x=\"34\" y=\"36\" width=\"12\" height=\"16\" rx=\"2\" fill=\"currentColor\" fill-opacity=\".14\"/><path d=\"M46 40h5M46 48h5\"/><path d=\"M60 38l3 4-3 4 3 4\" opacity=\".6\"/><rect x=\"68\" y=\"34\" width=\"8\" height=\"20\" rx=\"2\" opacity=\".6\"/><path d=\"M88 70V52\"/><path d=\"M88 58c0-8 6-12 14-12 0 8-6 12-14 12zM88 62c0-6-5-9-11-9 0 6 5 9 11 9z\" fill=\"currentColor\" fill-opacity=\".2\"/><path d=\"M74 70H108\"/>", "self_destruction": "<circle cx=\"60\" cy=\"42\" r=\"22\" fill=\"currentColor\" fill-opacity=\".1\"/><path d=\"M60 20l-5 12 8 6-6 10 4 16\" stroke-width=\"2\"/><path d=\"M42 30c8 4 12 4 14 2M64 46c6 2 12 0 17-4\" opacity=\".5\"/><path d=\"M92 18l6-6M98 30h8M28 18l-6-6M22 30h-8M92 66l6 6M28 66l-6 6\" opacity=\".6\"/>"};
  const FICON = {"F1": "<path d=\"M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10z\"/><path d=\"M9 16l-2 4M15 16l2 4\"/><circle cx=\"12\" cy=\"10\" r=\"1.6\"/>", "F2": "<rect x=\"5\" y=\"8\" width=\"14\" height=\"11\" rx=\"3\"/><path d=\"M12 8V4\"/><circle cx=\"12\" cy=\"3.5\" r=\"1\"/><circle cx=\"9.5\" cy=\"13\" r=\"1\"/><circle cx=\"14.5\" cy=\"13\" r=\"1\"/>", "F3": "<path d=\"M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z\"/><path d=\"M9 12l2 2 4-4\"/>", "F4": "<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16\"/>", "F5": "<path d=\"M4 18h16l1-10-5 4-4-6-4 6-5-4z\"/>", "F6": "<path d=\"M3 12q9-9 18 0q-9 9-18 0z\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\"/>", "F7": "<ellipse cx=\"10\" cy=\"8\" rx=\"6\" ry=\"2.5\"/><path d=\"M4 8v4c0 1.4 2.7 2.5 6 2.5M4 12v4c0 1.4 2.7 2.5 6 2.5\"/><ellipse cx=\"15\" cy=\"15\" rx=\"5\" ry=\"2\"/><path d=\"M10 15v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3\"/>", "F8": "<path d=\"M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-6 2 1 3 2 3 4 1-3 1-6 1-9z\"/>", "F9": "<path d=\"M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-3 7-6 7s-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 13\"/>", "F10": "<path d=\"M10 14l4-4\"/><path d=\"M8 11l-2 2a3 3 0 0 0 4 4l2-2M16 13l2-2a3 3 0 0 0-4-4l-2 2\"/>"};
  const FSHORT = { F1: "Capability", F2: "Autonomy", F3: "Alignment", F4: "Coordination", F5: "Power in few hands", F6: "Surveillance", F7: "Shared wealth", F8: "Catastrophe risk", F9: "Backlash", F10: "Human–AI merging" };
  const FTINY = { F1: "Capability", F2: "Autonomy", F3: "Alignment", F4: "Coordination", F5: "Power", F6: "Surveillance", F7: "Shared wealth", F8: "Catastrophe", F9: "Backlash", F10: "Merging" };
  // x: humans in charge (0) → AI in charge (1); y: bad for humans (0) → good (1). Editorial placement.
  const MAP_POS = { egalitarian_utopia: [.14, .84], libertarian_utopia: [.4, .95], protector_god: [.76, .82], benevolent_dictator: [.9, .66],
    gatekeeper: [.6, .49], enslaved_god: [.2, .54], reversion: [.42, .32], descendants: [.84, .38],
    orwell_1984: [.12, .2], self_destruction: [.36, .08], zookeeper: [.72, .2], conquerors: [.92, .08] };
  const MAP_SIDE = { conquerors: "l", benevolent_dictator: "l", protector_god: "l", descendants: "l" };
  const MAP_POS_PH = Object.assign({}, MAP_POS, { egalitarian_utopia: [.1, .88], protector_god: [.78, .84], libertarian_utopia: [.38, .97], benevolent_dictator: [.9, .7], gatekeeper: [.6, .56], self_destruction: [.3, .07], descendants: [.86, .4], reversion: [.36, .3] });
  const MAP_SIDE_PH = Object.assign({}, MAP_SIDE, { conquerors: "u", zookeeper: "l" });
  const QUESTIONS = [
    ["Does <i>superintelligence</i> ever get built?", "stalled", "NO"],
    ["Do humans keep it <i>on a leash?</i>", "contained", "YES"],
    ["Is its world <i>good for us?</i>", "flourishing", "YES", "successors", "NO"],
  ];
  const glyphSVG = (k, w, h) => `<svg class="eg-glyph" width="${w}" height="${h}" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[k]}</svg>`;
  const ficonSVG = (f, s = 16) => `<svg class="eg-ficon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FICON[f]}</svg>`;
  function miniSpark(vals, w, h) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1.5) { const m = (hi + lo) / 2; lo = m - .75; hi = m + .75; }
    const pts = vals.map((v, i) => [i / (vals.length - 1) * (w - 4) + 1, h - 3 - (v - lo) / (hi - lo) * (h - 6)]);
    const [x, y] = pts[pts.length - 1];
    return `<svg class="eg-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${window.EGChart.monotonePath(pts)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/></svg>`;
  }

  function renderEndings() {
    const H = S.H, R = S.R, C = S.C, n = N() - 1, phone = isPhone();
    const keys = S.series.map((s) => s.key);
    const fam = (k) => H.scenarios[k].family;
    const now = (k) => H.scores[k][n];
    const ser30 = (k) => H.scores[k].slice(Math.max(0, n - 29));
    const d30 = (k) => now(k) - H.scores[k][Math.max(0, n - 29)];
    const famOf = (f) => keys.filter((k) => fam(k) === f);
    const mono = (v) => v.toFixed(1);

    // --- map of endings
    const POS = phone ? MAP_POS_PH : MAP_POS, SIDE = phone ? MAP_SIDE_PH : MAP_SIDE;
    const rad = (k) => (phone ? 6 + now(k) * 0.55 : 9 + now(k) * 0.95);
    const bubbles = keys.slice().sort((a, b) => now(b) - now(a)).map((k) => {
      const [x, y] = POS[k], r = rad(k);
      return `<a class="em-b c-${fam(k)}" href="#/ending/${k}" data-k="${k}" style="left:${x * 100}%;top:${(1 - y) * 100}%;width:${2 * r}px;height:${2 * r}px" aria-label="${esc(C.endings[k].name)}, ${mono(now(k))}">${r >= (phone ? 13 : 17) ? Math.round(now(k)) : ""}</a>`;
    }).join("");
    const labels = keys.map((k) => {
      const [x, y] = POS[k], r = rad(k), side = SIDE[k] || "r", nm = esc(C.endings[k].name);
      if (side === "u") return `<span class="em-l" style="right:calc(${100 - x * 100}% - ${r}px);top:calc(${(1 - y) * 100}% - ${r + 18}px)">${nm}</span>`;
      if (side === "l") return `<span class="em-l" style="right:calc(${100 - x * 100}% + ${r + 6}px);top:${(1 - y) * 100}%">${nm}</span>`;
      return `<span class="em-l" style="left:calc(${x * 100}% + ${r + 6}px);top:${(1 - y) * 100}%">${nm}</span>`;
    }).join("");
    const map = `<div class="em-card">
      <div class="em-top"><h2>The map of endings</h2><span>${phone ? "SIZE = SCORE" : "BUBBLE SIZE = TODAY’S SCORE"}</span></div>
      <div class="em">
        <span class="em-y"><b class="g">GOOD FOR HUMANS ↑</b><b class="b">↓ BAD FOR HUMANS</b></span>
        <div class="em-plot">${bubbles}${labels}</div>
        <span class="em-x"><span>← HUMANS IN CHARGE</span><span>AI IN CHARGE →</span></span>
      </div></div>`;

    const pills = FAMILY_ORDER.map((f) => `<div class="et-pill c-${f}"><i class="swatch"></i><span><b>${esc(R.families[f].name)} <small>· ${famOf(f).length}</small></b><span>${esc(R.families[f].tagline)}</span></span></div>`).join("");

    // --- decision tree (horizontal on wide screens, vertical otherwise)
    const leafChips = (f, w, h) => famOf(f).map((k) => `<a class="et-chip" href="#/ending/${k}" data-k="${k}">${glyphSVG(k, w, h)}<span>${esc(C.endings[k].name)}</span></a>`).join("");
    const leaf = (f, cls = "") => `<div class="et-leaf c-${f} ${cls}"><span class="et-ln"><i class="swatch"></i>${esc(R.families[f].name)}</span><div class="et-chips">${leafChips(f, 57, 38)}</div></div>`;
    const TW = 1200, LW = 400, LH = 96, GAP = 18, lx = TW - LW;
    const cy = [0, 1, 2, 3].map((i) => i * (LH + GAP) + LH / 2), TH = 3 * (LH + GAP) + LH;
    const qs = [[0, 210, (cy[0] + cy[3]) / 2], [280, 210, (cy[1] + cy[3]) / 2 + 6], [530, 220, (cy[2] + cy[3]) / 2]];
    const curve = (x1, y1, x2, y2) => { const m = (x1 + x2) / 2; return `<path d="M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}"/>`; };
    const E = qs.map((q) => q[0] + q[1]);
    const edges = [[E[0], qs[0][2], lx, cy[0], "NO"], [E[0], qs[0][2], qs[1][0], qs[1][2], "YES"], [E[1], qs[1][2], lx, cy[1], "YES"],
      [E[1], qs[1][2], qs[2][0], qs[2][2], "NO"], [E[2], qs[2][2], lx, cy[2], "YES"], [E[2], qs[2][2], lx, cy[3], "NO"]];
    const treeH = `<div class="et-tree-h" style="height:${TH}px">
      <svg width="${TW}" height="${TH}" viewBox="0 0 ${TW} ${TH}" aria-hidden="true">${edges.map((e) => curve(...e.slice(0, 4))).join("")}</svg>
      ${qs.map((q, i) => `<div class="et-q" style="left:${q[0]}px;top:${q[2] - 39}px;width:${q[1]}px"><span>${QUESTIONS[i][0]}</span></div>`).join("")}
      ${edges.map(([x1, y1, x2, y2, t]) => { let x = (x1 + x2) / 2 - 16, y = (y1 + y2) / 2 - 10; if (x2 === lx && x1 > 500) { x = lx - 46; y = y2 - 22; } return `<span class="et-yn" style="left:${x}px;top:${y}px">${t}</span>`; }).join("")}
      ${["stalled", "contained", "flourishing", "successors"].map((f, i) => `<div style="position:absolute;left:${lx}px;top:${i * (LH + GAP)}px;width:${LW}px;height:${LH}px">${leaf(f)}</div>`).join("")}
    </div>`;
    const treeV = `<div class="et-tree-v">
      <div class="et-q"><span>${QUESTIONS[0][0]}</span></div>${`<div class="et-vrow"><span class="et-yn">NO</span>${leaf("stalled")}</div>`}
      <span class="et-down">YES ↓</span>
      <div class="et-q"><span>${QUESTIONS[1][0]}</span></div><div class="et-vrow"><span class="et-yn">YES</span>${leaf("contained")}</div>
      <span class="et-down">NO ↓</span>
      <div class="et-q"><span>${QUESTIONS[2][0]}</span></div><div class="et-vrow"><span class="et-yn">YES</span>${leaf("flourishing")}</div><div class="et-vrow"><span class="et-yn">NO</span>${leaf("successors")}</div>
    </div>`;

    // --- ending cards
    const recipe = (k) => Object.entries(R.scenarios[k].weights).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([f, v]) =>
      `<div class="er-row ${v > 0 ? "up" : "down"}" title="${esc(R.factors[f].name)}: ${v > 0 ? "rising pushes this ending up" : "rising pulls this ending down"}">${ficonSVG(f, 15)}<span class="er-n">${esc(FSHORT[f])}</span><span class="er-bar"><i style="width:${(Math.abs(v) / 0.55 * 100).toFixed(0)}%"></i></span><span class="er-a">${v > 0 ? "▲" : "▼"}</span></div>`).join("");
    const card = (k) => {
      const e = C.endings[k], dd = d30(k), cl = dd > 0.05 ? "up" : dd < -0.05 ? "down" : "flat";
      return `<a class="ec c-${fam(k)}" href="#/ending/${k}" data-k="${k}">
        <div class="ec-art"><span class="ec-num">${String(e.num).padStart(2, "0")}</span>${glyphSVG(k, 138, 92)}</div>
        <div class="ec-body">
          <h3>${esc(e.name)}</h3>
          <p>${esc(e.short || e.desc)}</p>
          <div class="ec-score"><span class="ec-v"><b>${mono(now(k))}</b><small>today</small></span>${miniSpark(ser30(k), 84, 26)}<span class="ec-d ${cl}">${dd > 0.05 ? "▲" : dd < -0.05 ? "▼" : "•"} ${Math.abs(dd).toFixed(1)}<small>30 days</small></span></div>
          <div class="ec-k">WHAT MOVES IT</div>
          <div class="er">${recipe(k)}</div>
          <span class="ec-more">Full story →</span>
        </div></a>`;
    };
    const famSections = FAMILY_ORDER.map((f) => `<section class="ef c-${f}" data-fam="${f}" aria-label="${esc(R.families[f].name)}">
        <header class="ef-h"><i class="swatch"></i><h3>${esc(R.families[f].name)}</h3><span>${esc(R.families[f].tagline)}</span><b>FAMILY INDEX ${mono(H.families[f][n])}</b></header>
        <div class="ef-grid">${famOf(f).map(card).join("")}</div></section>`).join("");
    const chips = FAMILY_ORDER.map((f, i) => `<button type="button" class="ef-chip c-${f}" data-fam="${f}" aria-pressed="${i === 0}"><i class="swatch"></i>${esc(R.families[f].name)}</button>`).join("");

    // --- recipe matrix
    const F = Object.keys(R.factors);
    const fx = (f) => H.factors && H.factors[f] ? H.factors[f] : null;
    const head = `<span></span>${keys.map((k) => `<span class="mx-h c-${fam(k)}"><span>${esc(C.endings[k].name)}</span><i class="swatch"></i></span>`).join("")}<span class="mx-lvh">WORLD TODAY</span>`;
    const rows = F.map((f) => {
      const lv = fx(f);
      const cells = keys.map((k) => {
        const v = R.scenarios[k].weights[f] || 0;
        if (!v) return `<span class="mx-c"><i class="mx-dot"></i></span>`;
        return `<span class="mx-c c-${fam(k)}" title="${esc(C.endings[k].name)} · ${esc(R.factors[f].name)}: ${v > 0 ? "pushes up" : "pulls down"}"><i class="mx-sq ${v > 0 ? "up" : "down"}" style="--s:${(0.45 + Math.abs(v) / 0.55 * 0.55).toFixed(2)}">${v > 0 ? "▲" : "▼"}</i></span>`;
      }).join("");
      const lvl = lv ? `<span class="mx-lv"><span class="mx-bar"><i style="width:${lv[lv.length - 1].toFixed(0)}%"></i><b style="left:${lv[0].toFixed(0)}%"></b></span><small>${lv[lv.length - 1].toFixed(0)}</small></span>` : `<span class="mx-lv"></span>`;
      return `<span class="mx-f">${ficonSVG(f, 16)}<span class="lg">${esc(R.factors[f].name)}</span><span class="sm">${esc(FTINY[f])}</span></span>${cells}${lvl}`;
    }).join("");

    const head2 = (eb, t, sub, id) => `<div class="et-head"><span class="et-eb">${eb}</span><h2 id="${id}">${t}</h2>${sub ? `<p>${sub}</p>` : ""}</div>`;
    view.innerHTML = `
    <div class="et reveal">
      <section class="et-hero">
        <div class="et-intro">
          <span class="et-eb">FROM MAX TEGMARK’S <i>LIFE 3.0</i></span>
          <h1>Twelve ways the <i>AI story could end</i></h1>
          <p>Four families, twelve futures. Here is what each one is, where it sits, and what pushes it up or down.</p>
          <div class="et-pills">${pills}</div>
        </div>
        ${map}
      </section>

      <section aria-labelledby="et-tree-h">
        ${head2("HOW THE FAMILIES SPLIT", "Three questions <i>sort all twelve</i>", "", "et-tree-h")}
        ${treeH}${treeV}
      </section>

      <section aria-labelledby="et-cards-h">
        ${head2("THE TWELVE, ONE BY ONE", "Meet <i>each ending</i>", "Coloured bars push an ending up, grey bars pull it down. Select a card for its full story and evidence.", "et-cards-h")}
        <div class="ef-chips" role="group" aria-label="Show family">${chips}</div>
        <div class="ef-wrap" data-show="flourishing">${famSections}</div>
      </section>

      <section aria-labelledby="et-mx-h">
        ${head2("WHY THEY MOVE", "Every ending is a <i>recipe of world forces</i>", "News never moves an ending directly. It nudges ten world forces, and each ending is built from three or four of them.", "et-mx-h")}
        <div class="et-flow"><div><span class="big">≈</span><span><b>News &amp; research</b><small>scored every night</small></span></div><span class="ar">→</span><div><span class="big">10</span><span><b>world forces</b><small>nudged up or down</small></span></div><span class="ar">→</span><div><span class="big">12</span><span><b>endings</b><small>each a fixed recipe</small></span></div></div>
        <div class="mx-card"><div class="mx">${head}${rows}</div>
          <div class="mx-key"><span><i class="k up"></i>Force rising pushes the ending up</span><span><i class="k down"></i>Force rising pulls it down</span><span>Bigger square = stronger pull</span><span class="mx-k-lv">World today: 0–100, tick = where it started in April</span></div>
        </div>
      </section>

      <section aria-labelledby="et-why-h">
        ${head2("WHY THESE TWELVE", "Where the endings <i>come from</i>", "", "et-why-h")}
        <div class="et-why">
          <div><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/></svg><span><b>From <i>Life 3.0</i></b>Max Tegmark, MIT physicist, 2017. Twelve “aftermath” scenarios for a world with superintelligent AI.</span></div>
          <div><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4M12 16h.01"/></svg><span><b>Thought experiments</b>Not predictions. Together they cover the main ways the future could go.</span></div>
          <div><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/></svg><span><b>Scored independently</b>Each ending reads 1–99 on its own. The twelve do not add up to 100.</span></div>
        </div>
      </section>
    </div>`;

    const wrap = $(".ef-wrap", view);
    $$(".ef-chip", view).forEach((b) => b.addEventListener("click", () => {
      $$(".ef-chip", view).forEach((x) => x.setAttribute("aria-pressed", x === b));
      wrap.dataset.show = b.dataset.fam;
      T("endings_family_chip", { family: b.dataset.fam });
    }));
    view.querySelector(".et").addEventListener("click", (e) => {
      const a = e.target.closest("a[data-k]");
      if (a) T("endings_open", { ending: a.dataset.k, place: a.classList.contains("em-b") ? "map" : a.classList.contains("et-chip") ? "tree" : "card" });
    });
  }

  /* ================= SUMMARY ================= */
  const TIER_WORD = { T1: "minor", T2: "notable", T3: "major", T4: "landmark" };
  function sparkSVG(values, cls) {
    const W = 120, Hh = 28, n = values.length;
    let lo = Math.min(...values), hi = Math.max(...values);
    if (hi - lo < 1.5) { const m = (hi + lo) / 2; lo = m - 0.75; hi = m + 0.75; }
    const x = (i) => (n === 1 ? W : (i / (n - 1)) * W), y = (v) => 26 - ((v - lo) / (hi - lo)) * 22;
    const d = window.EGChart.monotonePath(values.map((v, i) => [x(i), y(v)]));
    return `<svg class="sspark ${cls}" width="120" height="28" viewBox="0 0 120 28" aria-hidden="true"><path d="${d}"/><circle cx="${W}" cy="${y(values[n - 1]).toFixed(1)}" r="2.5"/></svg>`;
  }
  // Summary opens on the day before yesterday (India time); falls back to the latest published day before that.
  function defaultSummaryDate() {
    const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCDate(d.getUTCDate() - 2);
    const t = d.toISOString().slice(0, 10), ok = S.H.dates.filter((x) => x <= t);
    return ok.length ? ok[ok.length - 1] : S.H.dates[0];
  }
  async function renderSummary(date) {
    const H = S.H;
    if (!date || !H.dates.includes(date)) date = defaultSummaryDate();
    const i = H.dates.indexOf(date);
    view.innerHTML = `<div class="wrap"><div class="loading"><span class="spinner"></span> Loading ${fmtDate(date)}…</div></div>`;
    let d;
    try { d = await getDay(date); } catch { view.innerHTML = `<div class="wrap"><p class="loading">Could not load this day.</p></div>`; return; }
    if (location.hash.replace(/^#\/?/, "").split("/")[0] !== "summary") return;
    const sm = d.summary || {};
    const prev = i > 0 ? H.dates[i - 1] : null, next = i < N() - 1 ? H.dates[i + 1] : null;
    const balPrev = i > 0 ? H.balance[i - 1] : H.balance[i], balD = H.balance[i] - balPrev;
    const at = (k, j) => S.H.scores[k][Math.max(0, Math.min(i, j))];
    const d1 = (k) => (i > 0 ? at(k, i) - at(k, i - 1) : 0);
    const d7 = (k) => at(k, i) - at(k, i - 7);
    const famNow = FAMILY_ORDER.map((f) => ({ f, v: H.families[f][i] })).sort((a, b) => b.v - a.v);
    const famPrev = i > 0 ? FAMILY_ORDER.slice().sort((a, b) => H.families[b][i - 1] - H.families[a][i - 1])[0] : famNow[0].f;
    const famNote = famPrev !== famNow[0].f ? `${famName(famNow[0].f)} moved above ${famName(famPrev)} as the leading family.` : `${famName(famNow[0].f)} remains the leading family.`;
    const short = (t) => (t.length > 46 ? t.slice(0, 44).replace(/\s+\S*$/, "") + "…" : t);

    // what moved each ending today (biggest event contributions)
    const pushes = {};
    S.series.forEach((s) => {
      pushes[s.key] = d.events.map((e) => ({ e, v: (e.contribution || {})[s.key] || 0 })).filter((x) => Math.abs(x.v) >= 0.01).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    });
    const whyRow = (k) => {
      const p = pushes[k];
      if (!p.length || Math.abs(d1(k)) < 0.05) return "Little changed today";
      return p.slice(0, 2).map((x) => `${short(x.e.title)} ${dtxt(x.v, 2)}`).join(" · ");
    };
    // movers: three biggest daily moves, explained from the written note when possible
    const movers = S.series.map((s) => ({ s, v: d1(s.key) })).filter((m) => Math.abs(m.v) >= 0.05).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 3);
    const noteFor = (s) => {
      const parts = (sm.movers_note || "").split(/(?<=\.)\s+(?=[A-Z0-9])/);
      const hit = parts.find((p) => p.startsWith(s.name + " "));
      if (hit) { const t = hit.replace(/^[^,]*,\s*/, ""); return cap(t); }
      const p = pushes[s.key].slice(0, 2);
      return p.length ? `From ${p.map((x) => `${x.e.title} (${dtxt(x.v, 2)})`).join(" and ")}.` : "Earlier news fading.";
    };
    const tiers = {};
    d.events.forEach((e) => (tiers[e.tier] = (tiers[e.tier] || 0) + 1));
    const tierLine = Object.keys(tiers).sort().reverse().map((t) => `${tiers[t]} ${TIER_WORD[t] || ""} (${t})`).join(", ");
    const fxLine = (e) => {
      const fe = Object.entries(e.factor_effect || {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      return fe.length ? fe.map(([f, v]) => `${esc(S.R.factors[f]?.name || f)} ${dtxt(v, 2)}`).join(" · ") : e.factors.map((f) => `${f.dir > 0 ? "↑" : "↓"} ${esc(S.R.factors[f.id].name)}`).join(" · ");
    };
    const coming = (sm.coming_up || []).map((c) => { const m = c.match(/^([^:]{2,24}):\s*(.+)$/); return m ? [m[1], m[2]] : ["", c]; });
    const fmtUpper = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(",", "").toUpperCase();

    view.innerHTML = `
    <div class="sum reveal">
      <header class="sum-head">
        <div class="sum-intro">
          <div class="sum-date">
            <a class="round" ${prev ? `href="#/summary/${prev}"` : 'aria-disabled="true"'} aria-label="Previous day">‹</a>
            <span>${fmtUpper}</span>
            <a class="round" ${next ? `href="#/summary/${next}"` : 'aria-disabled="true"'} aria-label="Next day">›</a>
            ${date !== H.end ? `<a class="sum-latest" href="#/summary/${H.end}">Latest</a>` : ""}
          </div>
          <h1>${esc(sm.headline || H.headlines[i] || "No summary written for this day")}</h1>
          ${(sm.body || "").split(/\n\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("")}
          ${(d.badges || []).length ? `<div class="badges">${d.badges.map(badgeHTML).join("")}</div>` : ""}
        </div>
        <aside class="sum-bal">
          <div class="k">Horizon Balance</div>
          <div class="bal"><b>${fmtSigned(H.balance[i], 1)}</b><span>${i > 0 ? `${balD > 0.049 ? "up" : balD < -0.049 ? "down" : "unchanged"}${Math.abs(balD) > 0.049 ? " " + Math.abs(balD).toFixed(1) : ""} from ${fmtSigned(balPrev, 1)}` : "first day tracked"}</span></div>
          <div class="gauge-scale" aria-hidden="true"><div class="gauge-needle" style="left:${50 + H.balance[i] / 2}%"></div></div>
          <div class="fams">${famNow.map(({ f, v }) => `<span class="c-${f}"><i class="swatch"></i>${esc(famName(f))}<b>${v.toFixed(1)}</b></span>`).join("")}</div>
          <p>${esc(famNote)}</p>
        </aside>
      </header>

      ${movers.length ? `<div class="sum-movers">${movers.map(({ s, v }) => `<a class="mover ${s.cls}" href="#/ending/${s.key}"><span class="k"><i class="swatch"></i>Biggest mover</span><span class="row"><span class="n">${esc(s.name)}</span><span class="v">${dtxt(v)}</span></span><span class="why">${esc(noteFor(s))}</span></a>`).join("")}</div>` : ""}

      <div class="sum-cols">
        <section aria-labelledby="reading-h">
          <div class="reading-head"><h2 id="reading-h">Today’s reading, <i>ending by ending</i></h2></div>
          <div class="rrow rhead" aria-hidden="true"><span></span><span></span><span>LAST 30 DAYS</span><span>SCORE</span><span>TODAY</span><span>7 DAYS</span></div>
          ${FAMILY_ORDER.map((f) => {
            const items = S.series.filter((s) => s.family === f);
            return `<div class="rfam c-${f}"><i class="swatch"></i><h3>${esc(famName(f))}</h3><span class="m">${items.length} endings · family index</span><b>${H.families[f][i].toFixed(1)}</b></div>` +
              items.map((s) => {
                const v1 = d1(s.key), big = Math.abs(v1) >= 0.5;
                return `<a class="rrow ${s.cls}" href="#/ending/${s.key}">
                  <span class="rname"><b>${esc(s.name)}</b><small>${esc(whyRow(s.key))}</small></span>
                  <span class="rdesc" title="${esc(S.C.endings[s.key].desc)}">${esc(S.C.endings[s.key].desc)}</span>
                  ${sparkSVG(S.H.scores[s.key].slice(Math.max(0, i - 29), i + 1), s.cls)}
                  <span class="rs">${at(s.key, i).toFixed(1)}</span>
                  <span class="rd ${big ? "big" : ""}">${dtxt(v1)}</span>
                  <span class="rd">${dtxt(d7(s.key))}</span>
                </a>`;
              }).join("");
          }).join("")}
          <p class="rnote">Scores are independent 0–100 likelihood readings, so they do not add up to 100. Select any ending for its full story and evidence.</p>
        </section>

        <aside class="sum-side">
          <section aria-labelledby="happened-h">
            <h2 id="happened-h">What happened</h2>
            <div class="m">${d.events.length ? `${d.events.length} ${d.events.length === 1 ? "story" : "stories"} scored · ${tierLine}` : "No qualifying events today. Scores only drifted as earlier news faded."}</div>
            <ol class="evlist">${d.events.slice().sort((a, b) => b.points - a.points).map((e, k) => `
              <li>
                <span class="num">${String(k + 1).padStart(2, "0")}</span>
                <div>
                  <div class="tags"><span class="tier ${e.tier >= "T2" ? "hi" : ""}">${e.tier}</span><span>${esc(CATS[e.category] || e.category)}</span></div>
                  <span class="t">${esc(e.title)}</span>
                  <span class="fx">${fxLine(e)}</span>
                  <span class="src">${(e.sources || []).filter((u) => /^https?:/.test(u)).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(host(u))} ↗</a>`).join("")}</span>
                </div>
              </li>`).join("")}
            </ol>
          </section>
          ${coming.length ? `<section class="coming" aria-labelledby="coming-h"><h3 id="coming-h">Coming up</h3>${coming.map(([w, t]) => `<div>${w ? `<span>${esc(w.toUpperCase())}</span>` : ""}${esc(cap(t))}</div>`).join("")}</section>` : ""}
        </aside>
      </div>
    </div>`;
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
      <article class="card recap"><span class="rnum">${esc(r.window.replace(/(\d{4})-(\d{2})-(\d{2})/g, (m, y, mo, d) => fmtDate(m)))}</span><h3>${esc(r.title)}</h3><p class="clamp">${esc(r.body)}</p><button type="button" class="btn" style="align-self:flex-start">Read more</button></article>`).join("");
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
        <p class="golden">Claude judges the news; <b>code does the arithmetic.</b> The same news always produces the same numbers.</p>
      </section>

      <section class="section">
        <div class="section-head"><div><h2 class="h2" style="margin-top:8px">What drives each ending</h2></div><p class="small muted">Each ending is a fixed mix of 3–4 world factors. ↑ pushes it up, ↓ pushes it down.</p></div>
        ${FAMILY_ORDER.map((f) => `<div class="fam-block"><div class="fam-title"><h3><span class="swatch c-${f}" style="width:12px;height:12px"></span>${esc(famName(f))}</h3><span class="muted small">${esc(H.families_meta[f].tagline)}</span></div>
          <div class="ending-recipes">${S.series.filter((s) => s.family === f).map((s) => `<div class="card pad ${s.cls}" style="border-left:3px solid var(--c)"><div class="row" style="display:flex;justify-content:space-between;gap:8px"><h4 style="font-size:17px">${esc(s.name)}</h4><span class="mono dim small">start ${R.scenarios[s.key].anchor} · now ${last(s.values).toFixed(1)}</span></div><p class="small muted" style="margin:6px 0 12px">${esc(C.endings[s.key].desc)}</p>${recipeHTML(R.scenarios[s.key].weights, s.cls)}</div>`).join("")}</div></div>`).join("")}
      </section>

      <section class="section">
        <div class="section-head"><div><h2 class="h2" style="margin-top:8px">The forces underneath</h2></div><p class="small muted">News never moves an ending directly. It moves one of these forces.</p></div>
        <div class="card pad table-wrap"><table><thead><tr><th>Factor</th><th>Question</th><th>0 means…</th><th>100 means…</th><th class="n">Start</th><th class="n">Now</th></tr></thead><tbody>
          ${Object.keys(R.factors).map((f) => `<tr><td><b>${esc(R.factors[f].name)}</b></td><td class="muted">${esc(C.factor_questions[f] || "")}</td><td>${esc(R.factors[f].low)}</td><td>${esc(R.factors[f].high)}</td><td class="n">${R.factor_baselines[f]}</td><td class="n">${last(H.factors[f]).toFixed(1)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>

      <section class="section">
        <div class="section-head"><div><h2 class="h2" style="margin-top:8px">Score events, not articles</h2></div></div>
        <div class="two-col">
          <div class="card pad"><h4 style="margin-bottom:10px">Impact tier</h4><table><tbody>${Object.entries(ER.impact_points).map(([t, p]) => `<tr><td><span class="tag tier">${t}</span></td><td>${tierTxt[t]}</td><td class="n">${p} pts</td></tr>`).join("")}</tbody></table></div>
          <div class="card pad"><h4 style="margin-bottom:10px">Source credibility</h4><table><tbody>${Object.entries(ER.credibility).map(([g, w]) => `<tr><td><span class="tag">${g}</span></td><td>${credTxt[g]}</td><td class="n">×${w}</td></tr>`).join("")}</tbody></table><p class="small dim" style="margin-top:8px">Hype guard: a company's claims about its own product count ×${ER.self_claim_multiplier} until someone independent confirms them.</p></div>
          <div class="card pad"><h4 style="margin-bottom:10px">Novelty and scope</h4><table><tbody>
            <tr><td>New event</td><td class="n">×${ER.novelty.new}</td></tr><tr><td>Follow-up on a known story</td><td class="n">×${ER.novelty.development}</td></tr><tr><td>Rehash</td><td class="n">×${ER.novelty.rehash}</td></tr>
            <tr><td>Global (frontier labs, US, China, EU, UN)</td><td class="n">×${ER.scope.global}</td></tr><tr><td>National</td><td class="n">×${ER.scope.national}</td></tr><tr><td>Local / niche</td><td class="n">×${ER.scope.local}</td></tr></tbody></table></div>
          <div class="card pad"><h4 style="margin-bottom:10px">Two tracks</h4><p class="muted"><b style="color:var(--ink)">Structural</b> things actually happened: a law enacted, a model released, an incident confirmed. Their effect is permanent until reversed.</p><p class="muted" style="margin-top:10px"><b style="color:var(--ink)">Signal</b> words and intentions: announcements, proposals, speeches. Their effect fades, halving every ${D.signal_half_life_days} days.</p><p class="small dim" style="margin-top:10px">One main factor, plus an optional second factor that counts half. A deliberately skeptical second pass re-checks every T3 and T4 rating.</p></div>
        </div>
        <p class="golden" style="max-width:none">Event points = tier × credibility × novelty × scope × direction</p>
      </section>

      <section class="section">
        <div class="section-head"><div><h2 class="h2" style="margin-top:8px">The maths, in six steps</h2></div></div>
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
        <div class="section-head"><div><h2 class="h2" style="margin-top:8px">Reading the dashboard</h2></div></div>
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
        <div class="section-head"><div><h2 class="h2" style="margin-top:8px">Questions people ask</h2></div></div>
        <div class="card pad faq">${C.faq.map((q) => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join("")}</div>
        <div class="disclaimer">Versioned rules (currently v${esc(R.version)}): every change gets a new version number and a changelog entry, and past scores are never quietly rewritten. Read the <a href="scoring/SCORING_RULES.md">full rules</a> or the machine-readable <a href="scoring/rules.json">rules.json</a>.</div>
      </section>
    </div>`;
  }

  /* ---------------- theme toggle ---------------- */
  (function theme() {
    const meta = document.querySelector('meta[name="color-scheme"]');
    const sys = matchMedia("(prefers-color-scheme: dark)");
    const rendered = () => (meta.content === "dark" ? "dark" : "light");
    const apply = (v) => { meta.content = v === "dark" ? "dark" : "light"; S.repaintScene && S.repaintScene(); };
    $("#theme-toggle").addEventListener("click", () => {
      const target = rendered() === "dark" ? "light" : "dark";
      T("theme_toggle", { to: target });
      try { target === "light" ? localStorage.removeItem("color-scheme") : localStorage.setItem("color-scheme", "dark"); } catch {}
      apply(target);
    });
    window.addEventListener("storage", (e) => { if (e.key === "color-scheme") apply(e.newValue); });
    sys.addEventListener("change", () => S.repaintScene && S.repaintScene());
  })();

  boot().catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="wrap"><div class="loading">Couldn't load the data. If you opened this file directly, serve the folder over HTTP (for example <code>python3 -m http.server</code>) or open the published site.</div></div>`;
  });
})();
