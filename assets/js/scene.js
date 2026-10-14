/* Endgame Index — painted pixel horizon.
   Draws a small low-resolution landscape on a canvas that CSS scales up with
   image-rendering: pixelated, so it reads as pixel-art painting.
   The scene's mood follows the leading family; dark mode draws the night version.
   EGScene.paint(canvas, { family, night, seed }) */
(function () {
  const W = 320, H = 168;

  // palettes: sky top, sky horizon, sun, far ridge, mid ridge, near ground, accents
  const P = {
    flourishing: {
      day:   { top: "#86b9dc", hor: "#f4e2b8", sun: "#fff4cf", glow: "#ffe6a3", far: "#9fbfb0", mid: "#6e9e6c", near: "#47783f", accents: ["#f2c94c", "#ea8fae", "#ffffff"], city: false },
      night: { top: "#0e1a2b", hor: "#3a4f63", sun: "#f3efd8", glow: "#8fa7b8", far: "#2a3d47", mid: "#1d3128", near: "#132219", accents: ["#d9c66a", "#b58aa8"], city: false },
    },
    contained: {
      day:   { top: "#4d78a8", hor: "#f0c49b", sun: "#fff0d0", glow: "#ffcf96", far: "#7d8fae", mid: "#4f6283", near: "#334360", accents: ["#ffe3a8", "#ffffff"], city: true },
      night: { top: "#0a1426", hor: "#2b3a5c", sun: "#e9edf5", glow: "#7f93b8", far: "#1f2a44", mid: "#151d33", near: "#0d1324", accents: ["#ffd98a", "#9cc2ff"], city: true },
    },
    successors: {
      day:   { top: "#5a4466", hor: "#eb9a74", sun: "#ffd9b8", glow: "#ffad84", far: "#8c6270", mid: "#5f4150", near: "#3d2a36", accents: ["#ff7a64", "#ffd0b0"], city: true },
      night: { top: "#140c1c", hor: "#4a2633", sun: "#f2d6cf", glow: "#a2566a", far: "#2e1a26", mid: "#1f121b", near: "#140b12", accents: ["#ff5e4d", "#ffb08f"], city: true },
    },
    stalled: {
      day:   { top: "#b7b39d", hor: "#f2ddb0", sun: "#fff3cf", glow: "#f6d58f", far: "#bba07a", mid: "#94805a", near: "#6c5c3e", accents: ["#e2b24c", "#c98a3c"], city: false },
      night: { top: "#17140f", hor: "#4d4230", sun: "#efe4c8", glow: "#9a8257", far: "#30291d", mid: "#221d14", near: "#16120c", accents: ["#d8a94a"], city: false },
    },
  };

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function noise1(r, n, smooth) {
    // smooth 1-D value noise sampled at n points
    const k = Math.max(2, Math.floor(n / smooth)), pts = Array.from({ length: k + 2 }, r);
    return Array.from({ length: n }, (_, x) => {
      const f = (x / n) * k, i = Math.floor(f), t = f - i, u = t * t * (3 - 2 * t);
      return pts[i] * (1 - u) + pts[i + 1] * u;
    });
  }

  function paint(canvas, opts = {}) {
    const fam = P[opts.family] ? opts.family : "contained";
    const pal = P[fam][opts.night ? "night" : "day"];
    const r = rng(opts.seed || 7);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(W, H), d = img.data;
    const top = hex(pal.top), hor = hex(pal.hor), sun = hex(pal.sun), glow = hex(pal.glow);
    const horizonY = Math.round(H * 0.62);
    const sunX = W * 0.68, sunY = horizonY - (opts.night ? 18 : 34), sunR = opts.night ? 7 : 10;
    const put = (x, y, c, dither = true) => {
      const i = (y * W + x) * 4, b = dither ? BAYER[(y & 3) * 4 + (x & 3)] * 10 : 0;
      d[i] = Math.max(0, Math.min(255, c[0] + b)); d[i + 1] = Math.max(0, Math.min(255, c[1] + b)); d[i + 2] = Math.max(0, Math.min(255, c[2] + b)); d[i + 3] = 255;
    };

    // sky with sun glow
    for (let y = 0; y < H; y++) {
      const t = Math.min(1, Math.pow(y / horizonY, 1.35));
      const base = mix(top, hor, t);
      for (let x = 0; x < W; x++) {
        const dist = Math.hypot((x - sunX) * 0.8, (y - sunY) * 1.3);
        const g = Math.max(0, 1 - dist / 120);
        let c = mix(base, glow, g * g * 0.65);
        if (Math.hypot(x - sunX, y - sunY) < sunR) c = sun;
        put(x, y, c);
      }
    }
    // stars at night
    if (opts.night) for (let i = 0; i < 90; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * horizonY * 0.8);
      put(x, y, mix(hex(pal.sun), top, r() * 0.5), false);
    }
    // puffy clouds: clusters of circles with flat bottoms
    const cloudCol = opts.night ? hex(pal.far) : [255, 255, 255];
    for (let c = 0; c < 6; c++) {
      const cx = r() * W, cy = 12 + r() * horizonY * 0.5, puffs = 3 + Math.floor(r() * 4), alpha = opts.night ? 0.22 : 0.42;
      for (let k = 0; k < puffs; k++) {
        const px = cx + (k - puffs / 2) * (5 + r() * 4), py = cy - r() * 4, pr = 4 + r() * 6;
        for (let y = Math.floor(py - pr); y <= Math.min(cy + 2, py + pr); y++) for (let x = Math.floor(px - pr); x <= px + pr; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          if ((x - px) ** 2 + (y - py) ** 2 > pr * pr) continue;
          const i = (y * W + x) * 4, cur = [d[i], d[i + 1], d[i + 2]];
          put(x, y, mix(cur, cloudCol, alpha * (y > cy - 1 ? 0.7 : 1)), false);
        }
      }
    }
    // ridges: far, (optional city), mid, near
    const ridge = (col, baseY, amp, smooth, haze) => {
      const n = noise1(r, W, smooth), c = mix(hex(col), hor, haze);
      const ys = n.map((v) => Math.round(baseY - v * amp));
      for (let x = 0; x < W; x++) for (let y = ys[x]; y < H; y++) {
        const shade = mix(c, [0, 0, 0], Math.min(0.25, (y - ys[x]) / 220));
        put(x, y, shade);
      }
      return ys;
    };
    ridge(pal.far, horizonY - 6, 22, 70, 0.35);
    if (pal.city) {
      // a quiet skyline: blocks with a few lit windows
      let x = Math.floor(W * 0.08);
      const cityCol = mix(hex(pal.mid), hor, 0.25);
      while (x < W * 0.92) {
        const w = 5 + Math.floor(r() * 9), h = 10 + Math.floor(Math.pow(r(), 1.6) * 42), gap = 1 + Math.floor(r() * 4);
        const base = horizonY + 2;
        for (let xx = x; xx < Math.min(W, x + w); xx++) for (let y = base - h; y < base + 8; y++) put(xx, y, cityCol);
        for (let wy = base - h + 3; wy < base; wy += 4) for (let wx = x + 1; wx < x + w - 1; wx += 2)
          if (r() < (opts.night ? 0.32 : 0.1)) put(wx, wy, hex(pal.accents[Math.floor(r() * pal.accents.length)]), false);
        if (h > 40 && r() < 0.5) for (let y = base - h - 6; y < base - h; y++) put(x + Math.floor(w / 2), y, cityCol);
        x += w + gap;
      }
    }
    ridge(pal.mid, horizonY + 12, 14, 50, 0.12);
    const near = ridge(pal.near, horizonY + 30, 10, 36, 0);
    // flowers / lights scattered on the near ground
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(r() * W), y0 = near[x] + 2 + Math.floor(Math.pow(r(), 0.7) * (H - near[x] - 2));
      if (y0 >= H) continue;
      const c = hex(pal.accents[Math.floor(r() * pal.accents.length)]);
      put(x, y0, c, false);
      if (r() < 0.35 && x + 1 < W) put(x + 1, y0, mix(c, [0, 0, 0], 0.2), false);
    }
    ctx.putImageData(img, 0, 0);
  }

  window.EGScene = { paint };
})();
