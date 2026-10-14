/* Endgame Index — tiny dependency-free SVG charts
   EGChart.lines(container, opts)   multi-series line chart with crosshair tooltip
   EGChart.spark(container, values, cls)
   EGChart.balance(container, opts) diverging area chart around zero
*/
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtDate = (s) => { const [y, m, d] = s.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const fmtSigned = (v, dp = 1) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(dp);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Monotone cubic interpolation (Fritsch–Carlson), returns SVG path
  function monotonePath(pts) {
    const n = pts.length;
    if (n === 0) return "";
    if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    t[n - 1] = m[n - 2];
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { const s = 3 / Math.sqrt(h); t[i] = s * a * m[i]; t[i + 1] = s * b * m[i]; }
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + h * t[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
    }
    return d;
  }

  function niceTicks(min, max, count = 5) {
    const span = max - min || 1;
    const step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => span / s <= count) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }

  function monthTicks(dates) {
    const out = [];
    dates.forEach((d, i) => { if (d.endsWith("-01") || i === 0) out.push(i); });
    if (out.length > 1 && out[1] - out[0] < 24) out.shift();
    return out;
  }

  function swatchSVG(cls, dash) {
    return `<svg viewBox="0 0 22 8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="${cls}" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;
  }

  const tooltip = () => document.getElementById("tooltip");
  function placeTooltip(tt, clientX, clientY) {
    const pad = 14, w = tt.offsetWidth, h = tt.offsetHeight;
    let x = clientX + pad, y = clientY - h / 2;
    if (x + w > window.innerWidth - 8) x = clientX - w - pad;
    y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
    tt.style.left = x + "px"; tt.style.top = y + "px";
  }

  /* ------------------------------------------------------------------ */
  function lines(container, opts) {
    const state = { focus: opts.focus || null, hidden: new Set(opts.hidden || []), idx: null };
    const render = () => {
      container.innerHTML = "";
      const W = Math.max(300, container.clientWidth);
      const narrow = W < 700;
      const endLabels = opts.endLabels !== false && !narrow;
      const H = opts.height || (narrow ? 300 : 420);
      const M = { l: 30, r: endLabels ? 168 : 10, t: 14, b: 26 };
      const iw = W - M.l - M.r, ih = H - M.t - M.b;
      const dates = opts.dates, n = dates.length;
      const visible = opts.series.filter((s) => !state.hidden.has(s.key));
      let lo = Infinity, hi = -Infinity;
      visible.forEach((s) => s.values.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
      if (!isFinite(lo)) { lo = 0; hi = 50; }
      lo = Math.max(0, Math.floor((lo - 3) / 5) * 5); hi = Math.min(100, Math.ceil((hi + 3) / 5) * 5);
      const x = (i) => M.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
      const y = (v) => M.t + ih - ((v - lo) / (hi - lo)) * ih;

      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img", tabindex: "0", "aria-label": opts.label || "Line chart" }, container);
      const g = el("g", { class: "grid" }, svg);
      const ax = el("g", { class: "axis" }, svg);
      niceTicks(lo, hi, narrow ? 4 : 6).forEach((t) => {
        el("line", { x1: M.l, x2: M.l + iw, y1: y(t), y2: y(t) }, g);
        const tx = el("text", { x: M.l - 8, y: y(t) + 4, "text-anchor": "end" }, ax); tx.textContent = t;
      });
      monthTicks(dates).forEach((i) => {
        const [yy, mm, dd] = dates[i].split("-").map(Number);
        const tx = el("text", { x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : "middle" }, ax);
        tx.textContent = dd === 1 ? MONTHS[mm - 1] : `${dd} ${MONTHS[mm - 1]}`;
      });
      // event markers
      (opts.markers || []).forEach((mk) => {
        if (mk.i < 0 || mk.i >= n) return;
        el("line", { class: "marker-line", x1: x(mk.i), x2: x(mk.i), y1: M.t, y2: M.t + ih }, svg);
        const p = el("path", { class: "marker", d: `M${x(mk.i)},${M.t - 2} l4,5 l-4,5 l-4,-5z` }, svg);
        const t = el("title", {}, p); t.textContent = mk.label;
      });
      const paths = {};
      visible.forEach((s) => {
        const pts = s.values.map((v, i) => [x(i), y(v)]);
        const p = el("path", { d: monotonePath(pts), class: `series ${s.cls}` }, svg);
        if (s.dash) p.setAttribute("stroke-dasharray", s.dash);
        paths[s.key] = p;
      });
      // end labels with collision avoidance
      const labels = {};
      if (endLabels) {
        const items = visible.map((s) => ({ s, y: y(s.values[n - 1]) })).sort((a, b) => a.y - b.y);
        const gap = 14;
        for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
        const over = items.length ? items[items.length - 1].y - (M.t + ih) : 0;
        if (over > 0) for (let i = items.length - 1; i >= 0; i--) { items[i].y -= over; if (i > 0 && items[i].y - items[i - 1].y < gap) items[i - 1].y = items[i].y - gap; }
        items.forEach(({ s, y: ly }) => {
          const t = el("text", { x: M.l + iw + 10, y: ly + 4, class: "endlabel" }, svg);
          t.innerHTML = `<tspan class="mono" style="font-weight:600">${s.values[n - 1].toFixed(1)}</tspan><tspan dx="6">${esc(s.name)}</tspan>`;
          labels[s.key] = t;
        });
      }
      const applyFocus = () => {
        visible.forEach((s) => {
          const on = !state.focus || state.focus === s.key;
          paths[s.key].classList.toggle("dim", !on);
          paths[s.key].classList.toggle("hl", state.focus === s.key);
          labels[s.key]?.classList.toggle("dim", !on);
        });
        if (state.focus && paths[state.focus]) svg.appendChild(paths[state.focus]);
      };
      applyFocus();

      // hover layer
      const cross = el("line", { class: "crosshair", y1: M.t, y2: M.t + ih, visibility: "hidden" }, svg);
      const dots = visible.map((s) => el("circle", { r: 4, class: `hover-dot ${s.cls.replace("c-", "f-")}`, visibility: "hidden" }, svg));
      const hit = el("rect", { x: M.l, y: 0, width: iw, height: H, fill: "transparent" }, svg);
      const tt = tooltip();
      const show = (i, cx, cy) => {
        state.idx = i;
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
        visible.forEach((s, k) => { dots[k].setAttribute("cx", x(i)); dots[k].setAttribute("cy", y(s.values[i])); dots[k].setAttribute("visibility", !state.focus || state.focus === s.key ? "visible" : "hidden"); });
        const rows = visible.map((s) => ({ s, v: s.values[i], d: i > 0 ? s.values[i] - s.values[i - 1] : 0 })).sort((a, b) => b.v - a.v);
        const head = opts.headlines && opts.headlines[i];
        tt.innerHTML = `<div class="tt-date">${fmtDate(dates[i])}</div>${head ? `<div class="tt-head">${esc(head)}</div>` : `<div style="height:6px"></div>`}` +
          rows.map((r) => `<div class="tt-row ${state.focus === r.s.key ? "hl" : ""}">${swatchSVG(r.s.cls, r.s.dash)}<span>${esc(r.s.name)}</span><span class="tt-v">${r.v.toFixed(1)}</span><span class="tt-d">${Math.abs(r.d) < 0.05 ? "0.0" : fmtSigned(r.d)}</span></div>`).join("");
        tt.hidden = false;
        if (cx == null) { const b = svg.getBoundingClientRect(); cx = b.left + (x(i) / W) * b.width; cy = b.top + b.height / 3; }
        placeTooltip(tt, cx, cy);
        opts.onHover && opts.onHover(i);
      };
      const hide = () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); tt.hidden = true; state.idx = null; };
      const idxFromEvent = (ev) => {
        const b = svg.getBoundingClientRect();
        const px = ((ev.clientX - b.left) / b.width) * W;
        return Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / iw) * (n - 1))));
      };
      hit.addEventListener("pointermove", (ev) => show(idxFromEvent(ev), ev.clientX, ev.clientY));
      hit.addEventListener("pointerleave", hide);
      hit.addEventListener("click", (ev) => opts.onClick && opts.onClick(idxFromEvent(ev)));
      svg.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
          ev.preventDefault();
          const i = state.idx == null ? n - 1 : Math.max(0, Math.min(n - 1, state.idx + (ev.key === "ArrowRight" ? 1 : -1)));
          show(i);
        } else if (ev.key === "Escape") hide();
        else if (ev.key === "Enter" && state.idx != null && opts.onClick) opts.onClick(state.idx);
      });
      svg.addEventListener("blur", hide);
    };
    render();
    let raf;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); });
    ro.observe(container);
    return {
      setFocus(k) { state.focus = k; render(); },
      setHidden(set) { state.hidden = new Set(set); render(); },
      destroy() { ro.disconnect(); },
    };
  }

  /* ------------------------------------------------------------------ */
  function spark(container, values, cls) {
    const W = 260, H = 38, n = values.length;
    let lo = Math.min(...values), hi = Math.max(...values);
    if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
    const x = (i) => (i / (n - 1)) * W, y = (v) => 3 + (H - 6) * (1 - (v - lo) / (hi - lo));
    const pts = values.map((v, i) => [x(i), y(v)]);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", class: `spark ${cls}`, "aria-hidden": "true" }, container);
    const d = monotonePath(pts);
    el("path", { d: `${d}L${W},${H}L0,${H}Z`, class: "spark-area" }, svg);
    el("path", { d, class: cls, "vector-effect": "non-scaling-stroke" }, svg);
    return svg;
  }

  /* ------------------------------------------------------------------ */
  function balance(container, opts) {
    const render = () => {
      container.innerHTML = "";
      const W = Math.max(300, container.clientWidth), H = opts.height || 200;
      const M = { l: 34, r: 10, t: 10, b: 24 }, iw = W - M.l - M.r, ih = H - M.t - M.b;
      const v = opts.values, n = v.length;
      const ext = Math.max(5, Math.ceil(Math.max(...v.map(Math.abs)) / 5) * 5);
      const x = (i) => M.l + (i / (n - 1)) * iw, y = (val) => M.t + ih / 2 - (val / ext) * (ih / 2);
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img", tabindex: "0", "aria-label": opts.label || "Horizon Balance over time" }, container);
      const g = el("g", { class: "grid" }, svg), ax = el("g", { class: "axis" }, svg);
      [-ext, -ext / 2, 0, ext / 2, ext].forEach((t) => {
        if (t !== 0) el("line", { x1: M.l, x2: M.l + iw, y1: y(t), y2: y(t) }, g);
        const tx = el("text", { x: M.l - 8, y: y(t) + 4, "text-anchor": "end" }, ax); tx.textContent = t > 0 ? "+" + t : t;
      });
      monthTicks(opts.dates).forEach((i) => { const mm = +opts.dates[i].split("-")[1]; const tx = el("text", { x: x(i), y: H - 6, "text-anchor": i === 0 ? "start" : "middle" }, ax); tx.textContent = MONTHS[mm - 1]; });
      const pts = v.map((val, i) => [x(i), y(val)]);
      const line = monotonePath(pts);
      const clipId = "bal" + Math.random().toString(36).slice(2, 7);
      const defs = el("defs", {}, svg);
      const cp = el("clipPath", { id: clipId + "p" }, defs); el("rect", { x: 0, y: 0, width: W, height: y(0) }, cp);
      const cn = el("clipPath", { id: clipId + "n" }, defs); el("rect", { x: 0, y: y(0), width: W, height: H }, cn);
      const area = `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
      el("path", { d: area, class: "area-pos", "clip-path": `url(#${clipId}p)` }, svg);
      el("path", { d: area, class: "area-neg", "clip-path": `url(#${clipId}n)` }, svg);
      el("line", { class: "zero", x1: M.l, x2: M.l + iw, y1: y(0), y2: y(0) }, svg);
      el("path", { d: line, class: "bal-line" }, svg);
      const cross = el("line", { class: "crosshair", y1: M.t, y2: M.t + ih, visibility: "hidden" }, svg);
      const dot = el("circle", { r: 4, class: "hover-dot", fill: "currentColor", visibility: "hidden" }, svg);
      const hit = el("rect", { x: M.l, y: 0, width: iw, height: H, fill: "transparent" }, svg);
      const tt = tooltip();
      const show = (i, cx, cy) => {
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
        dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(v[i])); dot.setAttribute("visibility", "visible");
        const head = opts.headlines && opts.headlines[i];
        tt.innerHTML = `<div class="tt-date">${fmtDate(opts.dates[i])}</div>${head ? `<div class="tt-head">${esc(head)}</div>` : ""}<div class="tt-row" style="grid-template-columns:1fr auto"><span>Horizon Balance</span><span class="tt-v">${fmtSigned(v[i], 2)}</span></div>`;
        tt.hidden = false;
        if (cx == null) { const b = svg.getBoundingClientRect(); cx = b.left + (x(i) / W) * b.width; cy = b.top + b.height / 2; }
        placeTooltip(tt, cx, cy);
      };
      const hide = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tt.hidden = true; };
      const idx = (ev) => { const b = svg.getBoundingClientRect(); const px = ((ev.clientX - b.left) / b.width) * W; return Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / iw) * (n - 1)))); };
      let cur = n - 1;
      hit.addEventListener("pointermove", (ev) => { cur = idx(ev); show(cur, ev.clientX, ev.clientY); });
      hit.addEventListener("pointerleave", hide);
      hit.addEventListener("click", (ev) => opts.onClick && opts.onClick(idx(ev)));
      svg.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { ev.preventDefault(); cur = Math.max(0, Math.min(n - 1, cur + (ev.key === "ArrowRight" ? 1 : -1))); show(cur); }
        else if (ev.key === "Escape") hide();
        else if (ev.key === "Enter" && opts.onClick) opts.onClick(cur);
      });
      svg.addEventListener("blur", hide);
    };
    render();
    let raf; const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }); ro.observe(container);
    return { destroy() { ro.disconnect(); } };
  }

  window.EGChart = { lines, spark, balance, swatchSVG, fmtDate, fmtSigned, esc };
})();
