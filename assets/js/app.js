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
    $("#updated-label").textContent = "last updated " + fmtDate(H.end);
    $("#updated-chip-text").textContent = "Updated " + fmtDate(H.end).replace(/ \d{4}$/, "");
    const tb = $(".topbar"), mb = $("#menu-btn");
    mb.addEventListener("click", () => { const o = tb.classList.toggle("open"); mb.setAttribute("aria-expanded", o); });
    document.addEventListener("click", (e) => { if (!tb.contains(e.target)) { tb.classList.remove("open"); mb.setAttribute("aria-expanded", "false"); } });
    view.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#/ending/"]');
      if (a && route.prev === "summary") { e.preventDefault(); openEnding(a.getAttribute("href").split("/")[2]); }
    });
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
      document.body.classList.toggle("is-home", tab === "dashboard" || tab === "ending");
      $(".topbar").classList.remove("open"); $("#menu-btn").setAttribute("aria-expanded", "false");
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

  /* ================= DASHBOARD (full-screen chart) ================= */
  const isNight = () => {
    const m = document.querySelector('meta[name="color-scheme"]').content;
    return m === "dark" || (m !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  };
  const isPhone = () => matchMedia("(max-width: 760px)").matches;
  function renderDashboard() {
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
        <h1>Where is AI <i>taking us?</i></h1>
        <p><span class="d-only">Twelve possible endings for humanity and AI, re-scored every night from the news.</span><span class="m-only">Twelve endings, re-scored every night · updated ${fmtDate(H.end).replace(/ \d{4}$/, "")}</span></p>
      </div>
      <div class="hero-filters" role="toolbar" aria-label="Chart options">
        <div class="seg" role="group" aria-label="Time range" id="range"><button type="button" data-r="30" aria-pressed="false">30D</button><button type="button" data-r="90" aria-pressed="false">90D</button><button type="button" data-r="all" aria-pressed="true">All</button></div>
        <span class="sep" aria-hidden="true"></span>
        <div class="seg" role="group" aria-label="Chart view" id="mode"><button type="button" data-m="families" aria-pressed="false"><span class="d-only">4 families</span><span class="m-only">Families</span></button><button type="button" data-m="endings" aria-pressed="true"><span class="d-only">12 endings</span><span class="m-only">Endings</span></button></div>
      </div>
      <div class="hero-top3 m-only" id="top3">${sorted.slice(0, 3).map((s) => `<span class="${s.cls}"><i class="swatch"></i><b>${last(s.values).toFixed(1)}</b>${esc(s.name)}</span>`).join("")}</div>
      <section class="hero-card" aria-label="Horizon Balance today">
        <span class="kicker"><span class="d-only">Horizon Balance · ${weekday(H.end)}, ${fmtDate(H.end)}</span><span class="m-only">Horizon Balance · ${dShort}</span></span>
        <div class="bal"><b id="bal-val">0.0</b><span>${word(bal1, "up", "down")} today<br>${word(bal7, "up", "down")} this week</span></div>
        <div><div class="gauge-scale" aria-hidden="true"><div class="gauge-needle" id="needle" style="left:50%"></div></div><div class="gauge-ends"><span><span class="d-only">Darker futures</span><span class="m-only">Darker</span></span><span><span class="d-only">Brighter futures</span><span class="m-only">Brighter</span></span></div></div>
        <h2 class="m-only">${esc(H.headlines[li] || "")}</h2>
        <div class="links m-only"><a href="#/summary/${H.end}">Today’s story ›</a><a href="#/scoring">How it’s scored ›</a></div>
      </section>
      <div class="ticker" id="ticker">
        <span class="ticker-label">Latest</span>
        <div class="ticker-viewport"><div class="ticker-track" style="--dur:${Math.max(40, tick.length * 7)}s">${tickHTML}<span class="ticker-dup" aria-hidden="true">${tickHTML.replace(/<a /g, '<a tabindex="-1" ')}</span></div></div>
        <button type="button" class="ticker-pause" id="ticker-pause" aria-pressed="false">Pause</button>
      </div>
    </section>`;

    countUp($("#bal-val"), bal, 1, true);
    requestAnimationFrame(() => ($("#needle").style.left = `${50 + bal / 2}%`));
    $("#ticker-pause").addEventListener("click", (e) => {
      const p = $("#ticker").classList.toggle("paused");
      e.currentTarget.textContent = p ? "Play" : "Pause"; e.currentTarget.setAttribute("aria-pressed", p);
    });

    const st = { range: "all", mode: "endings" };
    const markers = H.key_events.map((k) => ({ i: k.i, label: `${fmtDate(k.date)} — ${k.title}` }));
    const layout = (W, Hh) => {
      if (isPhone()) {
        const f = $(".hero-filters"), c = $(".hero-card");
        const yt = f ? f.offsetTop + f.offsetHeight + 56 : 200;
        const yb = c ? c.offsetTop - 34 : Hh - 330;
        return { x0: 0, xr: W - 8, yt, yb: Math.max(yt + 120, yb), todayTop: yt, labels: false };
      }
      return { x0: 0, xr: W - 268, yt: 285, yb: Hh - 105, todayTop: 180, labels: true };
    };
    let chart;
    const draw = () => {
      if (chart) { chart.destroy(); S.charts = S.charts.filter((c) => c !== chart); }
      const start = st.range === "all" ? 0 : Math.max(0, n - Number(st.range));
      const src = st.mode === "endings" ? S.series : S.famSeries;
      chart = window.EGChart.hero($("#hero-chart"), {
        dates: H.dates.slice(start), series: src.map((s) => ({ ...s, values: s.values.slice(start) })),
        headlines: H.headlines.slice(start), markers: markers.map((m) => ({ ...m, i: m.i - start })),
        label: "Line chart of the Plausibility Index for each ending over time. Use the arrow keys to read any day.",
        layout, onClick: (i) => (location.hash = `#/summary/${H.dates[start + i]}`),
      });
      S.charts.push(chart);
    };
    $$("#range button").forEach((b) => b.addEventListener("click", () => { st.range = b.dataset.r; $$("#range button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    $$("#mode button").forEach((b) => b.addEventListener("click", () => { st.mode = b.dataset.m; $$("#mode button").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
    draw();
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
    const rendered = () => (meta.content === "light dark" ? (sys.matches ? "dark" : "light") : meta.content);
    const apply = (v) => { meta.content = v ?? "light dark"; S.repaintScene && S.repaintScene(); };
    $("#theme-toggle").addEventListener("click", () => {
      const target = rendered() === "dark" ? "light" : "dark";
      const systemNow = sys.matches ? "dark" : "light";
      try { target === systemNow ? localStorage.removeItem("color-scheme") : localStorage.setItem("color-scheme", target); } catch {}
      apply(target === systemNow ? null : target);
    });
    window.addEventListener("storage", (e) => { if (e.key === "color-scheme") apply(e.newValue); });
    sys.addEventListener("change", () => S.repaintScene && S.repaintScene());
  })();

  boot().catch((err) => {
    console.error(err);
    view.innerHTML = `<div class="wrap"><div class="loading">Couldn't load the data. If you opened this file directly, serve the folder over HTTP (for example <code>python3 -m http.server</code>) or open the published site.</div></div>`;
  });
})();
