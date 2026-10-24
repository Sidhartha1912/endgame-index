/* Endgame Index — analytics wrapper.
   One place to change tools later. Does nothing until keys are set in
   window.EG_ANALYTICS (index.html). PostHog for users + events,
   Cloudflare Web Analytics for traffic + Core Web Vitals.
   Both load only after the page has shown, so they never slow the first view;
   events sent before then are queued. */
(function () {
  const C = window.EG_ANALYTICS || {};
  const dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const usePH = !!(C.posthogKey && !dnt && !local);
  let ph = null;
  const queue = [];

  function startPostHog() {
    // official PostHog loader (stub queues calls until the library arrives)
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset identify alias set_config".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init(C.posthogKey, {
      api_host: C.posthogHost || "https://us.i.posthog.com",
      person_profiles: "identified_only", // anonymous visitors, no personal profiles
      persistence: "localStorage",        // no cookies
      capture_pageview: false,            // sent manually on each tab change (hash routing)
      capture_pageleave: true,
      autocapture: true,
      enable_heatmaps: true,
    });
    ph = window.posthog;
    ph.register({ app: "endgame-index", screen: matchMedia("(max-width: 760px)").matches ? "phone" : "desktop" });
    queue.splice(0).forEach(([n, p]) => safe(() => ph.capture(n, p)));
  }
  function startCloudflare() {
    if (!C.cloudflareToken || local) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: C.cloudflareToken, spa: true }));
    document.head.appendChild(s);
  }
  function startAll() {
    startCloudflare();
    if (usePH) startPostHog();
  }
  // wait for the page to finish loading, then for an idle moment (max 3 s)
  const later = () => ("requestIdleCallback" in window ? requestIdleCallback(startAll, { timeout: 3000 }) : setTimeout(startAll, 1500));
  if (document.readyState === "complete") later(); else window.addEventListener("load", later, { once: true });

  const safe = (fn) => { try { fn(); } catch (e) { /* analytics must never break the page */ } };
  const send = (name, props) => { if (!usePH) return; if (ph) safe(() => ph.capture(name, props)); else if (queue.length < 50) queue.push([name, props]); };
  window.EGTrack = {
    event(name, props) { send(name, props || {}); },
    page(tab, props) { send("$pageview", Object.assign({ $current_url: location.href, tab }, props || {})); },
  };

  /* Layout-shift reporter: when the page visibly jumps (not caused by a tap or click),
     record which element moved so it can be fixed. At most 3 reports per page load. */
  if (usePH && "PerformanceObserver" in window) {
    let reports = 0, win = 0, winStart = 0, last = 0;
    const describe = (n) => {
      if (!n || !n.nodeName) return "?";
      let d = n.nodeName.toLowerCase();
      if (n.id) d += "#" + n.id; else if (n.classList && n.classList.length) d += "." + [...n.classList].slice(0, 2).join(".");
      const p = n.parentElement;
      return p && p !== document.body ? describe(p).split(">").pop() + ">" + d : d;
    };
    safe(() => new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        if (e.startTime - last > 1000 || e.startTime - winStart > 5000) { win = 0; winStart = e.startTime; }
        win += e.value; last = e.startTime;
        if ((e.value >= 0.05 || win >= 0.1) && reports < 3) {
          reports++;
          const src = (e.sources || []).slice(0, 3).map((x) => describe(x.node)).join(" | ");
          send("layout_shift", {
            value: +e.value.toFixed(4), window_total: +win.toFixed(4), at_ms: Math.round(e.startTime), sources: src,
            page: (location.hash.replace(/^#\/?/, "").split("/")[0]) || "dashboard",
            viewport: innerWidth + "x" + innerHeight, orientation: innerWidth > innerHeight ? "landscape" : "portrait",
            landscape_chart: document.documentElement.classList.contains("lsc-open"),
          });
        }
      }
    }).observe({ type: "layout-shift", buffered: true }));
  }
})();
