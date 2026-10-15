/* Endgame Index — analytics wrapper.
   One place to change tools later. Does nothing until keys are set in
   window.EG_ANALYTICS (index.html). PostHog for users + events,
   Cloudflare Web Analytics for traffic + Core Web Vitals. */
(function () {
  const C = window.EG_ANALYTICS || {};
  const dnt = navigator.doNotTrack === "1" || window.doNotTrack === "1";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  let ph = null;

  if (C.posthogKey && !dnt && !local) {
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
  }

  if (C.cloudflareToken && !local) {
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.setAttribute("data-cf-beacon", JSON.stringify({ token: C.cloudflareToken, spa: true }));
    document.head.appendChild(s);
  }

  const safe = (fn) => { try { fn(); } catch (e) { /* analytics must never break the page */ } };
  window.EGTrack = {
    event(name, props) { if (ph) safe(() => ph.capture(name, props || {})); },
    page(tab, props) {
      if (ph) safe(() => ph.capture("$pageview", Object.assign({ $current_url: location.href, tab }, props || {})));
    },
  };
})();
