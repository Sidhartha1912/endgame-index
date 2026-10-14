#!/usr/bin/env python3
"""Endgame Index scoring engine.

Deterministically recomputes the full history from:
  scoring/rules.json          - the published rules
  data/events/YYYY-MM-DD.json - rated events for each day (list)
  data/summaries/YYYY-MM-DD.json - written daily summaries (optional)

Writes:
  data/days/YYYY-MM-DD.json   - full record for each day
  data/history.json           - compact series for the dashboard

Usage: python3 scripts/compute.py [--end YYYY-MM-DD]
Only the Python standard library is used.
"""
import json, math, os, sys, glob, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def dump(path, obj, compact=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        if compact:
            json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, fh, ensure_ascii=False, indent=1)


def r2(x):
    return round(x + 0.0, 2)


def main():
    R = load(P("scoring", "rules.json"))
    E, D = R["event_rating"], R["dynamics"]
    FACT = [f for f in R["factors"]]
    SC = R["scenarios"]
    base = {f: float(R["factor_baselines"][f]) for f in FACT}
    start = dt.date.fromisoformat(R["effective_from"])

    ev_files = sorted(glob.glob(P("data", "events", "*.json")))
    last_ev = max((os.path.basename(f)[:10] for f in ev_files), default=R["effective_from"])
    end = dt.date.fromisoformat(last_ev)
    if "--end" in sys.argv:
        end = dt.date.fromisoformat(sys.argv[sys.argv.index("--end") + 1])

    decay = 0.5 ** (1.0 / D["signal_half_life_days"])
    S, z, k, cap = D["daily_saturation_S"], D["edge_softening_zone"], D["amplifier_k"], D["scenario_daily_cap"]
    lo, hi = D["scenario_bounds"]
    tier_rank = {"T1": 1, "T2": 2, "T3": 3, "T4": 4}

    sig = {f: 0.0 for f in FACT}
    struc = {f: 0.0 for f in FACT}
    raw0 = {s: sum(w * base[f] for f, w in SC[s]["weights"].items()) for s in SC}
    disp = {s: float(SC[s]["anchor"]) for s in SC}
    hist_scores, hist_balance = [], []

    H = {"rules_version": R["version"], "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
         "start": start.isoformat(), "end": end.isoformat(), "dates": [],
         "scenarios": {s: {"name": SC[s]["name"], "family": SC[s]["family"], "anchor": SC[s]["anchor"]} for s in SC},
         "factors_meta": {f: R["factors"][f]["name"] for f in FACT}, "families_meta": R["families"],
         "scores": {s: [] for s in SC}, "factors": {f: [] for f in FACT}, "balance": [],
         "families": {fm: [] for fm in R["families"]}, "heat": [], "evidence": [], "event_counts": [],
         "badges": [], "headlines": [], "key_events": [],
         "totals": {"events": 0}}

    day = start
    while day <= end:
        ds = day.isoformat()
        events = load(P("data", "events", ds + ".json"), []) or []
        prev = dict(disp)
        F_prev = {f: base[f] + sig[f] + struc[f] for f in FACT}

        # 1. fading of signal effects
        fade = {}
        for f in FACT:
            new = sig[f] * decay
            fade[f] = new - sig[f]
            sig[f] = new

        # 2. event points
        per_ev = []
        tot = {f: 0.0 for f in FACT}
        heat = 0.0
        for i, e in enumerate(events):
            e.setdefault("id", f"{ds}-{i + 1:02d}")
            mult = (E["impact_points"][e["tier"]] * E["credibility"][e["credibility"]]
                    * (E["self_claim_multiplier"] if e.get("self_claim") else 1.0)
                    * E["novelty"][e["novelty"]] * E["scope"][e["scope"]])
            pts = {}
            for j, fx in enumerate(e["factors"][:E["max_factors_per_event"]]):
                share = 1.0 if j == 0 else E["secondary_factor_share"]
                p = mult * share * (1 if fx["dir"] > 0 else -1)
                pts[fx["id"]] = pts.get(fx["id"], 0.0) + p
                tot[fx["id"]] += p
                heat += abs(p)
            e["points"] = r2(mult)
            per_ev.append(pts)

        # 3. smoothing + edge softening -> effective per-event factor deltas
        eff = [dict() for _ in events]
        for f in FACT:
            t = tot[f]
            touched = [i for i in range(len(events)) if f in per_ev[i]]
            if not touched:
                continue
            if abs(t) < 1e-12:
                # opposing events cancel exactly: keep each at face value so that
                # structural/signal tracks are stored separately and attribution shows both
                scale = 1.0
                for i in touched:
                    events[i]["offset_by_opposing"] = True
            else:
                sat = S * math.tanh(abs(t) / S) * (1 if t > 0 else -1)
                cur = base[f] + sig[f] + struc[f]
                sat *= min(1.0, (100 - cur) / z) if sat > 0 else min(1.0, cur / z)
                scale = sat / t
            for i in touched:
                e = events[i]
                d_ = per_ev[i][f] * scale
                eff[i][f] = d_
                if e["track"] == "structural":
                    struc[f] += d_
                else:
                    sig[f] += d_
        F = {f: max(0.0, min(100.0, base[f] + sig[f] + struc[f])) for f in FACT}

        # 4. scenario targets and displayed scores (speed limit)
        target, capped = {}, []
        for s in SC:
            raw = sum(w * F[f] for f, w in SC[s]["weights"].items())
            target[s] = max(lo, min(hi, SC[s]["anchor"] + k * (raw - raw0[s])))
            mv = target[s] - prev[s]
            if abs(mv) > cap:
                capped.append(s)
            disp[s] = prev[s] + max(-cap, min(cap, mv))
        deltas = {s: disp[s] - prev[s] for s in SC}

        # 5. attribution: contribution of each event (and of fading) to each scenario
        for i, e in enumerate(events):
            c = {}
            for s in SC:
                v = k * sum(SC[s]["weights"].get(f, 0.0) * d_ for f, d_ in eff[i].items())
                if abs(v) >= 0.005:
                    c[s] = r2(v)
            e["contribution"] = c
            e["factor_effect"] = {f: r2(v) for f, v in eff[i].items()}
        fade_c = {}
        for s in SC:
            v = k * sum(SC[s]["weights"].get(f, 0.0) * fade[f] for f in FACT)
            if abs(v) >= 0.005:
                fade_c[s] = r2(v)

        # 6. composites
        fam = {fm: sum(disp[s] for s in SC if SC[s]["family"] == fm) / max(1, sum(1 for s in SC if SC[s]["family"] == fm))
               for fm in R["families"]}
        hb = R["composites"]["horizon_balance"]
        balance = sum(disp[s] for s in hb["bright"]) / len(hb["bright"]) - sum(disp[s] for s in hb["dark"]) / len(hb["dark"])
        strong = sum(1 for e in events if tier_rank[e["tier"]] >= 2 and e["credibility"] in ("A", "B"))
        evidence = "high" if strong >= 3 else ("medium" if strong >= 1 else "low")
        mom = {}
        if len(hist_scores) >= 7:
            ago = hist_scores[-7]
            mom = {s: r2(disp[s] - ago[s]) for s in SC}

        # 7. badges
        badges = []
        if any(e["tier"] == "T4" for e in events):
            badges.append("landmark_day")
        if capped:
            badges.append("speed_limit")
        if any(abs(v) >= R["badge_thresholds"]["breakout_7d"] for v in mom.values()):
            badges.append("breakout")
        lead_prev = max(prev, key=prev.get)
        lead_now = max(disp, key=disp.get)
        first_day = not hist_scores
        if lead_now != lead_prev and not first_day:
            badges.append("new_leader")
        order_prev = sorted(SC, key=lambda s: -prev[s])
        order_now = sorted(SC, key=lambda s: -disp[s])
        if order_prev != order_now and not first_day:
            badges.append("crossover")
        if heat < R["badge_thresholds"]["quiet_heat"]:
            badges.append("quiet_day")

        summary = load(P("data", "summaries", ds + ".json"), None)
        rec = {
            "date": ds, "rules_version": R["version"],
            "scores": {s: r2(disp[s]) for s in SC},
            "deltas": {s: r2(deltas[s]) for s in SC},
            "targets": {s: r2(target[s]) for s in SC},
            "momentum_7d": mom,
            "factors": {f: r2(F[f]) for f in FACT},
            "factor_deltas": {f: r2(F[f] - F_prev[f]) for f in FACT},
            "composites": {"horizon_balance": r2(balance), "families": {fm: r2(v) for fm, v in fam.items()},
                           "news_heat": r2(heat), "evidence": evidence, "event_count": len(events)},
            "badges": badges, "speed_limited": capped,
            "fading_contribution": fade_c,
            "summary": summary,
            "events": events,
        }
        dump(P("data", "days", ds + ".json"), rec)

        H["dates"].append(ds)
        for s in SC:
            H["scores"][s].append(r2(disp[s]))
        for f in FACT:
            H["factors"][f].append(r2(F[f]))
        for fm in fam:
            H["families"][fm].append(r2(fam[fm]))
        H["balance"].append(r2(balance))
        H["heat"].append(r2(heat))
        H["evidence"].append(evidence)
        H["event_counts"].append(len(events))
        H["badges"].append(badges)
        H["headlines"].append((summary or {}).get("headline", ""))
        H["totals"]["events"] += len(events)
        for e in events:
            if tier_rank[e["tier"]] >= 3:
                H["key_events"].append({"i": len(H["dates"]) - 1, "date": ds, "tier": e["tier"], "title": e["title"]})
        hist_scores.append(dict(disp))
        day += dt.timedelta(days=1)

    rec = sorted(glob.glob(P("data", "summaries", "recap-w*.json")), key=lambda f: int(os.path.basename(f)[7:-5]))
    H["recaps"] = ["data/summaries/" + os.path.basename(f) for f in rec]
    dump(P("data", "history.json"), H, compact=True)
    print(f"computed {len(H['dates'])} days {H['start']} -> {H['end']}")


if __name__ == "__main__":
    main()
